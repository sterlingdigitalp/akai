import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LessonProgress = { completedSteps: string[]; completedAt?: string }
type ProgressState = {
  lessons: Record<string, LessonProgress>
  practiceDays: string[]
  completeStep: (lessonId: string, stepId: string, isLast?: boolean) => void
  reset: () => void
}
export function localDay(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export const useProgressStore = create<ProgressState>()(persist((set) => ({
  lessons: {}, practiceDays: [],
  completeStep: (lessonId, stepId, isLast = false) => set((s) => {
    const prior = s.lessons[lessonId] ?? { completedSteps: [] }
    const completedSteps = prior.completedSteps.includes(stepId) ? prior.completedSteps : [...prior.completedSteps, stepId]
    const day = localDay()
    return { lessons: { ...s.lessons, [lessonId]: { completedSteps, completedAt: isLast ? new Date().toISOString() : prior.completedAt } }, practiceDays: s.practiceDays.includes(day) ? s.practiceDays : [...s.practiceDays, day] }
  }),
  reset: () => set({ lessons: {}, practiceDays: [] }),
}), { name: 'woodshed.progress.v1' }))
