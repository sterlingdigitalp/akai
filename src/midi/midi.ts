import { parseMidi, type ParsedMidiMessage } from './parser'
import { classify } from './profile'
import { isTauri, restoreTauriMidiConnection, startTauriMidi } from './tauri'
import type { ControlEvent } from './types'
import { useMidiStore } from '../state/midiStore'
import { useProfileStore } from '../state/profileStore'

type Subscriber = (event: ControlEvent) => void
type RawSubscriber = (message: ParsedMidiMessage, bytes: number[]) => void
const subscribers = new Set<Subscriber>()
const rawSubscribers = new Set<RawSubscriber>()
let access: MIDIAccess | null = null
const activeInputs = new Map<string, MIDIInput>()

export function emitControl(event: ControlEvent) {
  useMidiStore.getState().receive(event)
  subscribers.forEach((subscriber) => subscriber(event))
}
export const subscribeControls = (subscriber: Subscriber) => { subscribers.add(subscriber); return () => { subscribers.delete(subscriber) } }
export const subscribeRawMidi = (subscriber: RawSubscriber) => { rawSubscribers.add(subscriber); return () => { rawSubscribers.delete(subscriber) } }
// fires for every inbound message, including ones parseMidi cannot read — that unreadable traffic is exactly what diagnostics is hunting for
type ByteSubscriber = (bytes: number[], parsed: ParsedMidiMessage | null) => void
const byteSubscribers = new Set<ByteSubscriber>()
export const subscribeRawBytes = (subscriber: ByteSubscriber) => { byteSubscribers.add(subscriber); return () => { byteSubscribers.delete(subscriber) } }

function receive(message: MIDIMessageEvent) {
  if (!message.data) return
  receiveMidiBytes(Array.from(message.data))
}

export function receiveMidiBytes(bytes: number[]) {
  const parsed = parseMidi(bytes)
  byteSubscribers.forEach((subscriber) => subscriber(bytes, parsed))
  if (!parsed) return
  rawSubscribers.forEach((subscriber) => subscriber(parsed, bytes))
  const event = classify(parsed, useProfileStore.getState().profile)
  if (event) emitControl(event)
}

function syncInputs() {
  if (!access) return
  const inputs = [...access.inputs.values()].filter((input) => input.state === 'connected')
  const connectedInputs = new Map(inputs.map((input) => [input.id, input]))
  activeInputs.forEach((input, id) => {
    if (connectedInputs.get(id) === input) return
    input.onmidimessage = null
    activeInputs.delete(id)
  })
  inputs.forEach((input) => {
    if (activeInputs.get(input.id) === input) return
    input.onmidimessage = receive
    activeInputs.set(input.id, input)
  })
  if (activeInputs.size > 0) {
    const namedInput = inputs.find((input) => /mpk/i.test(input.name ?? '')) ?? inputs[0]!
    useMidiStore.getState().setConnection('connected', namedInput.name || 'MPK Mini')
  } else if (useMidiStore.getState().status !== 'demo') useMidiStore.getState().setConnection('no-device')
}

export async function startMidi() {
  if (isTauri()) { await startTauriMidi(receiveMidiBytes); return }
  if (!navigator.requestMIDIAccess) { useMidiStore.getState().setConnection('unsupported'); return }
  try {
    access = await navigator.requestMIDIAccess()
    access.onstatechange = syncInputs
    syncInputs()
  } catch { useMidiStore.getState().setConnection('no-device') }
}

export function setDemoMode(enabled: boolean) {
  if (enabled) useMidiStore.getState().setConnection('demo', 'On-screen MPK')
  else if (isTauri()) {
    useMidiStore.getState().setConnection('no-device')
    restoreTauriMidiConnection()
  }
  else if (!navigator.requestMIDIAccess) useMidiStore.getState().setConnection('unsupported')
  else { useMidiStore.getState().setConnection('no-device'); syncInputs() }
}
