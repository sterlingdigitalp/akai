import { emitControl } from './midi'
import type { ControlEvent, ControlKind } from './types'

export function demoControl(kind: ControlKind, index: number, value: number, on?: boolean) {
  const event: ControlEvent = { kind, index, value: Math.max(0, Math.min(1, value)), on, channel: kind === 'pad' ? 9 : 0, ts: performance.now(), source: 'demo' }
  emitControl(event)
  return event
}
