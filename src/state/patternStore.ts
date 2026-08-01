import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { emptyPattern, parsePattern, type Pattern } from './dataSchema'
import { woodshedStorage } from './storage'

type PatternState = {
  pattern: Pattern
  setPattern: (pattern: Pattern | ((previous: Pattern) => Pattern)) => void
  clear: () => void
}

function legacyPattern(): Pattern {
  try {
    const value = localStorage.getItem('woodshed.pattern.v1')
    return parsePattern(value ? JSON.parse(value) : null) ?? emptyPattern()
  } catch {
    return emptyPattern()
  }
}

export const usePatternStore = create<PatternState>()(persist((set) => ({
  pattern: legacyPattern(),
  setPattern: (pattern) => set((state) => ({ pattern: typeof pattern === 'function' ? pattern(state.pattern) : pattern })),
  clear: () => set({ pattern: emptyPattern() }),
}), {
  name: 'woodshed.pattern.v2',
  version: 2,
  storage: createJSONStorage(() => woodshedStorage),
  migrate: (persisted) => persisted as PatternState,
  merge: (persisted, current) => {
    const candidate = persisted as Partial<PatternState> | undefined
    return { ...current, pattern: parsePattern(candidate?.pattern) ?? current.pattern }
  },
  onRehydrateStorage: () => () => {
    try { localStorage.removeItem('woodshed.pattern.v1') } catch { /* localStorage may be unavailable */ }
  },
}))
