# Hardware and GarageBand QA

Automated tests use synthetic MIDI messages. They do not prove that a physical MPK, a particular macOS MIDI driver, WKWebView audio, or GarageBand behaves as expected.

Record the date, Mac model/macOS version, MPK model/firmware, connection type, Woodshed build SHA, and all MIDI port names for every run.

## MPK pass

1. Start with Woodshed audio at a safe volume. Hold a key, disconnect the MPK, and confirm the sound stops and the on-screen key releases.
2. Reconnect it. Verify keys, pads, all eight knobs, pitch and mod on every MPK-labelled port. Confirm unrelated virtual MIDI does not complete a lesson while an MPK port is present.
3. Recalibrate pads and knobs separately. Confirm traffic from a second source cannot interrupt either eight-control capture.
4. Run Lessons 5–7 with ARP, LATCH, CHORDS, SCALES, and NOTE REPEAT. Export diagnostics for any gate that misses or completes incorrectly; do not tune thresholds without a captured stream.
5. Record past the event cap and, separately, stop a short one-note take. Confirm the cap message, playback release, cancellation, rename, delete confirmation, and oldest-take notice.
6. Corrupt only a disposable copy of native `store.json`, start the app, and confirm a timestamped `store.corrupt-*.json` is preserved before new data is saved.

## GarageBand pass

1. Enter Lesson 8 and confirm the “GarageBand monitor mode” notice is visible.
2. With GarageBand closed, play keys and pads. Woodshed must remain silent.
3. Open GarageBand and select a Software Instrument track. Confirm audio comes only from GarageBand, then complete the lesson.
4. Repeat the isolation check in Lesson 16. Export and play the finished file outside GarageBand before self-confirming the final step.

Mark these checks verified only with an actual dated run. Source review or synthetic MIDI is not hardware or GarageBand evidence.
