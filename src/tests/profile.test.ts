import { describe, expect, it } from 'vitest'
import { classify, DEFAULT_PROFILE } from '../midi/profile'

describe('classify', () => {
  it('maps configured pad notes before keys', () => expect(classify({ type: 'noteOn', channel: 9, note: 38, velocity: 100 }, DEFAULT_PROFILE, 1)).toMatchObject({ kind: 'pad', index: 2, on: true, source: 'hardware' }))
  it('maps key-channel notes and releases', () => expect(classify({ type: 'noteOff', channel: 0, note: 60, velocity: 12 }, DEFAULT_PROFILE, 2)).toMatchObject({ kind: 'key', index: 60, on: false }))
  it('maps configured knob CCs', () => expect(classify({ type: 'cc', channel: 0, controller: 74, value: 64 }, DEFAULT_PROFILE, 1)).toMatchObject({ kind: 'knob', index: 4 }))
  it('names the mod CC and pitch-bend controls', () => { expect(classify({ type: 'cc', channel: 0, controller: 1, value: 127 }, DEFAULT_PROFILE, 1)).toMatchObject({ kind: 'mod', value: 1 }); expect(classify({ type: 'pitchBend', channel: 0, value: 8192 }, DEFAULT_PROFILE, 1)).toMatchObject({ kind: 'pitch' }) })
  it('returns null for unmapped messages', () => expect(classify({ type: 'cc', channel: 0, controller: 22, value: 1 }, DEFAULT_PROFILE, 1)).toBeNull())
})
