export type ControlKind = 'key' | 'pad' | 'knob' | 'joyX' | 'joyY'

export type ControlEvent = {
  kind: ControlKind
  index: number
  value: number
  on?: boolean
  channel: number
  ts: number
  source: 'hardware' | 'demo'
}
