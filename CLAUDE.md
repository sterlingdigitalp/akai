# Woodshed (akai)

On session start, read HANDOFF.md if present for prior-session state.

Interactive trainer for Sterling's Akai MPK mini. Web (Chrome-only, Web MIDI): `npm run dev` → :5173. Native mac app (Tauri, Rust midir bridge): `npm run tauri dev` (:1420) / `npm run tauri build`. Tests: `npx vitest run`. Lesson goals must use ranges/contrasts/stream stats — never exact pitches or absolute velocities.
