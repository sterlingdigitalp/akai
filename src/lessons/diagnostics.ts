import { subscribeRawBytes } from '../midi/midi'
import { classify } from '../midi/profile'
import type { ParsedMidiMessage } from '../midi/parser'
import { useProfileStore } from '../state/profileStore'
import { useDiagnosticsStore, type RawCapture, type StepSession } from '../state/diagnosticsStore'

const MAX_MESSAGES = 400

export type CaptureController = { setOutcome: (outcome: StepSession['outcome']) => void; finish: () => StepSession | null }

function toData(message: ParsedMidiMessage): [number, number] {
  if (message.type === 'noteOn' || message.type === 'noteOff') return [message.note, message.velocity]
  if (message.type === 'cc') return [message.controller, message.value]
  return [message.value, 0]
}

export function captureStep(lessonId: string, stepId: string, goalType: string): CaptureController {
  if (!useDiagnosticsStore.getState().enabled) return { setOutcome: () => {}, finish: () => null }
  let outcome: StepSession['outcome'] = 'left'
  const startedAt = new Date().toISOString(); const start = performance.now()
  const messages: RawCapture[] = []; const channels = new Set<number>(); const notes = new Set<number>(); const controllers = new Set<number>()
  const counts: Record<string, number> = {}; let unknownCount = 0
  const unsubscribe = subscribeRawBytes((bytes, message) => {
    const t = performance.now() - start
    if (!message) {
      unknownCount++; counts.unparsed = (counts.unparsed ?? 0) + 1
      if (messages.length < MAX_MESSAGES) messages.push({ t, type: 'unparsed', channel: (bytes[0] ?? 0) & 0x0f, data1: bytes[1] ?? 0, data2: bytes[2] ?? 0, known: false, bytes: bytes.slice(0, 8) })
      return
    }
    const known = classify(message, useProfileStore.getState().profile) !== null
    if (!known) unknownCount++
    counts[message.type] = (counts[message.type] ?? 0) + 1
    channels.add(message.channel)
    if (message.type === 'noteOn' || message.type === 'noteOff') notes.add(message.note)
    if (message.type === 'cc') controllers.add(message.controller)
    if (messages.length < MAX_MESSAGES) { const [data1, data2] = toData(message); messages.push({ t, type: message.type, channel: message.channel, data1, data2, known }) }
  })
  return {
    setOutcome: (next) => { outcome = next },
    finish: () => {
      unsubscribe()
      if (messages.length === 0 && outcome === 'left') return null
      return { lessonId, stepId, goalType, outcome, startedAt, durationMs: performance.now() - start, messages, channels: [...channels], notes: [...notes], controllers: [...controllers], counts, unknownCount }
    },
  }
}
