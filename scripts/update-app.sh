#!/usr/bin/env bash
# Rebuild the native Woodshed.app from current source and install it over the
# toolbar copy in /Applications, so the app you launch is never stale.
# Usage: npm run app:update   (or: bash scripts/update-app.sh)
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
FRESH="$REPO/src-tauri/target/release/bundle/macos/Woodshed.app"
INSTALLED="/Applications/Woodshed.app"

echo "▶ Building native app from current source (this takes a few minutes)…"
( cd "$REPO" && npm run tauri build )

# Never install a broken build.
if [ ! -x "$FRESH/Contents/MacOS/Woodshed" ]; then
  echo "✗ Fresh build missing or incomplete at $FRESH — not touching $INSTALLED" >&2
  exit 1
fi

if pgrep -x Woodshed >/dev/null; then
  echo "• Woodshed is running — quitting it so the new build takes effect…"
  osascript -e 'quit app "Woodshed"' >/dev/null 2>&1 || true
  sleep 1
fi

echo "▶ Installing fresh build over $INSTALLED…"
rm -rf "$INSTALLED"
ditto "$FRESH" "$INSTALLED"

# ditto can break the code seal; re-sign ad-hoc so it launches cleanly.
codesign --force --deep --sign - "$INSTALLED" >/dev/null 2>&1
codesign -v "$INSTALLED" >/dev/null 2>&1 && echo "✓ Signature valid" || { echo "✗ Signature invalid after re-sign" >&2; exit 1; }

echo "✓ Toolbar app updated to $(date '+%b %d %H:%M'). Launch it from the toolbar as usual."
