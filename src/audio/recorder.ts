import { emitControl, subscribeControls } from '../midi/midi'
import type { ControlKind } from '../midi/types'

export type TakeEvent = { kind: ControlKind; index: number; value: number; on?: boolean; t: number }
export type Take = { id: string; name: string; createdAt: string; durationMs: number; events: TakeEvent[] }

export const MAX_TAKE_MS = 180000
export const MAX_TAKE_EVENTS = 4000

let unsubscribe: (() => void) | null = null
let buffer: TakeEvent[] = []
let startTs: number | null = null

export function isRecording() { return unsubscribe !== null }
// null until the first note arrives — a take starts when you start playing, not when you arm it
export function recordingElapsedMs() { return startTs === null ? null : performance.now() - startTs }

export function startRecording() {
  if (unsubscribe) return
  buffer = []; startTs = null
  unsubscribe = subscribeControls((event) => {
    if (event.source === 'replay') return
    if (startTs === null) startTs = event.ts
    const t = event.ts - startTs
    if (t > MAX_TAKE_MS || buffer.length >= MAX_TAKE_EVENTS) { unsubscribe?.(); unsubscribe = null; return }
    buffer.push({ kind: event.kind, index: event.index, value: event.value, on: event.on, t })
  })
}

export function stopRecording(name: string): Take | null {
  unsubscribe?.(); unsubscribe = null
  if (!buffer.length) return null
  const take: Take = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), durationMs: buffer[buffer.length - 1]!.t, events: buffer }
  buffer = []; startTs = null
  return take
}

export function dueEvents(events: TakeEvent[], fromMs: number, toMs: number): TakeEvent[] {
  return events.filter((event) => event.t > fromMs && event.t <= toMs).sort((a, b) => a.t - b.t)
}

let playHandle: number | null = null
let playHeld: Set<number> | null = null

function releaseHeld() {
  if (!playHeld) return
  playHeld.forEach((index) => emitControl({ kind: 'key', index, value: 0, on: false, channel: 0, ts: performance.now(), source: 'replay' }))
  playHeld = null
}

export function isPlaying() { return playHandle !== null }

function stopPlayback() {
  if (playHandle !== null) { cancelAnimationFrame(playHandle); playHandle = null }
  releaseHeld()
}

export function playTake(take: Take, onEnd: () => void): () => void {
  stopPlayback()
  const held = new Set<number>(); playHeld = held
  const start = performance.now()
  let cursor = -1
  const tick = () => {
    const elapsed = performance.now() - start
    dueEvents(take.events, cursor, elapsed).forEach((event) => {
      if (event.kind === 'key') { if (event.on) held.add(event.index); else held.delete(event.index) }
      emitControl({ kind: event.kind, index: event.index, value: event.value, on: event.on, channel: 0, ts: performance.now(), source: 'replay' })
    })
    cursor = elapsed
    if (elapsed >= take.durationMs) { stopPlayback(); onEnd(); return }
    playHandle = requestAnimationFrame(tick)
  }
  playHandle = requestAnimationFrame(tick)
  return stopPlayback
}
