import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Take } from '../audio/recorder'
import { woodshedStorage } from './storage'

const MAX_TAKES = 12
type TakesState = {
  takes: Take[]
  addTake: (take: Take) => void
  removeTake: (id: string) => void
  renameTake: (id: string, name: string) => void
}
export const useTakesStore = create<TakesState>()(persist((set) => ({
  takes: [],
  addTake: (take) => set((s) => ({ takes: [take, ...s.takes].slice(0, MAX_TAKES) })),
  removeTake: (id) => set((s) => ({ takes: s.takes.filter((take) => take.id !== id) })),
  renameTake: (id, name) => set((s) => ({ takes: s.takes.map((take) => take.id === id ? { ...take, name } : take) })),
}), { name: 'woodshed.takes.v1', storage: createJSONStorage(() => woodshedStorage) }))
