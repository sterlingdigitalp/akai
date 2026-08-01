import { emitControl, subscribeControls } from '../midi/midi'
import type { ControlKind } from '../midi/types'

export type TakeEvent = { kind: ControlKind; index: number; value: number; on?: boolean; t: number }
export type Take = { id: string; name: string; createdAt: string; durationMs: number; events: TakeEvent[] }

export const MAX_TAKE_MS = 180000
export const MAX_TAKE_EVENTS = 4000

let unsubscribe: (() => void) | null = null
let buffer: TakeEvent[] = []
let startTs: number | null = null
let autoStop: ((reason: 'time-limit' | 'event-limit') => void) | null = null

export function isRecording() { return unsubscribe !== null }
// null until the first note arrives — a take starts when you start playing, not when you arm it
export function recordingElapsedMs() { return startTs === null ? null : performance.now() - startTs }

export function startRecording(onAutoStop?: (reason: 'time-limit' | 'event-limit') => void) {
  if (unsubscribe) return
  buffer = []; startTs = null; autoStop = onAutoStop ?? null
  unsubscribe = subscribeControls((event) => {
    if (event.source === 'replay') return
    if (startTs === null) startTs = event.ts
    const t = event.ts - startTs
    if (t > MAX_TAKE_MS || buffer.length >= MAX_TAKE_EVENTS) {
      const reason = t > MAX_TAKE_MS ? 'time-limit' : 'event-limit'
      unsubscribe?.(); unsubscribe = null
      const callback = autoStop; autoStop = null
      callback?.(reason)
      return
    }
    buffer.push({ kind: event.kind, index: event.index, value: event.value, on: event.on, t })
  })
}

export function stopRecording(name: string): Take | null {
  unsubscribe?.(); unsubscribe = null; autoStop = null
  if (!buffer.length) return null
  const durationMs = Math.max(250, buffer[buffer.length - 1]!.t)
  const take: Take = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), durationMs, events: buffer }
  buffer = []; startTs = null
  return take
}

let playHandle: number | null = null
let playHeld: Set<number> | null = null

function releaseHeld() {
  if (!playHeld) return
  playHeld.forEach((index) => emitControl({ kind: 'key', index, value: 0, on: false, channel: 0, ts: performance.now(), source: 'replay' }))
  playHeld = null
}

export function stopPlayback() {
  if (playHandle !== null) { cancelAnimationFrame(playHandle); playHandle = null }
  releaseHeld()
}

export function playTake(take: Take, onEnd: () => void): () => void {
  stopPlayback()
  const held = new Set<number>(); playHeld = held
  const start = performance.now()
  const events = [...take.events].sort((a, b) => a.t - b.t)
  let cursor = 0
  const tick = () => {
    const elapsed = performance.now() - start
    while (cursor < events.length && events[cursor]!.t <= elapsed) {
      const event = events[cursor++]!
      if (event.kind === 'key') { if (event.on) held.add(event.index); else held.delete(event.index) }
      emitControl({ kind: event.kind, index: event.index, value: event.value, on: event.on, channel: 0, ts: performance.now(), source: 'replay' })
    }
    if (elapsed >= take.durationMs) { stopPlayback(); onEnd(); return }
    playHandle = requestAnimationFrame(tick)
  }
  playHandle = requestAnimationFrame(tick)
  return stopPlayback
}
