export type ControlKind = 'key' | 'pad' | 'knob' | 'pitch' | 'mod'

export type ControlEvent = {
  kind: ControlKind
  index: number
  value: number
  on?: boolean
  channel: number
  ts: number
  source: 'hardware' | 'demo' | 'replay'
}
