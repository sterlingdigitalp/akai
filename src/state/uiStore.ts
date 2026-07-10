import { create } from 'zustand'
export type View = 'home' | 'lesson' | 'playground' | 'settings'
type UiState = { view: View; activeLessonId: string | null; playgroundTab: 'synth' | 'beats'; go: (view: View) => void; openLesson: (id: string) => void; setPlaygroundTab: (tab: 'synth' | 'beats') => void }
export const useUiStore = create<UiState>((set) => ({ view: 'home', activeLessonId: null, playgroundTab: 'synth', go: (view) => set({ view }), openLesson: (activeLessonId) => set({ view: 'lesson', activeLessonId }), setPlaygroundTab: (playgroundTab) => set({ playgroundTab }) }))
