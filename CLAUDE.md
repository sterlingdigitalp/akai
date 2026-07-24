# Woodshed (akai)

On session start, read HANDOFF.md if present for prior-session state.

Interactive trainer for Sterling's Akai MPK mini. Web (Chrome-only, Web MIDI): `npm run dev` → :5173. Native mac app (Tauri, Rust midir bridge): `npm run tauri dev` (:1420) / `npm run tauri build`. Tests: `npx vitest run`. Lesson goals must use ranges/contrasts/stream stats — never exact pitches or absolute velocities.

**Sterling runs the native app from his toolbar (`/Applications/Woodshed.app`), NOT the dev server** — it does not hot-reload, so after committing user-facing changes rebuild + reinstall it with `npm run app:update`. Never call a change "live" for him without that. Progress, calibration, and diagnostics persist in `~/Library/Application Support/com.sterlingdigital.woodshed/store.json` across rebuilds.
