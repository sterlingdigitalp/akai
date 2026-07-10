export type ParsedMidiMessage =
  | { type: 'noteOn'; channel: number; note: number; velocity: number }
  | { type: 'noteOff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number }
  | { type: 'pitchBend'; channel: number; value: number }

export function parseMidi(data: ArrayLike<number>): ParsedMidiMessage | null {
  if (data.length < 3) return null
  const status = data[0] ?? 0
  const type = status & 0xf0
  const channel = status & 0x0f
  const a = (data[1] ?? 0) & 0x7f
  const b = (data[2] ?? 0) & 0x7f
  if (type === 0x90) return b === 0 ? { type: 'noteOff', channel, note: a, velocity: 0 } : { type: 'noteOn', channel, note: a, velocity: b }
  if (type === 0x80) return { type: 'noteOff', channel, note: a, velocity: b }
  if (type === 0xb0) return { type: 'cc', channel, controller: a, value: b }
  if (type === 0xe0) return { type: 'pitchBend', channel, value: (b << 7) | a }
  return null
}
