#!/usr/bin/env bash
# Verify, build, stage, validate, and transactionally replace the local toolbar app.
# This is a personal local installer, not a public distribution workflow.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FRESH="$REPO/src-tauri/target/release/bundle/macos/Woodshed.app"
INSTALLED="/Applications/Woodshed.app"
STAGING_ROOT=""
INSTALL_COMPLETE=0
SWAP_STARTED=0

cleanup() {
  if [ -n "$STAGING_ROOT" ] && [[ "$STAGING_ROOT" == /Applications/.woodshed-update.* ]]; then
    if [ "$INSTALL_COMPLETE" -ne 1 ] && [ "$SWAP_STARTED" -eq 1 ]; then
      if [ -e "$INSTALLED" ]; then mv "$INSTALLED" "$STAGING_ROOT/Woodshed.failed.app"; fi
      if [ -e "$STAGING_ROOT/Woodshed.previous.app" ]; then
        mv "$STAGING_ROOT/Woodshed.previous.app" "$INSTALLED"
        echo "• Restored the previous Woodshed app after an interrupted or failed install" >&2
      fi
    fi
    rm -rf "$STAGING_ROOT"
  fi
}
trap cleanup EXIT

echo "▶ Verifying source before touching the installed app…"
(cd "$REPO" && npm run verify)

echo "▶ Building native app with embedded source provenance…"
(cd "$REPO" && npm run tauri build)

if [ ! -x "$FRESH/Contents/MacOS/woodshed" ]; then
  echo "✗ Fresh build missing or incomplete at $FRESH — installed app was not touched" >&2
  exit 1
fi
PROVENANCE="$FRESH/Contents/Resources/build-provenance.json"
if [ ! -f "$PROVENANCE" ]; then
  echo "✗ Fresh build has no provenance manifest — installed app was not touched" >&2
  exit 1
fi
SOURCE_STATE="$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).sourceState" "$PROVENANCE")"

STAGING_ROOT="$(mktemp -d /Applications/.woodshed-update.XXXXXX)"
STAGED="$STAGING_ROOT/Woodshed.app"
BACKUP="$STAGING_ROOT/Woodshed.previous.app"
ditto "$FRESH" "$STAGED"

# Preserve real Developer ID signatures. Only ad-hoc sign a local unsigned build.
if codesign -dv --verbose=4 "$STAGED" 2>&1 | grep -q '^Authority=Developer ID Application:'; then
  codesign --verify --deep --strict --verbose=2 "$STAGED"
else
  codesign --force --deep --sign - "$STAGED"
  codesign --verify --deep --strict --verbose=2 "$STAGED"
fi

if pgrep -x woodshed >/dev/null || pgrep -x Woodshed >/dev/null; then
  echo "• Woodshed is running — asking it to quit…"
  osascript -e 'quit app "Woodshed"' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    pgrep -x woodshed >/dev/null || break
    sleep 1
  done
  if pgrep -x woodshed >/dev/null || pgrep -x Woodshed >/dev/null; then
    echo "✗ Woodshed did not quit; installed app was not touched" >&2
    exit 1
  fi
fi

echo "▶ Installing staged app with rollback protection…"
SWAP_STARTED=1
if [ -e "$INSTALLED" ]; then
  mv "$INSTALLED" "$BACKUP"
fi

if ! mv "$STAGED" "$INSTALLED" || ! codesign --verify --deep --strict "$INSTALLED"; then
  echo "✗ New app failed installation verification; restoring the previous app" >&2
  exit 1
fi

INSTALL_COMPLETE=1
echo "✓ Toolbar app updated transactionally from source $SOURCE_STATE."
