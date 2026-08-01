# Woodshed Repository Audit

Audit date: 2026-07-29  
Repository: `sterlingdigitalp/akai`  
Audited revision: `27dcee7ab9949f82b980cf1e6a59c3e56dd905e8` on `main`  
Audit mode: read-only source review; safe builds/tests regenerated ignored artifacts in `dist/` and `src-tauri/target/`

## Executive conclusion

Woodshed is a credible, substantially implemented local-first trainer for one user's Akai MPK mini. It has a polished React interface, a 16-lesson curriculum, Web MIDI and native Tauri MIDI paths, generated synth/drum audio, a beat sequencer, take recording/replay, calibration, progress persistence, import/export, and local diagnostics.

The checked-in code compiles and its existing automated tests pass. The web UI also passed a local navigation/render smoke test with no browser console warnings or errors. The project is nevertheless **not distribution-ready** and should not yet be described as fully reliable:

- the fresh macOS app inside the DMG is ad-hoc/linker-signed and fails strict code-sign verification;
- three active lesson gates directly violate the absolute-velocity prohibition, and three Lesson 2 gates use exact pitch classes despite the repository-wide prohibition;
- a lost MIDI note-off can leave an audible synth voice stuck indefinitely;
- shallow import and hydration validation can install data that later crashes Home or Beats;
- documentation and handoff state are severely stale relative to the current 16-lesson product;
- native storage/MIDI/export code compiles but has zero Rust tests, and there is no CI;
- GarageBand lessons do not integrate with GarageBand and can be confused by Woodshed's own always-on audio.

No remote-data exfiltration path or known remote code-execution defect was found. The app has no backend, accounts, analytics, remote fetches, dynamic HTML injection, or network protocol in application source. Security conclusions remain bounded by an offline npm advisory check and the absence of a Rust advisory scanner.

### Evidence labels

- **VERIFIED** means directly observed in source, history, generated artifacts, a command result, the local rendered UI, or the connected GitHub repository.
- **INFERENCE** means a likely consequence of verified code that was not reproduced end-to-end.
- **UNVERIFIED** means hardware, OS, external application, or security state that the audit could not safely establish.

## Scope and repository state

The audit covered all 123 tracked files, approximately 15,585 tracked source/configuration lines, all TypeScript/TSX, CSS, Rust, tests, scripts, lockfiles, generated Tauri schemas/icons, README and handoff files, recent git history, ignored build outputs, and untracked workspace files.

At audit start and before this report was added:

```text
## main...origin/main
?? .handoff-auto.md
?? AGENTS.md
?? trader/
```

Those untracked files pre-dated the audit and were preserved. `trader/.entry_combo_tmp.py` is an unrelated 86-line trading experiment that loads `/private/tmp/entry_forks.py` (`trader/.entry_combo_tmp.py:1-15`); it is not referenced by Woodshed and should not be treated as a project subsystem. Its presence is workspace contamination, not a shipped-code defect.

The connected GitHub repository is public, unarchived, and uses `main` as its default branch. **VERIFIED:** it currently has no open or closed GitHub issues and no pull requests. The checkout contains no `.github/workflows`, and no PR-triggered workflow run exists for HEAD. Git history contains 19 commits and no tags.

## Verification record

