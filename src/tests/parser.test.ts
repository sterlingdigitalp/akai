import { describe, expect, it } from 'vitest'
import { parseMidi } from '../midi/parser'

describe('parseMidi', () => {
  it('parses note on and its channel', () => expect(parseMidi([0x92, 60, 100])).toEqual({ type: 'noteOn', channel: 2, note: 60, velocity: 100 }))
  it('treats a zero-velocity note on as note off', () => expect(parseMidi([0x90, 64, 0])).toEqual({ type: 'noteOff', channel: 0, note: 64, velocity: 0 }))
  it('parses explicit note off', () => expect(parseMidi([0x89, 36, 55])).toEqual({ type: 'noteOff', channel: 9, note: 36, velocity: 55 }))
  it('parses control change', () => expect(parseMidi([0xb0, 70, 127])).toEqual({ type: 'cc', channel: 0, controller: 70, value: 127 }))
  it('combines pitch bend bytes in little-endian MIDI order', () => expect(parseMidi([0xe0, 0, 64])).toEqual({ type: 'pitchBend', channel: 0, value: 8192 }))
  it('ignores unsupported and incomplete messages', () => { expect(parseMidi([0xc0, 1, 2])).toBeNull(); expect(parseMidi([0x90, 60])).toBeNull() })
})
