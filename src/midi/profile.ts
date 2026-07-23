import type { ControlEvent } from './types'
import type { ParsedMidiMessage } from './parser'

export type DeviceProfile = {
  padNotes: number[]
  padChannel: number
  knobCCs: number[]
  keyChannel: number
  pitchIsBend: boolean
  modCC: number
}

export const DEFAULT_PROFILE: DeviceProfile = {
  padNotes: [36, 37, 38, 39, 40, 41, 42, 43],
  padChannel: 9,
  knobCCs: [70, 71, 72, 73, 74, 75, 76, 77],
  keyChannel: 0,
  pitchIsBend: true,
  modCC: 1,
}

// Pads on banks B-D send notes above the mapped bank, so fold them back onto the eight
// on-screen pads rather than dropping them and leaving the user with a dead controller.
function padIndex(note: number, padNotes: number[]) {
  const direct = padNotes.indexOf(note)
  if (direct >= 0) return direct
  const base = padNotes[0]
  if (base === undefined) return -1
  const offset = note - base
  return offset > 0 && offset < 32 ? offset % 8 : -1
}

export function classify(message: ParsedMidiMessage, profile: DeviceProfile, ts = performance.now()): ControlEvent | null {
  if (message.type === 'noteOn' || message.type === 'noteOff') {
    const pad = message.channel === profile.padChannel ? padIndex(message.note, profile.padNotes) : -1
    if (pad >= 0) return { kind: 'pad', index: pad, value: message.velocity / 127, on: message.type === 'noteOn', channel: message.channel, ts, source: 'hardware' }
    if (message.channel === profile.keyChannel) return { kind: 'key', index: message.note, value: message.velocity / 127, on: message.type === 'noteOn', channel: message.channel, ts, source: 'hardware' }
  }
  if (message.type === 'cc') {
    const knob = profile.knobCCs.indexOf(message.controller)
    if (knob >= 0) return { kind: 'knob', index: knob, value: message.value / 127, channel: message.channel, ts, source: 'hardware' }
    if (message.controller === profile.modCC) return { kind: 'mod', index: 0, value: message.value / 127, channel: message.channel, ts, source: 'hardware' }
  }
  if (message.type === 'pitchBend' && profile.pitchIsBend) return { kind: 'pitch', index: 0, value: message.value / 16383, channel: message.channel, ts, source: 'hardware' }
  return null
}
