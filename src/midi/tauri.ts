import { listen } from '@tauri-apps/api/event'
import { useMidiStore } from '../state/midiStore'

type MidiMessagePayload = {
  bytes: number[]
  port: string
}

let started = false
let lastPorts: string[] = []

export function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function applyPorts() {
  if (useMidiStore.getState().status === 'demo') return
  if (lastPorts.length > 0) {
    const name = lastPorts.find((port) => /mpk/i.test(port)) ?? lastPorts[0]!
    useMidiStore.getState().setConnection('connected', name)
  } else {
    useMidiStore.getState().setConnection('no-device')
  }
}

export function restoreTauriMidiConnection() {
  applyPorts()
}

export async function startTauriMidi(receiveMidiBytes: (bytes: number[]) => void) {
  if (started) {
    applyPorts()
    return
  }
  started = true
  let stopMessages: (() => void) | undefined
  try {
    stopMessages = await listen<MidiMessagePayload>('midi-message', ({ payload }) => {
      receiveMidiBytes(payload.bytes)
    })
    await listen<string[]>('midi-ports', ({ payload }) => {
      lastPorts = payload
      applyPorts()
    })
  } catch {
    stopMessages?.()
    started = false
    useMidiStore.getState().setConnection('no-device')
  }
}
