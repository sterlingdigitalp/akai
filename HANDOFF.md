# Woodshed — Session Handoff

Self-contained state file. A fresh session should be able to resume from this alone.
Repo: `/Users/sterlingdigital/akai` · GitHub: https://github.com/sterlingdigitalp/akai

## 1 · Date & branch

- Written **2026-07-11**. — VERIFIED
- Branch `main`, clean tree, in sync with `origin/main` (`## main...origin/main`, no changes). — VERIFIED
- Head: `a59e5ce` "Lesson 2: octave travel by range, not exact pitch". Full arc this session:
  `f791fd3` v1 app → `83b323d`/`ff8f965`/`1870313` device fidelity → `ab72c25` multi-port MIDI + never-dead-end → `889c39d` Lesson 05 (arpeggiator) → `1475e1c` **Tauri mac app** → `96e4e82`/`a59e5ce` step-design fixes. — VERIFIED (`git log`)

## 2 · Not-yet-deployed changes

- **None.** Working tree clean; everything is committed and pushed. — VERIFIED
- The running `Woodshed.app` (process was alive at write time) and the DMG at
  `/Users/sterlingdigital/akai/src-tauri/target/release/bundle/dmg/Woodshed_0.1.0_aarch64.dmg`
  were rebuilt and relaunched this session AFTER the final code change; content matches `a59e5ce`. — VERIFIED (rebuild + relaunch ran in-session; 36/36 vitest, web build green)
- Bundles are **unsigned** (ad-hoc) — signing intentionally deferred, see §4. — VERIFIED (no signing config in `src-tauri/tauri.conf.json`)

## 3 · Feature / update backlog (ranked)

1. **Code-sign + notarize the mac app** — Apple Developer enrollment (BUSINESS Apple ID, D-U-N-S in hand) expected **2026-07-14**; wire `APPLE_SIGNING_IDENTITY` / Team ID / notarytool creds as env vars at build time, no code changes planned. Touches: build environment, possibly `src-tauri/tauri.conf.json`. — ASSUMED (chat; enrollment date is the user's estimate)
2. **Lesson 05 hardware QA** — the arp stream-detectors (median-interval 100–500ms, CV<.4, span/direction/density) have never met the real arpeggiator. User to run L5 in-app; tune thresholds on report. Touches: `src/lessons/engine.ts`, `src/lessons/content.ts`. — ASSUMED (untested claim is from chat; thresholds themselves VERIFIED in code)
3. **Lesson 06 — direction undecided** (see §4). Candidate A: hardware CHORDS/SCALES pad modes (printed above pads 5–8). Candidate B: GarageBand/DAW integration (user's original goal). Touches: `src/lessons/content.ts` (+ new detectors in `engine.ts` if A). — ASSUMED
4. **Move beat-playground pattern into the file store** — pattern still uses raw `localStorage` (`src/views/Playground.tsx:13,25`) while progress/profile use the Tauri-aware adapter (`src/state/storage.ts`); in-app patterns live only in WKWebView storage. Touches: `Playground.tsx`. — VERIFIED
5. **Map knobs 5–8 in the synth** — AudioBridge maps only knobs 1–4 (`src/App.tsx:17`, cutoff/resonance/release/delaySend). Candidates for 5–8: attack, master volume, delay time, drive. Touches: `App.tsx`, `src/audio/synth.ts`. — VERIFIED
6. **L3 timing-feel review** — beat-lesson tolerance is ±130ms at 90 BPM (`src/lessons/content.ts` timing goals); user feedback on real pads never arrived. Touches: `content.ts`. — VERIFIED (values) / ASSUMED (feedback still pending)
7. **Relative-contrast velocity goals** — if any velocity threshold walls the user again, replace absolute bars with "noticeably harder than your soft note" self-calibrating goals. Design rule (learned from two real walls): **ranges/contrasts/stream stats, never exact pitches or absolute velocities**. Touches: `engine.ts`, `content.ts`. — ASSUMED (rule from chat; the two walls' fixes are commits `96e4e82`, `a59e5ce`)
8. **WKWebView audio-quirk watch** — app audio = Safari engine; synth/drums unverified-by-ear vs Chrome. Touches: `src/audio/*` if anything sounds off. — ASSUMED
9. **Icon motif reserve** — "First Note" concept (lit key + arc) parked for a future streak widget/DMG art; comparison sheet at `/Users/sterlingdigital/Desktop/woodshed-icons/icon-ideas.png`. — VERIFIED (file exists)

## 4 · Open decisions (waiting on Sterling)

1. **Lesson 06: CHORDS/SCALES pad modes, or GarageBand integration first?** (pick one)
2. **After enrollment lands: provide Apple Team ID + Developer ID cert access** so signing env vars can be wired. (yes/when)
3. **Did you migrate Chrome progress into the app?** (Settings → Your data: export in Chrome, import in app). If browser progress no longer matters, this closes as N/A. (yes/no)

## 5 · Resume here

**First action on reopen:** ask Sterling whether Apple Developer enrollment completed (expected 2026-07-14). If yes → wire signing: set `APPLE_SIGNING_IDENTITY` (Developer ID Application cert) + notarytool credentials in the build env, run `npm run tauri build` in `/Users/sterlingdigital/akai`, verify with `codesign -dv --verbose=2` on the bundle and `spctl -a -t open --context context:primary-signature` on the DMG. If no → run backlog #2 (Lesson 05 hardware QA) instead.

## Operating context (for a fresh session)

- App: "Woodshed" — teaches Sterling (beginner) his Akai MPK mini (new-gen: pitch/mod wheels, pads 1–4 bottom row, knobs right) via 5 interactive lessons + beat playground. All 5 lessons + calibration verified on real hardware.
- Web: `npm run dev` (port 5173; Chrome only — Web MIDI). Native: `npm run tauri dev` (pinned port 1420) / `npm run tauri build`. Tests: `npx vitest run` (36 pass). — VERIFIED
- MIDI: hardware sends on MULTIPLE USB ports (knobs on the DAW/remote port) — web subscribes to all inputs, app uses Rust `midir` bridge (`src-tauri/src/midi.rs`) polling ports every 2s. — VERIFIED (code)
- Persistence: app → `~/Library/Application Support/com.sterlingdigital.woodshed/store.json` (exists; atomic writes); web → localStorage (per-origin — per-PORT on localhost). — VERIFIED
- Smoke tests: fleetcheck manifest `/Users/sterlingdigital/fleetcheck/apps/woodshed.yaml` (4 journeys) — run `node dist/cli.js run --app woodshed --target local --base-url <url>` from `/Users/sterlingdigital/fleetcheck` against a served build. — VERIFIED (file exists)
- Delegation style this repo was built with: codex-first (specs → Codex implements → orchestrator reviews/verifies); Codex sandbox has no network — orchestrator runs installs/cargo. — ASSUMED (workflow note)
