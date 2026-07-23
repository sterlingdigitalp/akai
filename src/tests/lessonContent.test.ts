import { describe, expect, it } from 'vitest'
import { LESSONS } from '../lessons/content'
import { initialDetectorState, reduceGoal } from '../lessons/engine'
import type { LessonEvent } from '../lessons/engine'
import type { ControlKind } from '../midi/types'

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const KINDS: ControlKind[] = ['key', 'pad', 'knob', 'pitch', 'mod']
function syntheticEvents(seed: number, count: number): LessonEvent[] {
  const random = mulberry32(seed)
  let ts = 0
  return Array.from({ length: count }, () => {
    const kind = KINDS[Math.floor(random() * KINDS.length)]!
    const index = Math.floor(random() * 88)
    const value = random()
    ts += random() < .5 ? 20 : 2000
    return { kind, index, value, ts, on: true, channel: 0, source: 'demo' }
  })
}

describe('lesson path content', () => {
  it('contains a numbered path of sixteen lessons with unique IDs', () => {
    expect(LESSONS).toHaveLength(16)
    expect(LESSONS.map((lesson) => lesson.number)).toEqual(Array.from({ length: 16 }, (_, index) => String(index + 1).padStart(2, '0')))
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length)
    const stepIds = LESSONS.flatMap((lesson) => lesson.steps.map((step) => step.id))
    expect(new Set(stepIds).size).toBe(stepIds.length)
  })

  it('gives every new lesson interactive moves followed by a recap', () => {
    LESSONS.slice(8).forEach((lesson) => {
      expect(lesson.steps.length).toBeGreaterThanOrEqual(6)
      expect(lesson.steps.at(-1)?.recap).toHaveLength(3)
      expect(lesson.steps.slice(0, -1).some((step) => step.goal.type !== 'confirm')).toBe(true)
    })
  })

  it('uses no exact-pitch or absolute-velocity goals in lessons 9–16', () => {
    LESSONS.slice(8).flatMap((lesson) => lesson.steps).forEach((step) => {
      expect(step.goal.type).not.toBe('notes')
      if ('match' in step.goal) {
        expect(step.goal.match.minVelocity).toBeUndefined()
        expect(step.goal.match.maxVelocity).toBeUndefined()
      }
    })
  })

  it('never reports full progress on a step that has not completed, across randomized event streams', () => {
    const steps = LESSONS.flatMap((lesson) => lesson.steps).filter((step) => step.goal.type !== 'calibrate' && step.goal.type !== 'pattern')
    steps.forEach((step, index) => {
      const events = syntheticEvents(index + 1, 300)
      let state = initialDetectorState()
      events.forEach((event) => {
        const result = reduceGoal(step.goal, state, event)
        state = result.state
        expect(result.progress >= 1 && !result.done, `step "${step.id}" reported 100% progress without being done`).toBe(false)
      })
    })
  })

  it('keeps every hand-played goal within one event per second per surface', () => {
    const offenders: string[] = []
    LESSONS.forEach((lesson) => lesson.steps.forEach((step) => {
      const goal = step.goal
      if (goal.type === 'contour') {
        const rate = goal.minNotes / (goal.withinMs / 1000)
        if (rate > 1) offenders.push(`${step.id}: contour needs ${rate.toFixed(2)} notes/sec`)
      } else if (goal.type === 'phrases') {
        const rate = (goal.minPhrases * goal.notesPerPhrase) / (goal.withinMs / 1000)
        if (rate > 1) offenders.push(`${step.id}: phrases needs ${rate.toFixed(2)} notes/sec`)
      } else if (goal.type === 'alternation' || goal.type === 'variety' || goal.type === 'density') {
        const rate = goal.minHits / (goal.withinMs / 1000)
        if (rate > 1) offenders.push(`${step.id}: ${goal.type} needs ${rate.toFixed(2)} hits/sec`)
      } else if (goal.type === 'mix') {
        const seconds = goal.withinMs / 1000
        if (goal.keys !== undefined && goal.keys / seconds > 1) offenders.push(`${step.id}: mix keys needs ${(goal.keys / seconds).toFixed(2)} events/sec`)
        if (goal.pads !== undefined && goal.pads / seconds > 1) offenders.push(`${step.id}: mix pads needs ${(goal.pads / seconds).toFixed(2)} events/sec`)
      }
    }))
    expect(offenders, offenders.join('; ')).toEqual([])
  })
})
