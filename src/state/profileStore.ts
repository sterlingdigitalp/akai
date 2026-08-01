import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_PROFILE, type DeviceProfile } from '../midi/profile'
import { woodshedStorage } from './storage'
import { parseProfile } from './dataSchema'

type ProfileState = {
  profile: DeviceProfile
  learnPad: (index: number, note: number, channel: number) => void
  learnKnob: (index: number, cc: number) => void
  learnKeyChannel: (channel: number) => void
  learnModCC: (cc: number) => void
  reset: () => void
}
const storage = createJSONStorage<ProfileState>(() => woodshedStorage)
export const useProfileStore = create<ProfileState>()(persist((set) => ({
  profile: { ...DEFAULT_PROFILE, padNotes: [...DEFAULT_PROFILE.padNotes], knobCCs: [...DEFAULT_PROFILE.knobCCs] },
  learnPad: (index, note, channel) => set((s) => { const padNotes = [...s.profile.padNotes]; padNotes[index] = note; return { profile: { ...s.profile, padNotes, padChannel: channel } } }),
  learnKnob: (index, cc) => set((s) => { const knobCCs = [...s.profile.knobCCs]; knobCCs[index] = cc; return { profile: { ...s.profile, knobCCs } } }),
  learnKeyChannel: (keyChannel) => set((s) => ({ profile: { ...s.profile, keyChannel } })),
  learnModCC: (modCC) => set((s) => ({ profile: { ...s.profile, modCC } })),
  reset: () => set({ profile: { ...DEFAULT_PROFILE, padNotes: [...DEFAULT_PROFILE.padNotes], knobCCs: [...DEFAULT_PROFILE.knobCCs] } }),
}), {
  name: 'woodshed.profile.v2',
  version: 3,
  storage,
  migrate: (persisted) => persisted as ProfileState,
  merge: (persisted, current) => {
    const candidate = (persisted as Partial<ProfileState> | undefined)?.profile
    const profile = parseProfile(candidate)
    return profile ? { ...current, profile } : current
  },
}))
