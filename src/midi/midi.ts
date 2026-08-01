import { parseMidi, type ParsedMidiMessage } from './parser'
import { classify } from './profile'
import { isTauri, restoreTauriMidiConnection, startTauriMidi } from './tauri'
import type { ControlEvent } from './types'
import { useMidiStore } from '../state/midiStore'
import { useProfileStore } from '../state/profileStore'

type Subscriber = (event: ControlEvent) => void
type RawSubscriber = (message: ParsedMidiMessage, bytes: number[], port?: string) => void
const subscribers = new Set<Subscriber>()
const panicSubscribers = new Set<() => void>()
const rawSubscribers = new Set<RawSubscriber>()
let access: MIDIAccess | null = null
const activeInputs = new Map<string, MIDIInput>()

export function emitControl(event: ControlEvent) {
  useMidiStore.getState().receive(event)
  subscribers.forEach((subscriber) => subscriber(event))
}
export const subscribeControls = (subscriber: Subscriber) => { subscribers.add(subscriber); return () => { subscribers.delete(subscriber) } }
export const subscribeMidiPanic = (subscriber: () => void) => { panicSubscribers.add(subscriber); return () => { panicSubscribers.delete(subscriber) } }
export const subscribeRawMidi = (subscriber: RawSubscriber) => { rawSubscribers.add(subscriber); return () => { rawSubscribers.delete(subscriber) } }
// fires for every inbound message, including ones parseMidi cannot read — that unreadable traffic is exactly what diagnostics is hunting for
type ByteSubscriber = (bytes: number[], parsed: ParsedMidiMessage | null, port?: string) => void
const byteSubscribers = new Set<ByteSubscriber>()
export const subscribeRawBytes = (subscriber: ByteSubscriber) => { byteSubscribers.add(subscriber); return () => { byteSubscribers.delete(subscriber) } }

function receive(message: MIDIMessageEvent, port?: string) {
  if (!message.data) return
  receiveMidiBytes(Array.from(message.data), port)
}

export function receiveMidiBytes(bytes: number[], port?: string) {
  const parsed = parseMidi(bytes)
  byteSubscribers.forEach((subscriber) => subscriber(bytes, parsed, port))
  if (!parsed) return
  rawSubscribers.forEach((subscriber) => subscriber(parsed, bytes, port))
  const event = classify(parsed, useProfileStore.getState().profile)
  if (event) emitControl({ ...event, ...(port ? { port } : {}) })
}

function syncInputs() {
  if (!access) return
  const inputs = [...access.inputs.values()].filter((input) => input.state === 'connected')
  const connectedInputs = new Map(inputs.map((input) => [input.id, input]))
  activeInputs.forEach((input, id) => {
    if (connectedInputs.get(id) === input) return
    input.onmidimessage = null
    activeInputs.delete(id)
    panicMidi()
  })
  const preferred = inputs.filter((input) => /akai|mpk/i.test(input.name ?? ''))
  const subscribed = preferred.length ? preferred : inputs
  inputs.forEach((input) => {
    if (!subscribed.includes(input)) {
      input.onmidimessage = null
      activeInputs.delete(input.id)
      return
    }
    if (activeInputs.get(input.id) === input) return
    input.onmidimessage = (message) => receive(message, `${input.id}:${input.name || 'MIDI input'}`)
    activeInputs.set(input.id, input)
  })
  if (activeInputs.size > 0) {
    const namedInput = subscribed[0]!
    useMidiStore.getState().setConnection('connected', namedInput.name || 'MPK Mini')
  } else if (useMidiStore.getState().status !== 'demo') useMidiStore.getState().setConnection('no-device')
}

export async function startMidi() {
  if (isTauri()) { await startTauriMidi(receiveMidiBytes, panicMidi); return }
  if (!navigator.requestMIDIAccess) { useMidiStore.getState().setConnection('unsupported'); return }
  try {
    access = await navigator.requestMIDIAccess()
    access.onstatechange = syncInputs
    syncInputs()
  } catch { useMidiStore.getState().setConnection('no-device') }
}

export function setDemoMode(enabled: boolean) {
  useMidiStore.getState().panic()
  if (enabled) useMidiStore.getState().setConnection('demo', 'On-screen MPK')
  else if (isTauri()) {
    useMidiStore.getState().setConnection('no-device')
    restoreTauriMidiConnection()
  }
  else if (!navigator.requestMIDIAccess) useMidiStore.getState().setConnection('unsupported')
  else { useMidiStore.getState().setConnection('no-device'); syncInputs() }
}

export function panicMidi() {
  useMidiStore.getState().panic()
  panicSubscribers.forEach((subscriber) => subscriber())
}
