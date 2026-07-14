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
  | { type: 'chordmode'; minClusters: number; minVoices: number; rootSpan?: number; windowMs?: number; clusterMs?: number }
  | { type: 'scalefit'; minNotes: number; minSpan: number; maxClasses: number; withinMs?: number }
  | { type: 'repeat'; n: number; withinMs: number; denser?: true }
  | { type: 'dynamics'; kind: 'pad' | 'key'; minHits: number; spread: number }
  | { type: 'groovemix'; streamN: number; otherHits: number; withinMs: number }
  | { type: 'confirm' }

export type LessonStep = { id: string; title: string; instruction: string; hint?: string; goal: GoalSpec; recap?: string[]; highlight?: 'arp' | 'latch' | 'tap' | 'note-repeat' | 'chords' | 'scales'; confirm?: string }
export type PatternEvent = { kind: 'pattern'; grid: boolean[][]; ts: number }
export type LessonEvent = ControlEvent | PatternEvent
export type DetectorState = { count: number; progress: number; done: boolean; min: number; max: number; sequence: number[]; times: number[]; captured: number[]; baselineMedian?: number; values: number[] }
export const initialDetectorState = (): DetectorState => ({ count: 0, progress: 0, done: false, min: 1, max: 0, sequence: [], times: [], captured: [], values: [] })

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
const intervalStats = (times: number[]) => {
  const intervals = times.slice(1).map((time, index) => time - (times[index] ?? time))
  const medianInterval = median(intervals)
  const meanInterval = intervals.reduce((sum, interval) => sum + interval, 0) / (intervals.length || 1)
  const variance = intervals.reduce((sum, interval) => sum + (interval - meanInterval) ** 2, 0) / (intervals.length || 1)
  const coefficientOfVariation = meanInterval > 0 ? Math.sqrt(variance) / meanInterval : Infinity
  return { medianInterval, coefficientOfVariation }
}

export function reduceGoal(goal: GoalSpec, state: DetectorState, event: LessonEvent): { state: DetectorState; progress: number; done: boolean } {
  if (state.done) return { state, progress: 1, done: true }
  let next = { ...state, sequence: [...state.sequence], times: [...state.times], captured: [...state.captured], values: [...state.values] }
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
    const { medianInterval, coefficientOfVariation } = intervalStats(times)
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
  } else if (goal.type === 'chordmode' && event.kind === 'key' && event.on !== false) {
    const windowMs = goal.windowMs ?? 8000; const clusterMs = goal.clusterMs ?? 25
    const cutoff = event.ts - windowMs
    const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ note: event.index, time: event.ts }); pairs.sort((a, b) => a.time - b.time)
    const clusters: { note: number; time: number }[][] = []
    pairs.forEach((item) => { const last = clusters[clusters.length - 1]; if (last && item.time - last[0]!.time <= clusterMs) last.push(item); else clusters.push([item]) })
    const validClusters = clusters.filter((cluster) => new Set(cluster.map((item) => item.note)).size >= goal.minVoices)
    const roots = validClusters.map((cluster) => Math.min(...cluster.map((item) => item.note)))
    const rootSpanOK = goal.rootSpan === undefined || Math.max(...roots) - Math.min(...roots) >= goal.rootSpan
    const done = validClusters.length >= goal.minClusters && rootSpanOK
    const progress = rootSpanOK ? Math.min(1, validClusters.length / goal.minClusters) : Math.min(.8, validClusters.length / goal.minClusters)
    next = { ...next, sequence: pairs.map((item) => item.note), times: pairs.map((item) => item.time), count: validClusters.length, progress, done }
  } else if (goal.type === 'scalefit' && event.kind === 'key' && event.on !== false) {
    const cutoff = goal.withinMs === undefined ? -Infinity : event.ts - goal.withinMs
    const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ note: event.index, time: event.ts })
    const notes = pairs.map((item) => item.note)
    const classes = new Set(notes.map((note) => ((note % 12) + 12) % 12)).size
    const span = Math.max(...notes) - Math.min(...notes)
    const done = notes.length >= goal.minNotes && span >= goal.minSpan && classes <= goal.maxClasses
    const raw = Math.min(1, notes.length / goal.minNotes) * (span >= goal.minSpan ? 1 : .7)
    const progress = done ? 1 : classes <= goal.maxClasses ? raw : Math.min(.8, raw)
    next = { ...next, sequence: notes, times: pairs.map((item) => item.time), count: notes.length, progress, done }
  } else if (goal.type === 'repeat' && event.kind === 'pad' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ note: event.index, time: event.ts })
    const counts = new Map<number, number>(); pairs.forEach((item) => counts.set(item.note, (counts.get(item.note) ?? 0) + 1))
    let target = pairs[0]!.note; counts.forEach((count, note) => { if (count > (counts.get(target) ?? 0)) target = note })
    const targetTimes = pairs.filter((item) => item.note === target).map((item) => item.time).sort((a, b) => a - b)
    const { medianInterval, coefficientOfVariation } = intervalStats(targetTimes)
    const steady = targetTimes.length >= goal.n && medianInterval >= 50 && medianInterval <= 360 && coefficientOfVariation < .4
    let baselineMedian = next.baselineMedian; let denserDone = goal.denser !== true
    if (goal.denser && steady) { if (baselineMedian === undefined) baselineMedian = medianInterval; else denserDone = medianInterval <= baselineMedian / 1.6 }
    const done = steady && (goal.denser ? denserDone : true)
    const base = Math.min(1, targetTimes.length / goal.n)
    const progress = done ? 1 : (goal.denser ? base * .5 : base)
    next = { ...next, sequence: pairs.map((item) => item.note), times: pairs.map((item) => item.time), count: targetTimes.length, progress, done, baselineMedian }
  } else if (goal.type === 'dynamics' && event.kind === goal.kind && event.on !== false) {
    next.values.push(event.value)
    const hits = next.values.length; const range = Math.max(...next.values) - Math.min(...next.values)
    const done = hits >= goal.minHits && range >= goal.spread
    const progress = Math.min(1, Math.min(hits / goal.minHits, range / goal.spread))
    next = { ...next, progress, done }
  } else if (goal.type === 'groovemix' && event.kind === 'pad' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ note: event.index, time: event.ts })
    const counts = new Map<number, number>(); pairs.forEach((item) => counts.set(item.note, (counts.get(item.note) ?? 0) + 1))
    let candidate = pairs[0]!.note; counts.forEach((count, note) => { if (count > (counts.get(candidate) ?? 0)) candidate = note })
    const candidateTimes = pairs.filter((item) => item.note === candidate).map((item) => item.time).sort((a, b) => a - b)
    const { medianInterval, coefficientOfVariation } = intervalStats(candidateTimes)
    const hasStream = candidateTimes.length >= goal.streamN && medianInterval >= 50 && medianInterval <= 400 && coefficientOfVariation < .45
    const others = pairs.filter((item) => item.note !== candidate)
    const done = hasStream && others.length >= goal.otherHits
    const progress = Math.min(1, (hasStream ? .5 : 0) + Math.min(others.length / goal.otherHits, 1) * .5)
    next = { ...next, sequence: pairs.map((item) => item.note), times: pairs.map((item) => item.time), count: candidateTimes.length, progress, done }
  } else if (goal.type === 'confirm') {
    return { state, progress: state.progress, done: false }
  }
  return { state: next, progress: next.progress, done: next.done }
}
