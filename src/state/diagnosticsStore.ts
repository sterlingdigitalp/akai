import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { woodshedStorage } from './storage'

export type RawCapture = { t: number; type: string; channel: number; data1: number; data2: number; known: boolean; bytes?: number[] }
export type StepSession = {
  lessonId: string; stepId: string; goalType: string
  outcome: 'completed' | 'confirmed' | 'skipped' | 'left'
  startedAt: string; durationMs: number
  messages: RawCapture[]
  channels: number[]; notes: number[]; controllers: number[]
  counts: Record<string, number>   // by message type
  unknownCount: number             // messages classify() returned null for
}

const MAX_SESSIONS = 25
type DiagnosticsState = {
  enabled: boolean
  sessions: StepSession[]
  setEnabled: (v: boolean) => void
  addSession: (s: StepSession) => void
  clear: () => void
}
export const useDiagnosticsStore = create<DiagnosticsState>()(persist((set) => ({
  enabled: true, sessions: [],
  setEnabled: (v) => set({ enabled: v }),
  addSession: (s) => set((state) => {
    if (s.messages.length === 0 && s.outcome === 'left') return state
    return { sessions: [s, ...state.sessions].slice(0, MAX_SESSIONS) }
  }),
  clear: () => set({ sessions: [] }),
}), { name: 'woodshed.diagnostics.v1', storage: createJSONStorage(() => woodshedStorage) }))
