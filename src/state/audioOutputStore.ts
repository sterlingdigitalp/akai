import { create } from 'zustand'

type AudioOutputState = {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useAudioOutputStore = create<AudioOutputState>((set) => ({
  enabled: true,
  setEnabled: (enabled) => set({ enabled }),
}))