| Command/check | Result | Interpretation |
|---|---|---|
| `npm test` | PASS: 8 files, 107/107 tests | Strong detector/parser/store utility baseline; Node emitted experimental `localStorage` warnings |
| `npm run build` | PASS: `tsc -b && vite build`, 58 modules | Web type-check and production bundle succeed |
| Build size | JS 303.34 kB/96.29 kB gzip; CSS 27.53 kB/6.10 kB gzip; `dist/` about 1.1 MB | Reasonable application code size; fonts dominate the remaining output |
| `npm run lint` | Exit 0 with 3 warnings | Lint is not clean and warnings do not fail the command |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | PASS | Rust formatting is clean |
| `cargo check --manifest-path src-tauri/Cargo.toml --locked` | PASS | Native debug compile succeeds |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings` | PASS | Rust lint is clean |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | PASS, but 0 tests | Native behavior is compile-checked only |
| `npm run tauri build` | PASS; produced arm64 app and DMG | Bundle construction succeeds, but signing verification fails |
| `npm audit --offline` | 0 cached advisories | Not equivalent to a live registry audit |
| `cargo audit` / `cargo deny` | unavailable | Rust advisory status is unknown |
| Local Vite/browser smoke | Home, 16-card lesson path, Lesson 1, Playground, and Settings rendered; no console warnings/errors | Basic UI/navigation works without MIDI |
| Responsive smoke | no horizontal overflow at 1024×780; 1024px document width at a 390px viewport | Desktop-only layout is enforced |
| Fresh `.app` strict signature check | FAIL: `code has no resources but signature indicates they must be present` | Raw bundle is not a valid distributable |
| DMG/Gatekeeper checks | DMG unsigned; `spctl` produced a Code Signing subsystem error | Distribution readiness is blocked |

Lint warnings:

- `src/App.tsx:16`: conditional expression used as a statement;
- `src/state/midiStore.ts:22`: conditional expression used as a statement;
- `src/views/Lesson.tsx:30`: hook dependencies omit `step.id` and `step.goal.type`.

Audit toolchain was Node 26.3.1, npm 11.16.0, Rust/Cargo 1.96.0, and Tauri CLI 2.11.4. The repository does not pin those versions.

## 1. Intended product

**VERIFIED:** Woodshed is a desktop-first, local-first interactive trainer for Sterling's new-generation Akai MPK mini. The intended learning arc starts with controller discovery and calibration, progresses through keys, pads, beats, synth shaping, hardware ARP/CHORDS/SCALES/NOTE REPEAT, melody, chords, drums, groove, sound shaping, expression and multi-part performance, then ends in GarageBand with a shareable track (`src/lessons/content.ts:6-142`).

The current curriculum has:

- 16 sequential lessons, asserted by `src/tests/lessonContent.test.ts:30-37`;
- 87 interactive moves plus 16 recaps;
- an explicit “one player, a whole arrangement” product thread in Lessons 15–16 (`src/lessons/content.ts:123-140`);
- permissive escape hatches so a hardware mismatch does not dead-end the learner (`src/views/Lesson.tsx:63-70`).

The product is personalized, not a generic MIDI-learning platform:

- a single persisted controller profile assumes eight pads, eight knobs, key/pad channels, pitch bend, and mod CC (`src/midi/profile.ts:4-20`);
- lesson content directly names MPK hardware functions and GarageBand;
- there are no accounts, cloud sync, backend, content management system, or multi-user model.

The architecture encodes the following intent:

```text
MIDI ports
  -> raw bytes
  -> parser
  -> persisted device profile/classifier
  -> normalized ControlEvent
  -> MIDI Zustand state + subscribers
       -> audio bridge
       -> lesson detector
       -> recorder
       -> diagnostics
