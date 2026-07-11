import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_PROFILE, type DeviceProfile } from '../midi/profile'
import { woodshedStorage } from './storage'

type ProfileState = {
  profile: DeviceProfile
  learnPad: (index: number, note: number, channel: number) => void
  learnKnob: (index: number, cc: number) => void
  reset: () => void
}
const storage = createJSONStorage<ProfileState>(() => woodshedStorage)
export const useProfileStore = create<ProfileState>()(persist((set) => ({
  profile: { ...DEFAULT_PROFILE, padNotes: [...DEFAULT_PROFILE.padNotes], knobCCs: [...DEFAULT_PROFILE.knobCCs] },
  learnPad: (index, note, channel) => set((s) => { const padNotes = [...s.profile.padNotes]; padNotes[index] = note; return { profile: { ...s.profile, padNotes, padChannel: channel } } }),
  learnKnob: (index, cc) => set((s) => { const knobCCs = [...s.profile.knobCCs]; knobCCs[index] = cc; return { profile: { ...s.profile, knobCCs } } }),
  reset: () => set({ profile: { ...DEFAULT_PROFILE, padNotes: [...DEFAULT_PROFILE.padNotes], knobCCs: [...DEFAULT_PROFILE.knobCCs] } }),
}), { name: 'woodshed.profile.v2', storage }))
