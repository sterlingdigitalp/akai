import { listen } from '@tauri-apps/api/event'
import { useMidiStore } from '../state/midiStore'

type MidiMessagePayload = {
  bytes: number[]
  port: string
}
type MidiPort = { id: string; name: string }

let started = false
let lastPorts: MidiPort[] = []

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function applyPorts() {
  if (useMidiStore.getState().status === 'demo') return
  if (lastPorts.length > 0) {
    const port = lastPorts.find((item) => /akai|mpk/i.test(item.name)) ?? lastPorts[0]!
    useMidiStore.getState().setConnection('connected', port.name)
  } else {
    useMidiStore.getState().setConnection('no-device')
  }
}

export function restoreTauriMidiConnection() {
  applyPorts()
}

export async function startTauriMidi(receiveMidiBytes: (bytes: number[], port?: string) => void, panic: () => void) {
  if (started) {
    applyPorts()
    return
  }
  started = true
  let stopMessages: (() => void) | undefined
  try {
    stopMessages = await listen<MidiMessagePayload>('midi-message', ({ payload }) => {
      const preferred = lastPorts.filter((port) => /akai|mpk/i.test(port.name))
      if (preferred.length && !preferred.some((port) => port.id === payload.port)) return
      receiveMidiBytes(payload.bytes, payload.port)
    })
    await listen<MidiPort[]>('midi-ports', ({ payload }) => {
      if (lastPorts.some((oldPort) => !payload.some((port) => port.id === oldPort.id))) panic()
      lastPorts = payload
      applyPorts()
    })
  } catch {
    stopMessages?.()
    started = false
    useMidiStore.getState().setConnection('no-device')
  }
}
