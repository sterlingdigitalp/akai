# Woodshed (akai)

On session start, read HANDOFF.md if present for prior-session state.

Interactive trainer for Sterling's Akai MPK mini. Web (Chrome-only, Web MIDI): `npm run dev` → :5173. Native mac app (Tauri, Rust midir bridge): `npm run tauri dev` (:1420) / `npm run tauri build`. Tests: `npx vitest run`. Lesson goals must use ranges/contrasts/stream stats — never exact pitches or absolute velocities.

**Sterling runs the native app from his toolbar (`/Applications/Woodshed.app`), NOT the dev server.** Source changes are not live there. `npm run app:update` mutates the installed app, so run it only when installation is intended; it verifies, stages, validates, swaps, and rolls back on failure. Never call a change live without verifying the embedded build SHA. Preserve `~/Library/Application Support/com.sterlingdigital.woodshed/store.json`. Public releases must use the fail-closed signing/notarization process in `docs/RELEASING.md`; an unsigned Tauri build is not distribution evidence.
