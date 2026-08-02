# Woodshed — session handoff

Self-contained resume file. A fresh session with none of the prior chat should be able to
continue from this alone. Every line is tagged **VERIFIED** (checked against the repo/commands
this session) or **ASSUMED** (from conversation, not re-verified). Reconcile against
`git status`, `git log`, and `npm run verify` before acting.

Repo root: `/Users/sterlingdigital/akai` · GitHub: `sterlingdigitalp/akai` (public, default branch `main`).

## 1 · Date & branch

- Written **2026-08-01** (`date` → 2026-08-01 CDT). — VERIFIED
- Branch `main`, in sync with `origin/main` (`## main...origin/main`, nothing ahead/behind). — VERIFIED
- Working tree clean except two intentionally-excluded untracked paths: `.handoff-auto.md` (auto git snapshot) and `trader/.entry_combo_tmp.py` (unrelated trading script — workspace cruft, never commit it). — VERIFIED
- HEAD = `4871f5d` "Make Lesson 3's beat steps feel like you made something". — VERIFIED

## 2 · What Woodshed is (for a cold reader)

- Desktop-first, local-first interactive trainer for Sterling's **Akai MPK mini 4** (new-gen: pitch/mod wheels, 8 pads, 8 knobs). 16-lesson curriculum. — VERIFIED (`src/lessons/content.ts`)
- **Sterling runs the native toolbar app `/Applications/Woodshed.app`, NOT the dev server.** It does not hot-reload; committed changes only reach him after `npm run app:update` (transactional rebuild + reinstall + ad-hoc re-sign). If he reports seeing "old" behaviour, suspect a stale build first — this bit us hard this session (he was on a 13-day-old build for the whole prior conversation). — VERIFIED (`CLAUDE.md`, `scripts/update-app.sh`)
- Native data (progress, calibration, takes, diagnostics) persists in `~/Library/Application Support/com.sterlingdigital.woodshed/store.json` and survives rebuilds; never wipe it. — VERIFIED
- Web dev: `npm run dev` → :5173 (Chrome only, Web MIDI). Verify: `npm run verify` (web: tests + `oxlint --deny-warnings` + build; native: cargo fmt / clippy -D warnings / tests). 115 web tests + 5 Rust tests pass at HEAD. — VERIFIED
- **Hard curriculum rule:** lesson gates use ranges/contrasts/stream statistics — never exact pitches or absolute velocities. Enforced across all 16 lessons by `src/tests/lessonContent.test.ts`. — VERIFIED
- **Product north star** (drives all lesson copy): reveal each ability with wonder in plain language *before* the mechanics; no music-theory jargon. Path ultimately prepares Sterling to make music in **Marbleton** (`~/marbleton`), his own DAW; GarageBand (lessons 08/16) is the training studio. Cadence ≈ 30 min/day, ~4 lessons. Fuller context in the memory files under `/Users/sterlingdigital/.claude/projects/-Users-sterlingdigital-akai/memory/`. — ASSUMED (chat + memory)

## 3 · Not-yet-deployed changes

- **App rebuild ran at write time.** `npm run app:update` was launched to install commits `e9f10a7` (sticky octave view) + `4871f5d` (Lesson 3 beat feel) over the previously-installed `b54d336`; it exited 0. **On reopen, confirm:** `/Applications/Woodshed.app/Contents/Resources/build-provenance.json` should show `"commit": "4871f5d…"` and `codesign --verify --deep --strict /Applications/Woodshed.app` should pass. If the SHA is older, re-run `npm run app:update`. — VERIFIED (launched, exit 0) / ASSUMED (final provenance not re-read after this file was written)
- **No uncommitted source edits; everything is committed and pushed.** — VERIFIED

## 4 · This session's commits (newest first, all pushed)

- `4871f5d` Lesson 3 beat: grid cells play their drum as you place them; "Let it roll" loops the grid the user actually built (2 bars, falls back to the taught pattern if empty); Play button stays on the play step. — VERIFIED
- `e9f10a7` On-screen octave view now sticky (slides once to follow the hand, never snaps back) — fixed the "layout rejiggers" complaint during OCT±. — VERIFIED
- `b54d336` Master volume taken off the hardware knobs (fixed 0.82) — an unlabeled knob was near-muting the app during calibration. — VERIFIED
- `2ee14bd` Implemented the `REPOSITORY_AUDIT.md` plan: panic/allNotesOff lifecycle, deep schema validation (`src/state/dataSchema.ts`), lesson rule across all 16, transactional installer, fail-closed signing path, CI, Rust tests, DAW audio-mute, port identity, docs. — VERIFIED
- `f2d9aa8` Reframed all 16 lessons to the wonder-first voice. — VERIFIED
- Also this arc: `52287da` hardware-playthrough fixes + L1 reframe, `1bd60ab` lesson MIDI diagnostics capture, `eb113c4` takes recorder, `dbccbd6`/`e168450` lessons 09–16. — VERIFIED (`git log`)

