import { parseMidi, type ParsedMidiMessage } from './parser'
import { classify } from './profile'
import type { ControlEvent } from './types'
import { useMidiStore } from '../state/midiStore'
import { useProfileStore } from '../state/profileStore'

type Subscriber = (event: ControlEvent) => void
type RawSubscriber = (message: ParsedMidiMessage, bytes: number[]) => void
const subscribers = new Set<Subscriber>()
const rawSubscribers = new Set<RawSubscriber>()
let access: MIDIAccess | null = null
let active: MIDIInput | null = null

export function emitControl(event: ControlEvent) {
  useMidiStore.getState().receive(event)
  subscribers.forEach((subscriber) => subscriber(event))
}
export const subscribeControls = (subscriber: Subscriber) => { subscribers.add(subscriber); return () => { subscribers.delete(subscriber) } }
export const subscribeRawMidi = (subscriber: RawSubscriber) => { rawSubscribers.add(subscriber); return () => { rawSubscribers.delete(subscriber) } }

function receive(message: MIDIMessageEvent) {
  if (!message.data) return
  const bytes = Array.from(message.data)
  const parsed = parseMidi(bytes)
  if (!parsed) return
  rawSubscribers.forEach((subscriber) => subscriber(parsed, bytes))
  const event = classify(parsed, useProfileStore.getState().profile)
  if (event) emitControl(event)
}

function pickInput() {
  if (!access) return
  const inputs = [...access.inputs.values()].filter((input) => input.state === 'connected')
  const next = inputs.find((input) => /mpk/i.test(input.name ?? '')) ?? inputs[0] ?? null
  if (active && active !== next) active.onmidimessage = null
  active = next
  if (active) {
    active.onmidimessage = receive
    useMidiStore.getState().setConnection('connected', active.name || 'MPK Mini')
  } else if (useMidiStore.getState().status !== 'demo') useMidiStore.getState().setConnection('no-device')
}

export async function startMidi() {
  if (!navigator.requestMIDIAccess) { useMidiStore.getState().setConnection('unsupported'); return }
  try {
    access = await navigator.requestMIDIAccess()
    access.onstatechange = pickInput
    pickInput()
  } catch { useMidiStore.getState().setConnection('no-device') }
}

export function setDemoMode(enabled: boolean) {
  if (enabled) useMidiStore.getState().setConnection('demo', 'On-screen MPK')
  else if (!navigator.requestMIDIAccess) useMidiStore.getState().setConnection('unsupported')
  else { useMidiStore.getState().setConnection('no-device'); pickInput() }
}