```

Evidence: `src/midi/midi.ts:15-38`, `src/midi/profile.ts:33-45`, `src/App.tsx:14-21`, `src/views/Lesson.tsx:33-55`, `src/audio/recorder.ts:18-27`, and `src/lessons/diagnostics.ts:17-45`.

## 2. What is implemented and working

### Verified working in automated or local smoke checks

- **Application shell and navigation.** A no-router React SPA switches between Home, Lesson, Playground, and Settings through Zustand (`src/App.tsx:24-27`; `src/state/uiStore.ts:1-4`). The local smoke test rendered all primary surfaces.
- **Lesson path.** Home rendered all 16 lesson cards and progress metadata; content uniqueness and numbering are tested (`src/views/Home.tsx:7-17`; `src/tests/lessonContent.test.ts:30-44`).
- **Detector engine.** The pure reducer supports event, count, range, timing, stream, density, contour, phrasing, mixed-surface, chord/scale, dynamics, repeat, overlay, gesture, and confirmation goals (`src/lessons/engine.ts:3-35,109-357`). Most of the 107 tests exercise positive and negative detector behavior.
- **Web build.** TypeScript and Vite production output pass.
- **Native compile/bundle.** Rust/Tauri compiles and creates an arm64 `.app` and DMG.
- **MIDI parsing/classification.** Note on/off, CC and pitch bend parsing, profile mapping, bank folding, and normalized events are unit-tested (`src/midi/parser.ts`; `src/midi/profile.ts`; `src/tests/parser.test.ts`; `src/tests/profile.test.ts`).
- **Dual MIDI transports.** Web MIDI subscribes to all connected browser inputs (`src/midi/midi.ts:40-68`). Native Rust discovers and connects ports every two seconds and emits bytes to the webview (`src-tauri/src/midi.rs:16-85`; `src/midi/tauri.ts:30-49`).
- **Generated audio.** A Web Audio synth, eight drum voices, delay, compressor and metronome are implemented (`src/audio/engine.ts`; `src/audio/synth.ts`; `src/audio/drums.ts`; `src/views/Lesson.tsx:84-108`).
- **Beat sequencer.** An 8×16 pattern, BPM, swing, live pad step capture, persistence and scheduling exist (`src/views/Playground.tsx:24-40`; `src/audio/clock.ts:1-21`).
- **Takes.** Recording, storage, rename/delete and replay exist, with caps of 180 seconds/4,000 events and 12 saved takes (`src/audio/recorder.ts`; `src/state/takesStore.ts`; `src/components/TakesPanel.tsx`).
- **Persistence.** Progress, profile, takes and diagnostics use localStorage on web and a Tauri JSON file adapter natively (`src/state/storage.ts:5-18`; `src-tauri/src/lib.rs:11-60`).
- **Local diagnostics.** Per-step raw MIDI capture, outcome, counts and bounded retention are implemented and tested (`src/lessons/diagnostics.ts`; `src/state/diagnosticsStore.ts`; `src/tests/diagnostics.test.ts`).
- **Data export/import.** Progress, controller profile and beat pattern can be exported/imported (`src/views/Settings.tsx:13-47,97-143`; `src-tauri/src/lib.rs:63-77`).

### Implemented but not verified end-to-end

- **Real MPK behavior.** Historical handoff claims cover the original five lessons, but later Lessons 6–16, takes, diagnostics, expression and multi-part goals have no checked-in hardware fixtures or repeatable hardware QA record.
- **Audio quality.** Audio graph construction is source-verified; sound quality and WKWebView/Chrome parity were not verified by ear.
- **Hot-plug and multi-port behavior.** Code exists, but there are no browser/native integration tests for disconnect, reconnect, duplicate names or unrelated devices.
- **Native file persistence.** Compile-verified only; no Rust test covers corrupt data, atomic replacement, concurrency or export behavior.
- **GarageBand.** Lessons give instructions, but there is no GarageBand API, state observation, file verification or mute/monitor integration. Confirmation steps are user assertions (`src/lessons/content.ts:65-72,131-140`).
- **Installed toolbar app provenance.** `/Applications/Woodshed.app` contains the same current hashed frontend asset names and passes strict local `codesign` verification after ad-hoc deep signing, but no git SHA is embedded. Exact full-source provenance is therefore an inference, not proof.

## 3. Build-out status by subsystem

| Subsystem | Status | Evidence and remaining gap |
|---|---|---|
| React shell/Home/lesson navigation | Working | Local smoke passed; `src/App.tsx`, `src/components/Shell.tsx`, `src/views/Home.tsx`, `src/views/Lesson.tsx` |
| Curriculum/content | Substantially built | 16 lessons/103 total steps; policy contradictions and newer hardware QA gaps remain |
| Lesson detector engine | Strong unit-level build-out | Broad tests in `src/tests/lessonEngine.test.ts`; monolithic reducer and no real-stream fixture suite |
| Web MIDI | Implemented, integration-unverified | `src/midi/midi.ts:40-68`; requires Chrome/Web MIDI and hardware |
| Native MIDI | Implemented, compile-only | `src-tauri/src/midi.rs`; zero Rust tests |
| Device calibration/profile | Implemented, weakly isolated | Learns pads/knobs; cannot learn key channel, mod CC or pitch format; any MIDI source can contaminate calibration |
| Synth/drums/metronome | Implemented, manually unverified | Web Audio code exists; stuck-note and global-parameter lifecycle defects |
| Demo controller | Partial | Keys/pads/knobs/wheels work by pointer; function buttons are display-only and keyboard accessibility is incomplete |
| Beat sequencer | Working at source/unit utility level | Scheduling helper tests do not instantiate production `StepClock`; native pattern storage remains split |
| Takes | Feature-complete happy path, lifecycle gaps | Recorder/store tests are narrow; cap, zero-duration and replay timing issues remain |
| Progress/profile persistence | Implemented | Web/local and native/file adapter; no schema migration or storage failure UI |
| Diagnostics | Implemented | Bounded and local; captures all connected MIDI traffic, not port identity |
| Import/export | Partial/high-risk | Happy path exists; no versioned/deep schema; omits takes/diagnostics |
| GarageBand/DAW | Instructional only | No integration or reliable external-state validation |
| Web deployment | Not built | No hosting/deployment config; Web MIDI production would require a secure context |
| macOS local install | Usable but ad-hoc | `/Applications` workflow exists; manual and nontransactional |
| macOS distribution | Blocked | Fresh DMG app fails strict signing; no Developer ID/notarization/universal build |
| CI/release automation | Missing | No workflow, tags, release process, aggregate verify, provenance or updater |
| Documentation | Inadequate/stale | README is scaffold; HANDOFF describes July 11/five lessons |

## 4. Defects, risks, contradictions, dead code and missing pieces

### Critical/high priority

#### 4.1 Lesson gates violate the repository's core learning rule

**VERIFIED:** `AGENTS.md:5` and `CLAUDE.md:5` require ranges, contrasts or stream statistics and prohibit exact pitches and absolute velocities. Current active content still uses:

- `maxVelocity: .35` for `soft-key` (`src/lessons/content.ts:9`);
- `minVelocity: .55` for `hard-key` (`src/lessons/content.ts:10`);
- `minVelocity: .3` for the mod wheel (`src/lessons/content.ts:16`);
- exact C, C-major scale and C-major chord pitch classes (`src/lessons/content.ts:20-22`).

The guard test checks only `LESSONS.slice(8)`, Lessons 9–16 (`src/tests/lessonContent.test.ts:47-54`). This is implementation/instruction drift, not merely missing documentation. Git history (`96e4e82`, `a59e5ce`) and `HANDOFF.md:29` show the rule arose after real hardware threshold walls.

Uncertainty: teaching named notes may justify a documented exception, but no exception is stated. As written, the implementation is noncompliant.

#### 4.2 Lost releases can create stuck notes

**VERIFIED:** voices have no autonomous lifetime and remain until `noteOff` (`src/audio/synth.ts:6,27-45`). Browser/native disconnect paths only update connection status (`src/midi/midi.ts:40-58`; `src/midi/tauri.ts:16-23`). On-screen keys handle `onPointerUp` but not pointer cancel/lost capture (`src/components/device/DeviceView.tsx:254-259`).

**INFERENCE:** unplugging while holding a key, losing a MIDI note-off, window/pointer cancellation, or a driver failure can leave both `heldKeys` and an oscillator active indefinitely. There is no `allNotesOff`/panic path.

#### 4.3 Import/persisted-data validation can create durable crashes

**VERIFIED:** `parseImport` checks only broad object/array presence (`src/views/Settings.tsx:41-47`) and directly installs the result (`:132-140`). It does not validate lesson records, IDs, dates, numeric profile values, lengths, or the pattern's 8×16 boolean shape.

Concrete source consequences:

- a lesson value without `completedSteps` reaches `Home`'s `.some` access (`src/views/Home.tsx:9`);
- a pattern such as `[null]` passes import validation but later reaches `row.map` (`src/views/Playground.tsx:40`);
- `readPattern` trusts any successfully parsed localStorage value as `boolean[][]` (`src/views/Playground.tsx:14`).

This is a local data-integrity issue, not currently a remote exploit. There is no export schema version or Zustand migration configuration.

#### 4.4 Native distributable is not signed/notarized

**VERIFIED:** `src-tauri/tauri.conf.json:27-37` declares app/DMG bundles but no signing or updater. A fresh build produced a thin arm64 application. The enclosed app reported ad-hoc/linker signing, no Team ID, unbound Info.plist and no sealed resources. `codesign --verify --deep --strict` failed. The DMG itself is unsigned and Gatekeeper assessment did not pass.

Build success therefore proves compilation/bundling, not release readiness. This blocks safe distribution to quarantined Macs. Intel/universal compatibility is also unbuilt and unverified.

#### 4.5 GarageBand lessons can give false confidence or doubled audio

**VERIFIED:** `AudioBridge` always plays Woodshed's own synth/drums for incoming controls (`src/App.tsx:14-21`). Lesson 8 asks the user to confirm GarageBand sound by playing a key (`src/lessons/content.ts:68`). No mute/DAW-monitor mode exists.

**INFERENCE:** the user can hear Woodshed and incorrectly conclude GarageBand is configured, or hear doubled instruments when both apps sound.

### Medium priority

#### 4.6 Playground labels and preset state do not match the audio engine

**VERIFIED:** knobs 1–4 map to cutoff, resonance, release and delay send (`src/App.tsx:18`). Playground labels them Brightness, Edge, Attack and Fade (`src/views/Playground.tsx:20-22`), so knobs 3–4 are mislabeled. The selected UI preset defaults to “Warm Pad” but `setPreset` is not called on mount; module defaults differ from Warm Pad (`src/audio/synth.ts:5,9-16`). Preset clicks change synth parameters, while percentage readouts continue to show physical MIDI knob state.

Knobs 5–8 are displayed and calibratable but have no audio mapping (`src/App.tsx:18`).

#### 4.7 Native saved-beat persistence bypasses the native store

**VERIFIED:** progress, profile, takes and diagnostics use `woodshedStorage`, but the pattern uses raw localStorage (`src/views/Playground.tsx:14,26`; `src/views/Settings.tsx:23-38,137-138`; `src/state/storage.ts:15-18`). Native beats therefore live in WKWebView storage rather than the documented `store.json`. This is also acknowledged in stale `HANDOFF.md:26`.

#### 4.8 Native store failures are silent and unrecoverable

**VERIFIED:** `store_get` turns lock, path, read and JSON parse failures into `None` (`src-tauri/src/lib.rs:31-36`), indistinguishable from no data. A corrupt existing file then makes later `store_set` fail (`:39-60`). There is no backup, quarantine, repair or UI error. The frontend “remove” operation stores literal `"null"` rather than deleting the map key (`src/state/storage.ts:10-12`).

Each update parses and rewrites the whole string map, including large take payloads. Rust has no tests for this behavior.

#### 4.9 MIDI source identity is discarded

**VERIFIED:** the Rust event contains `port` (`src-tauri/src/midi.rs:10-14,73-80`), but the frontend passes only `payload.bytes` (`src/midi/tauri.ts:38-40`). Web and native subscribe to every input. Calibration accepts the first eight unique matching values without port isolation (`src/views/Settings.tsx:73-89`; `src/views/Lesson.tsx:39-55`).

Listening to multiple ports is an intentional response to MPK split interfaces, but unrelated/virtual MIDI can change audio, complete lessons or pollute calibration/diagnostics. Native connections are keyed and deduplicated by port name (`src-tauri/src/midi.rs:18,46-55`), so identical names collapse. Discovery failure sleeps without emitting an error/empty state (`:20-24`).

#### 4.10 Recorder UI and timing lifecycle have defects

**VERIFIED:**

- the recorder silently unsubscribes at 180 seconds or 4,000 events (`src/audio/recorder.ts:7-8,21-26`), but `TakesPanel` keeps local `recording=true` until the user stops (`src/components/TakesPanel.tsx:11-19`);
- a one-event take has `durationMs = 0` (`src/audio/recorder.ts:30-35`) and playback releases it in the same animation-frame tick (`:58-74`);
- replay filters and sorts the full event array on every animation frame (`:38-40,63-71`);
- the 13th saved take silently evicts the oldest (`src/state/takesStore.ts:6,15`);
- delete has no confirmation (`src/components/TakesPanel.tsx:34`).

Existing tests cover slicing and store reducers, not actual recording, caps, playback, cancellation or timing.

#### 4.11 Lesson audio leaks state and scheduled work

**VERIFIED:** the backing phrase sets global synth attack to `.35` and never restores it (`src/views/Lesson.tsx:56-62`). “Play your beat” schedules untracked timeouts and immediately marks the step skipped (`:63-65`); leaving the step cannot cancel remaining hits. There is no general audio shutdown.

#### 4.12 `app:update` is destructive, nontransactional and signing-hostile

**VERIFIED:** `scripts/update-app.sh:11-34` builds, checks only one executable, deletes `/Applications/Woodshed.app`, copies, then forcibly deep ad-hoc signs.

Risks:

- no staging swap, backup or rollback if copy/signing fails;
- the only installed copy is removed before replacement is verified;
- unconditional `codesign --force --deep --sign -` will replace any future Developer ID signature and invalidate notarized release state;
- `pgrep -x Woodshed` and the `MacOS/Woodshed` probe use uppercase names while the actual executable is `woodshed`; case-insensitive default macOS filesystems mask the path mismatch, and process matching may miss the running app (**INFERENCE; needs live confirmation**);
- it runs the build but not tests, lint or native test/lint gates.

#### 4.13 Tauri CSP is disabled

**VERIFIED:** `src-tauri/tauri.conf.json:23-25` sets `csp: null`. Current code uses React escaping and contains no `dangerouslySetInnerHTML`, `eval`, fetch or remote content, which lowers present exploitability. A future injection would nevertheless gain access to custom store/export invokes (`src-tauri/src/lib.rs:31-77`). A restrictive production CSP is warranted.

#### 4.14 Accessibility and responsive behavior are incomplete

**VERIFIED:** the SVG keys, pads, knobs and wheels are focusable and assigned roles, but only pointer handlers change them (`src/components/device/DeviceView.tsx:136,158,182,255-258`). There is no Enter/Space activation or arrow adjustment; knobs omit `aria-valuemin/max`. Playground uses `role="tablist"` without `role="tab"`, `aria-selected` or tabpanel relationships (`src/views/Playground.tsx:16-18`).

Both CSS and the native window enforce a 1024px minimum (`src/index.css:27-34`; `src-tauri/tauri.conf.json:16-19`). Browser measurement confirmed horizontal overflow at 390px. This may be intentional desktop scope, but it is undocumented.

#### 4.15 Detector and rendering performance can degrade on long/high-rate steps

**VERIFIED:** every `reduceGoal` call clones all detector arrays before checking relevance (`src/lessons/engine.ts:109-112`), and LessonView stores every returned state (`src/views/Lesson.tsx:33-38`). Dynamics and gesture histories are not windowed (`src/lessons/engine.ts:203-208,340-352`).

**INFERENCE:** long knob/arp streams can produce growing allocations, repeated scans and full lesson/device SVG rerenders, approaching quadratic work for some goals. No profiler benchmark exists.

### Lower priority / technical debt

- TypeScript does not enable `strict`, `strictNullChecks` or `noImplicitAny`; only unused/fallthrough checks are explicit (`tsconfig.app.json:19-23`).
- The 357-line detector reducer, dense 144-line curriculum file with very long lines, and 1,060-line global stylesheet increase review and merge cost.
- `vitest` is a production dependency instead of a dev dependency (`package.json:15-32`).
- Package identity/version is `akai@0.0.0`, while Tauri/Cargo are Woodshed 0.1.0 (`package.json:2-4`; `src-tauri/Cargo.toml:1-5`; `src-tauri/tauri.conf.json:3-5`).
- No Node/npm/Rust/Xcode/macOS toolchain is pinned; no `engines`, `packageManager`, `.nvmrc` or `rust-toolchain.toml` exists.
- `stepTime` is test-only while production duplicates its math (`src/audio/clock.ts:2-5,20`).
- `isPlaying` has no caller (`src/audio/recorder.ts:51`).
- `delayInput` is created/returned but unused by sends (`src/audio/engine.ts:5,8,21,25,50-56`).
- `DeviceView.compact` and `.is-compact` have no caller (`src/components/device/DeviceView.tsx:43,85`; `src/components/device/device.css:57`).
- `PatternEvent.check` is never read; pattern completion is hard-coded (`src/lessons/engine.ts:12,161-163`).
- Root `mpkmini4.webp` is unreferenced and not bundled.
- Full font CSS imports ship Cyrillic, Greek, Vietnamese, Latin and Latin-ext variants (`src/main.tsx:3-6`); fonts account for most of the roughly 1.1 MB build.
- Any pad release clears the single global flash, even if another pad was hit more recently (`src/state/midiStore.ts:25`).
- Native export overwrites the fixed `~/Downloads/woodshed-progress.json` without collision handling (`src/views/Settings.tsx:102-104`; `src-tauri/src/lib.rs:70-76`).
- Export omits takes and diagnostics. UI text narrowly promises only progress, setup and beat (`src/views/Settings.tsx:157-171`), but “Your data” can be read more broadly.
- Web storage quota pressure is plausible: up to 12×4,000 take events and 25×400 diagnostic messages are serialized, with no persistence error UI (**INFERENCE**).
- Local ignored `src-tauri/target/` occupied roughly 2.8–3.3 GB during audits. This is developer disk usage, not repository size or shipped output.

## 5. Architectural beliefs, assumptions, constraints and decisions

### Verified encoded beliefs

1. **Local-only and privacy-first.** Data remains on device; diagnostics are manually copied, not transmitted (`src/views/Settings.tsx:173-184`).
2. **One normalized event model across web, native, demo and replay.** `ControlEvent.source` distinguishes hardware/demo/replay (`src/midi/types.ts:3-11`).
3. **Hardware output is often more reliable than hardware button messages.** Lessons infer ARP/repeat/chord/scale state through streams, clusters, spans and timing statistics rather than requiring control-button events (`src/lessons/engine.ts`).
4. **Never dead-end the learner.** Unfinished steps can be skipped/use defaults; confirmations are self-attested (`src/views/Lesson.tsx:63-70`). Skips count as completed progress.
5. **Relative musical behavior is preferred.** Range, contrast, density, contour and stream regularity are central detector primitives. Legacy Lessons 1–2 conflict with the stated universal rule.
6. **The MPK exposes multiple useful USB MIDI ports.** Both transports subscribe broadly. This fixes split-port hardware but sacrifices source isolation.
7. **The native app is the real user-facing surface.** `CLAUDE.md:7` says Sterling launches `/Applications/Woodshed.app`, not the dev server.
8. **Persistence should survive rebuilds and remain portable.** Native Zustand data is stored at the application-support path; export/import bridges web/native progress.
9. **Desktop-only layout is acceptable.** CSS and native minimum width are 1024px.
10. **The current release target is a personal arm64 Mac.** Build output is thin arm64, update is a local `/Applications` copy, and no public deployment pipeline exists.

### Assumptions requiring validation

- Lessons 6–16 and advanced detectors match the real MPK's messages and comfortable beginner thresholds.
- All-port subscription will not be confused by unrelated or duplicate MIDI sources.
- Chrome and WKWebView audio sound and schedule similarly enough for lessons.
- GarageBand shares the controller cleanly and the user can distinguish its audio from Woodshed.
- The user's Apple Developer enrollment/signing decision remains relevant; the July 14 handoff date is stale.
- Desktop-only web support is intentional rather than an unimplemented responsive requirement.

## 6. Documentation and implementation drift

### README

`README.md:1-32` is still the original React/Vite template. It does not name or explain Woodshed, supported hardware, Chrome/Web MIDI requirements, native setup, persistent data, test/build commands, GarageBand assumptions, install/update workflow, signing limitations or troubleshooting.

### HANDOFF

`HANDOFF.md` is required reading but frozen at July 11/commit `a59e5ce`:

- it claims five lessons and 36 tests (`HANDOFF.md:45-49`);
- it says Lesson 6 is undecided (`:25,35`);
- it treats `a59e5ce` as HEAD (`:8-12`);
- it names a past July 14 Apple enrollment expectation and directs the next agent there first (`:41`).

Current HEAD has 16 lessons, 107 tests, takes, diagnostics and a new update script. The stale handoff can actively misdirect a future agent. `.handoff-auto.md` is newer but untracked and contains only git state.

### Agent instructions

`AGENTS.md` and `CLAUDE.md` share the core commands/rule, but:

- `AGENTS.md` is untracked;
- only `CLAUDE.md:7` contains the crucial toolbar app and `npm run app:update` warning;
- both mandate a rule current lesson content violates;
- `CLAUDE.md:7` implies source provenance should be tied to a commit, but the installer neither requires a clean tree nor embeds/checks a SHA.

### Version/release documentation

Package/native versions differ; there are no tags, changelog, release notes, deployment channel, signed-build procedure, supported macOS/CPU matrix, or artifact provenance record.

### Generated and external workflow references

Tauri schemas and many platform icons are checked in, but their regeneration policy is undocumented. `HANDOFF.md:49` references a Fleetcheck manifest at an absolute path outside the repository; it is not vendored or CI-enforced.

## 7. Safe operating guide for a future agent

1. **Establish state before action.**
   - Run `git status --short --branch`.
   - Read `AGENTS.md`, `CLAUDE.md` and `HANDOFF.md`, but reconcile the handoff against `git log`, current content and tests.
   - Preserve pre-existing untracked `.handoff-auto.md`, `AGENTS.md` and `trader/` unless explicitly asked to manage them.

2. **Protect user state and installed software.**
   - Treat `/Applications/Woodshed.app` and `~/Library/Application Support/com.sterlingdigital.woodshed/store.json` as user data/state.
   - Do not run `npm run app:update`, delete/replace the installed app, reset progress, import data or alter the store without deployment/data authorization.
   - Never call a change “live” until the installed artifact's source provenance is verified.

3. **Respect the curriculum constraint.**
   - New goals should use ranges, relative contrast or stream statistics.
   - Before touching legacy Lessons 1–2, resolve whether named-note teaching is a formally approved exception; as written, it is not.
   - Prefer real MIDI fixtures/diagnostic captures over arbitrary threshold tuning.

4. **Run proportionate verification.**
   - Always: `npm test`, `npm run lint`, `npm run build`.
   - Native changes: Rust fmt, Clippy with `-D warnings`, and Rust tests with `--locked`.
   - Packaging changes: `npm run tauri build`, then strict `codesign`, `spctl`, notarization/stapling checks for both app and DMG.
   - Treat lint warnings and zero Rust tests as gaps even when commands exit 0.

5. **Coordinate generated artifacts across agents.**
   - All agents share `dist/` and `src-tauri/target/`.
   - Do not run Tauri builds concurrently.
   - `npm run tauri build -- --bundles dmg` cleans the staged `bundle/macos/Woodshed.app`; restore it with an app build if both artifacts are needed.

6. **Do not use the current installer for signed releases.**
   - `app:update` is only a local ad-hoc installer.
   - Once Developer ID signing exists, its forced ad-hoc signing must be removed or gated.
   - Use staged copy, validation, atomic swap and rollback before any automated `/Applications` update.

7. **Be explicit about uncertainty.**
   - Passing synthetic detector tests does not verify real hardware.
   - A successful Tauri build does not verify Gatekeeper distribution.
   - Offline npm audit does not verify current advisories.
   - GarageBand confirmation is instructional/self-reported, not integrated.

## 8. Prioritized action plan

### Critical — address before calling the product reliable/distributable

1. **Add audio/MIDI panic lifecycle handling.**
   - Implement `allNotesOff`.
   - Invoke on port disconnect, demo transitions, window blur/page hide, unmount, pointer cancel and lost capture.
   - Clear held-key state and add integration tests.

2. **Version and deeply validate all persisted/imported data.**
   - Define a schema for lesson progress, profile, 8×16 boolean pattern, takes and diagnostics.
   - Validate before mutation and repair/quarantine invalid hydrated state.
   - Add migration tests and native corruption recovery.

3. **Reconcile the lesson-goal rule.**
   - Replace absolute velocity gates with self-calibrating contrasts/ranges.
   - Replace exact pitch gates with relative shapes/ranges, or document narrowly approved pedagogical exceptions.
   - Apply the regression guard to all 16 lessons.

4. **Complete native signing/notarization.**
   - Configure Developer ID signing and notarization through environment/secure CI.
   - Make the app inside the DMG and the DMG itself pass strict signing, Gatekeeper and stapling checks.
   - Decide arm64-only versus universal/Intel support.

5. **Replace the unsafe installer path.**
   - Stage and verify a new app, retain backup, atomically swap, roll back on failure.
   - Never overwrite a real signature with ad-hoc signing.

6. **Refresh canonical documentation immediately.**
   - Replace the template README.
   - Rewrite/retire stale HANDOFF.
   - Track one canonical AGENTS instruction source and synchronize the toolbar/deployment warning.

### Near-term — stabilize the product and development workflow

1. Add CI/`npm run verify` covering `npm ci`, tests, warning-free lint, build, Rust fmt/Clippy/tests, live npm and Rust advisory scans, and packaging checks.
2. Add Rust tests for store read/write/remove, corrupt JSON, atomic replacement, filename sanitization, concurrent access and MIDI lifecycle.
3. Add component/browser integration tests for navigation, import/export, hydration, Web MIDI state changes, Tauri events/invokes, pointer cancellation, accessibility and recording/playback.
4. Add a DAW/mute mode and rewrite GarageBand checks so Woodshed audio cannot masquerade as GarageBand.
5. Carry MIDI port identity end-to-end; group approved MPK interfaces while preserving split-port support.
6. Fix synth labels/preset synchronization and decide mappings for knobs 5–8.
7. Move beat persistence to `woodshedStorage` with migration.
8. Fix recorder cap notification, take duration, playback cursor/scheduling and retention UX.
9. Cancel lesson timers and restore global synth parameters on cleanup.
10. Set a restrictive production CSP and security-review custom invokes.
11. Enable TypeScript strictness incrementally and make lint warnings fail.
12. Align package/native names and versions; pin Node/npm/Rust toolchains and document `npm ci`.

### Optional improvements

1. Add a responsive layout, or explicitly document desktop-only web support.
2. Make SVG controls genuinely keyboard-operable and implement proper ARIA tabs.
3. Add file-picker import/export, collision-safe filenames and optional take/diagnostic export.
4. Split detector reducers, curriculum content and global CSS into reviewable modules.
5. Window/cap detector histories and avoid state updates for irrelevant events; profile high-rate streams.
6. Import Latin-only fonts and remove dormant helpers/assets (`mpkmini4.webp`, `isPlaying`, test-only timing duplication, unused delay input/compact mode) where no longer intended.
7. Add coverage thresholds, hardware replay fixtures, browser audio/MIDI smoke tests and an optional Tauri updater only if distribution beyond the current local machine is desired.
8. Document/regenerate Tauri schemas intentionally and add dependency-update automation.

## Final status

The project's core product is real and the happy-path codebase is healthier than its documentation suggests: 16 lessons, 107 passing tests, green web/native builds, and a rendered UI with no smoke-test console errors. The dominant risks are not basic compilation. They are lifecycle correctness, untrusted local data handling, hardware/external-app verification, unsigned distribution, and workflow/documentation drift.

The safest next sequence is: fix stuck-note and schema failures; resolve the curriculum-rule contradiction; refresh the README/handoff; add native/integration tests and CI; then make signing, notarization and installation transactional before distributing another DMG.
