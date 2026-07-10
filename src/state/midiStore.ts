import { create } from 'zustand'
import type { ControlEvent } from '../midi/types'

export type MidiStatus = 'unsupported' | 'no-device' | 'connected' | 'demo'
type MidiState = {
  status: MidiStatus
  deviceName: string
  heldKeys: Set<number>
  knobValues: number[]
  padFlash: { index: number; velocity: number; ts: number } | null
  joy: { x: number; y: number }
  setConnection: (status: MidiStatus, deviceName?: string) => void
  receive: (event: ControlEvent) => void
}

export const useMidiStore = create<MidiState>((set) => ({
  status: 'no-device', deviceName: '', heldKeys: new Set(), knobValues: Array(8).fill(0.5), padFlash: null, joy: { x: 0.5, y: 0.5 },
  setConnection: (status, deviceName = '') => set({ status, deviceName }),
  receive: (event) => set((state) => {
    if (event.kind === 'key') {
      const heldKeys = new Set(state.heldKeys)
      event.on ? heldKeys.add(event.index) : heldKeys.delete(event.index)
      return { heldKeys }
    }
    if (event.kind === 'pad') return event.on === false ? { padFlash: null } : { padFlash: { index: event.index, velocity: event.value, ts: event.ts } }
    if (event.kind === 'knob') { const knobValues = [...state.knobValues]; knobValues[event.index] = event.value; return { knobValues } }
    if (event.kind === 'joyX') return { joy: { ...state.joy, x: event.value } }
    if (event.kind === 'joyY') return { joy: { ...state.joy, y: event.value } }
    return {}
  }),
}))
