import type { ControlEvent, ControlKind } from '../midi/types'

export type EventMatch = { kind: ControlKind; index?: number; minIndex?: number; maxIndex?: number; minVelocity?: number; maxVelocity?: number; deviation?: number }
export type GoalSpec =
  | { type: 'event'; match: EventMatch }
  | { type: 'count'; match: EventMatch; n: number }
  | { type: 'sweep'; index: number; span: number }
  | { type: 'notes'; notes: number[]; mode: 'sequence' | 'chord'; anyOctave?: boolean; windowMs?: number }
  | { type: 'stream'; n: number; withinMs: number; minSpan?: number; direction?: 'down'; denser?: true }
  | { type: 'timing'; beats: number[]; padIndex: number; bpm: number; toleranceMs: number; hits: number }
  | { type: 'calibrate'; target: 'pads' | 'knobs' }
  | { type: 'pattern'; check: 'firstBeat' }

export type LessonStep = { id: string; title: string; instruction: string; hint?: string; goal: GoalSpec; recap?: string[]; highlight?: 'arp' | 'latch' | 'tap' }
export type PatternEvent = { kind: 'pattern'; grid: boolean[][]; ts: number }
export type LessonEvent = ControlEvent | PatternEvent
export type DetectorState = { count: number; progress: number; done: boolean; min: number; max: number; sequence: number[]; times: number[]; captured: number[]; baselineMedian?: number }
export const initialDetectorState = (): DetectorState => ({ count: 0, progress: 0, done: false, min: 1, max: 0, sequence: [], times: [], captured: [] })

function matches(event: LessonEvent, match: EventMatch) {
  if (event.kind === 'pattern' || event.kind !== match.kind || ('on' in event && event.on === false)) return false
  return (match.index === undefined || event.index === match.index) && (match.minIndex === undefined || event.index >= match.minIndex) && (match.maxIndex === undefined || event.index <= match.maxIndex) && (match.minVelocity === undefined || event.value >= match.minVelocity) && (match.maxVelocity === undefined || event.value <= match.maxVelocity) && (match.deviation === undefined || Math.abs(event.value - .5) >= match.deviation)
}
const pitch = (note: number, anyOctave?: boolean) => anyOctave ? ((note % 12) + 12) % 12 : note
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0)
}

export function reduceGoal(goal: GoalSpec, state: DetectorState, event: LessonEvent): { state: DetectorState; progress: number; done: boolean } {
  if (state.done) return { state, progress: 1, done: true }
  let next = { ...state, sequence: [...state.sequence], times: [...state.times], captured: [...state.captured] }
  if (goal.type === 'event') {
    if (matches(event, goal.match)) next = { ...next, count: 1, progress: 1, done: true }
  } else if (goal.type === 'count') {
    const count = next.count + (matches(event, goal.match) ? 1 : 0); const progress = goal.n === 0 ? 1 : Math.min(1, count / goal.n); next = { ...next, count, progress, done: progress >= 1 }
  } else if (goal.type === 'sweep' && event.kind === 'knob' && event.index === goal.index) {
    const min = Math.min(next.min, event.value); const max = Math.max(next.max, event.value); const progress = Math.min(1, (max - min) / goal.span); next = { ...next, min, max, progress, done: progress >= 1 }
  } else if (goal.type === 'notes' && event.kind === 'key' && event.on !== false) {
    const wanted = goal.notes.map((note) => pitch(note, goal.anyOctave)); const heard = pitch(event.index, goal.anyOctave)
    if (goal.mode === 'sequence') {
      const expected = wanted[next.count]
      const count = heard === expected ? next.count + 1 : heard === wanted[0] ? 1 : 0
      next.sequence.push(heard); next = { ...next, count, progress: count / wanted.length, done: count >= wanted.length }
    } else {
      const windowMs = goal.windowMs ?? 80; const cutoff = event.ts - windowMs
      const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
      pairs.push({ note: heard, time: event.ts }); const unique = new Set(pairs.map((item) => item.note)); const count = wanted.filter((note) => unique.has(note)).length
      next = { ...next, sequence: pairs.map((item) => item.note), times: pairs.map((item) => item.time), count, progress: count / wanted.length, done: count >= wanted.length }
    }
  } else if (goal.type === 'stream' && event.kind === 'key' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence
      .map((note, index) => ({ note, time: next.times[index] ?? 0 }))
      .filter((item) => item.time >= cutoff && item.time <= event.ts)
    pairs.push({ note: event.index, time: event.ts })
    const notes = pairs.map((item) => item.note)
    const times = pairs.map((item) => item.time)
    const intervals = times.slice(1).map((time, index) => time - (times[index] ?? time))
    const medianInterval = median(intervals)
    const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / (intervals.length || 1)
    const variance = intervals.reduce((sum, interval) => sum + (interval - meanInterval) ** 2, 0) / (intervals.length || 1)
    const coefficientOfVariation = meanInterval > 0 ? Math.sqrt(variance) / meanInterval : Infinity
    const baseDone = notes.length >= goal.n && medianInterval >= 100 && medianInterval <= 500 && coefficientOfVariation < .4
    const hasExtraCriterion = goal.minSpan !== undefined || goal.direction !== undefined || goal.denser === true
    let baselineMedian = next.baselineMedian
    let denserDone = goal.denser !== true
    if (goal.denser && baseDone) {
      if (baselineMedian === undefined) baselineMedian = medianInterval
      else denserDone = medianInterval <= baselineMedian / 1.6
    }
    const spanDone = goal.minSpan === undefined || Math.max(...notes) - Math.min(...notes) >= goal.minSpan
    const descendingPairs = notes.slice(1).filter((note, index) => note < (notes[index] ?? note)).length
    const directionDone = goal.direction === undefined || descendingPairs / Math.max(1, notes.length - 1) >= .6
    const extraDone = baseDone && spanDone && directionDone && denserDone
    const baseProgress = Math.min(1, notes.length / goal.n)
    const progress = hasExtraCriterion ? (extraDone ? 1 : baseProgress * .5) : baseProgress
    next = { ...next, sequence: notes, times, count: notes.length, progress, done: hasExtraCriterion ? extraDone : baseDone, baselineMedian }
  } else if (goal.type === 'timing' && event.kind === 'pad' && event.index === goal.padIndex && event.on !== false) {
    const beatMs = 60000 / goal.bpm; const barMs = beatMs * 4; const phase = ((event.ts % barMs) + barMs) % barMs
    const nearest = Math.min(...goal.beats.map((beat) => Math.abs(phase - beat * beatMs)), ...goal.beats.map((beat) => Math.abs(phase - (beat * beatMs + barMs))))
    const count = next.count + (nearest <= goal.toleranceMs ? 1 : 0); next = { ...next, count, progress: Math.min(1, count / goal.hits), done: count >= goal.hits }
  } else if (goal.type === 'calibrate' && event.kind === (goal.target === 'pads' ? 'pad' : 'knob') && ('on' in event ? event.on !== false : true)) {
    if (!next.captured.includes(event.index)) next.captured.push(event.index)
    const progress = Math.min(1, next.captured.length / 8); next = { ...next, progress, done: progress >= 1 }
  } else if (goal.type === 'pattern' && event.kind === 'pattern') {
    const good = [0, 8].every((s) => event.grid[0]?.[s]) && [4, 12].every((s) => event.grid[1]?.[s]) && [0, 2, 4, 6, 8, 10, 12, 14].every((s) => event.grid[2]?.[s])
    next = { ...next, progress: good ? 1 : 0, done: good }
  }
  return { state: next, progress: next.progress, done: next.done }
}
