#!/usr/bin/env bash
# Build, Developer ID-sign, notarize, staple, and assess a macOS release.
# Required environment: APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID.
set -euo pipefail

for name in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID; do
  if [ -z "${!name:-}" ]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="$REPO/src-tauri/target/release/bundle/macos/Woodshed.app"
DMG="$REPO/src-tauri/target/release/bundle/dmg/Woodshed_0.1.0_aarch64.dmg"
ARCHIVE="$(mktemp -t woodshed-notary).zip"
trap 'rm -f "$ARCHIVE"' EXIT

if [ -n "$(git -C "$REPO" status --porcelain --untracked-files=all)" ]; then
  echo "Signed releases require a clean tracked source tree. Commit or stash changes first." >&2
  exit 1
fi

(cd "$REPO" && npm run verify)
(cd "$REPO" && npm run tauri build)

PROVENANCE="$APP/Contents/Resources/build-provenance.json"
test -f "$PROVENANCE"
test "$(node -p "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')).dirty" "$PROVENANCE")" = "false"

# Developer ID-sign the .app with hardened runtime before any notarization package is built.
codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

ditto -c -k --keepParent "$APP" "$ARCHIVE"
xcrun notarytool submit "$ARCHIVE" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"

codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$DMG"
xcrun notarytool submit "$DMG" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"

codesign --verify --deep --strict --verbose=2 "$APP"
codesign --verify --strict --verbose=2 "$DMG"
spctl --assess --type execute --verbose=4 "$APP"
spctl --assess --type open --context context:primary-signature --verbose=4 "$DMG"
echo "Signed and notarized release verified: $DMG"
