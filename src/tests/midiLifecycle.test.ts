import { afterEach, describe, expect, it } from 'vitest'
import { panicMidi, receiveMidiBytes, subscribeControls } from '../midi/midi'
import { useMidiStore } from '../state/midiStore'

afterEach(() => {
  panicMidi()
})

describe('MIDI lifecycle safety', () => {
  it('carries source-port identity into normalized events', () => {
    let observedPort = ''
    const unsubscribe = subscribeControls((event) => { observedPort = event.port ?? '' })
    receiveMidiBytes([0x90, 60, 100], 'web:MPK mini')
    unsubscribe()
    expect(observedPort).toBe('web:MPK mini')
  })

  it('panic clears held keys, pad flash, and wheel state', () => {
    receiveMidiBytes([0x90, 60, 100], 'MPK')
    useMidiStore.getState().receive({ kind: 'pad', index: 2, value: .8, on: true, channel: 9, ts: 1, source: 'demo' })
    useMidiStore.getState().receive({ kind: 'pitch', index: 0, value: .9, channel: 0, ts: 2, source: 'demo' })
    panicMidi()
    const state = useMidiStore.getState()
    expect([...state.heldKeys]).toEqual([])
    expect(state.padFlash).toBeNull()
    expect(state.wheels).toEqual({ pitch: .5, mod: 0 })
  })
})
