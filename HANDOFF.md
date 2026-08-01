# Woodshed session handoff

Updated 2026-07-29 for source revision `27dcee7` plus the current uncommitted audit-remediation work. Reconcile this file with `git status`, `git log`, and current test output before acting.

## Current product

Woodshed is a 16-lesson local-first MPK mini trainer with web and Tauri MIDI transports, generated audio, a beat sequencer, takes, calibration, versioned import/export, and local diagnostics. The curriculum rule is universal: completion gates use ranges, contrasts, or stream statistics, never exact pitches or absolute velocities.

Sterling launches `/Applications/Woodshed.app`; a source build is not live there. Do not run `npm run app:update` unless changing the installed app is explicitly intended. Native data lives at `~/Library/Application Support/com.sterlingdigital.woodshed/store.json` and must be preserved.

## Verification

Run `npm run verify` for web tests/lint/build and Rust fmt/Clippy/tests. Packaging uses `npm run tauri build`. A successful package build does not prove Developer ID signing, notarization, Gatekeeper acceptance, physical MPK behavior, audio quality, or GarageBand integration.

The current audit-remediation work adds panic handling, port provenance/filtering, versioned validation and recovery, native store tests, GarageBand audio isolation, recorder/timer cleanup, CSP/accessibility, CI, toolchain alignment, and safe install/release scripts. Check the final session report and fresh command output for exact pass counts and unresolved external verification.

## External checks still requiring evidence

- Run the dated MPK and GarageBand checklist in `docs/HARDWARE_QA.md`.
- Decide and test arm64-only versus universal distribution.
- Configure Developer ID/notary credentials securely, then run and record `npm run release:mac`.
- Test the quarantined, downloaded DMG on a clean Mac before claiming Gatekeeper readiness.

Pre-existing untracked `.handoff-auto.md`, `AGENTS.md`, `REPOSITORY_AUDIT.md`, and `trader/` belong to the workspace owner and must not be deleted or swept into unrelated commits.
