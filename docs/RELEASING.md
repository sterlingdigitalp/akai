# macOS release and local installation

Woodshed 0.1.0 targets the current personal Apple-silicon Mac. Intel/universal support has not been built or tested.

## Local toolbar update

`npm run app:update` runs the full verification suite, embeds a source-provenance manifest, builds, stages the app under `/Applications`, validates its signature, and swaps it into place with rollback protection. The manifest includes the commit and a hash of tracked uncommitted changes when present. The installer preserves an existing Developer ID signature and only ad-hoc-signs an unsigned local build. It does not notarize the result and is not a public distribution path.

The script intentionally changes `/Applications/Woodshed.app`; do not run it when only source verification is wanted. Native user data stays in `~/Library/Application Support/com.sterlingdigital.woodshed/store.json`.

## Signed release

Install a valid Developer ID Application certificate without exporting certificate material into the repository. Supply these values only through the environment or secure CI secrets:

- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD` (prefer an app-specific password or a secure notarytool credential profile in a future revision)
- `APPLE_TEAM_ID`

Run `npm run release:mac`. The script fails closed if credentials are absent or the tracked source tree is dirty, runs all checks, embeds and validates clean-source provenance, builds, verifies the app signature, submits the app and DMG to Apple, staples and validates tickets, and runs `spctl` assessments.

Never commit credentials, `.p12` files, keychains, notary logs containing secrets, or provisioning material. A successful unsigned Tauri build is not release evidence. Record the build SHA, CPU target, signing identity, notarization submission IDs, and final hashes with each release/tag.

Gatekeeper, signing, stapling, and notarization remain unverified until the script completes on a configured Mac and the artifact is tested after downloading/quarantining it on a clean machine.