## 5 · Backlog (ranked; discussed but NOT built)

1. **Analyse diagnostics from real play.** Lessons 1–3 were played on hardware this session on a build that HAS the capture, so per-step raw MIDI + skip signals are in `store.json`. Next session, have Sterling do **Settings → Developer details → Copy diagnostics** and paste it — this is the ground truth that unblocks item 2. — VERIFIED (capture exists) / ASSUMED (captured cleanly)
2. **Lessons 17+ on the arp "loop engine" (PATTERN / EDIT / MUTATE / FREEZE / SWING).** The MPK mini 4 has **no onboard looper or step sequencer** (that's the mini *Plus*); its arpeggiator Pattern system IS the generative loop. Research (checked against the official user guide) found: FREEZE emits a second stream on a **non-key MIDI channel** → `src/midi/profile.ts` `classify()` must be widened to see it before a FREEZE lesson can detect anything; **SWING above ~68–70% breaks the `stream`/`repeat` CV<0.4 threshold** and swing also applies to Note Repeat → can silently wall Lesson 07; **SYNC=external with no clock is undetectable → must be a `confirm` step**; ARP+key/knob shortcuts are almost certainly not transmitted. Do the sniff (item 1) before writing detectors. Touches `content.ts`, `engine.ts`, `profile.ts`. — ASSUMED (chat research)
3. **Signing/notarization EXECUTION.** Fail-closed path built (`scripts/package-release.sh`, `docs/RELEASING.md`, `npm run release:mac`); needs Sterling's Apple creds (`APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) via env. DMG is unsigned/ad-hoc until then. — VERIFIED (path exists) / blocked on creds
4. **Physical MPK + GarageBand QA** — run `docs/HARDWARE_QA.md`; only Sterling can. — VERIFIED (doc exists)
5. **Browser/component integration test suite (audit N3)** — not built, deliberately not ballooned; scope decision. Touches `src/tests/`. — VERIFIED (absent)
6. **Pad-calibration nudge** — a pad/knob step receiving zero input should prompt "calibrate your pads" instead of sitting silent (Sterling hit this by skipping Lesson 1 calibration). Touches `src/views/Lesson.tsx`. — ASSUMED (chat)
7. **Native MIDI connect-by-index race** (`src-tauri/src/midi.rs`, `ports().nth(index)`) can bind the wrong device if port order shifts; deliberately not patched blind (no hardware to test). — VERIFIED (code) / ASSUMED (impact)
8. **In-app "here's what you made" moments** — takes recorder exists (`src/audio/recorder.ts`, Playground → Takes); not yet wired into lesson endings. — VERIFIED (recorder exists)

## 6 · Open decisions (waiting on Sterling)

1. **Provide Apple Developer credentials** when available (backlog 3). — ASSUMED
2. **Build the N3 integration suite, or defer?** (backlog 5). — ASSUMED
3. arm64-only vs universal: **DECIDED — arm64-only** (his Mac is Apple Silicon; ~15-min build-flag change to revisit if ever distributing to Intel). — VERIFIED (`uname -m` = arm64 + chat decision)

## 7 · Resume here

**First action on reopen:** confirm the `app:update` from this session installed cleanly — check `/Applications/Woodshed.app/Contents/Resources/build-provenance.json` shows `"commit": "4871f5d…"` and `codesign --verify --deep --strict /Applications/Woodshed.app` passes. If not, re-run `npm run app:update`.

**Then, Sterling's next ~30-min cycle:** he wants to move on to a new lesson (he's completed roughly Lessons 1–3). Point him at **Lesson 4 (Shape your own sound)** and onward into the hardware-heavy **Lessons 5–7** (arpeggiator, CHORDS/SCALES, NOTE REPEAT) — where fresh diagnostics matter most. Ask him to **Copy diagnostics** at the end so backlog 1–2 can proceed. Every step keeps "Skip for now"; a skip on a detector step is the strongest signal that a gate walled him.
