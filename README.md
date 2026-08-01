# Woodshed

Woodshed is a local-first interactive trainer for Sterling’s Akai MPK mini. It has a 16-lesson path, an on-screen playable controller, generated synth and drum audio, beat sequencing, take recording/replay, calibration, local diagnostics, and guided GarageBand sessions.

## Supported surfaces

- Web: Chrome with Web MIDI, served from a secure context in production. Local development runs at `http://localhost:5173`.
- Native: macOS through Tauri and a Rust `midir` bridge. The current release target is a personal Apple-silicon Mac; Intel/universal and public distribution are not verified.
- Layout: desktop-only, with a documented 1024×780 minimum. Mobile browser support is not currently a product target.

Woodshed listens to all MPK/Akai-labelled MIDI inputs so split controller/DAW ports keep working. When no MPK-labelled input exists it falls back to available inputs. Source identity is retained in events and diagnostics, and each calibration pass locks to the first relevant port.

## Develop and verify

Use the pinned Node/npm and Rust versions in `.nvmrc`, `package.json`, and `rust-toolchain.toml`.

```sh
npm ci
npm run dev
npm run verify
```

Useful individual commands:

```sh
npm test
npm run lint
npm run build
npm run tauri dev
npm run tauri build
```

`npm run verify` covers  TypeScript/Vitest, warning-free lint, the production web build, Rust formatting, Clippy with warnings denied, and Rust tests. CI also performs live npm and Rust advisory checks and constructs an unsigned native app. Automated checks do not verify real hardware, audio quality, GarageBand, Gatekeeper, or notarization.

## Data and recovery

There are no accounts, backend, analytics, or application-source network requests. Web data uses localStorage. Native data uses:

`~/Library/Application Support/com.sterlingdigital.woodshed/store.json`

Native writes are synchronized and atomic, retain a last-known backup, and quarantine corrupt JSON as `store.corrupt-<timestamp>.json` before rebuilding an empty store. Storage failures are surfaced in the UI. Export/import uses a deeply validated, versioned schema containing progress, controller setup, the 8×16 beat, takes, and diagnostics; legacy v1 exports are migrated.

Never delete or edit the native store during routine development. Export from Settings before intentional recovery tests.

## Audio and GarageBand

Woodshed provides a panic path on MIDI disconnect, window blur/page hide, demo-mode changes, component teardown, and pointer cancellation. GarageBand lessons automatically mute Woodshed’s synth and drums so Woodshed audio cannot masquerade as DAW monitoring. Settings also has a manual Woodshed audio switch.

GarageBand steps remain guided/self-attested; Woodshed cannot inspect GarageBand tracks or exported files. Use [the hardware QA checklist](docs/HARDWARE_QA.md) before claiming an external-app or physical-controller pass.

## Installation and release

Sterling normally launches `/Applications/Woodshed.app`; source changes are not live there. `npm run app:update` is an explicit, transactional local install with staging, signature validation, embedded source provenance, backup, and rollback. It runs verification first and does not overwrite a real Developer ID signature with ad-hoc signing. The provenance manifest records the commit and, for a local dirty build, a hash of tracked changes.

Public distribution requires Developer ID signing and Apple notarization. See [RELEASING.md](docs/RELEASING.md). Do not call an artifact signed/notarized/Gatekeeper-approved without command evidence from a configured Mac.

## Curriculum rule

Lesson completion gates use ranges, relative contrasts, or stream statistics—never exact pitches or absolute velocity thresholds. Named notes may be explained pedagogically, but detector success cannot depend on a specific pitch.
