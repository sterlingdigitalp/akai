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
  | { type: 'contour'; minNotes: number; minSpan: number; withinMs: number; direction?: 'up' | 'down'; minTurns?: number }
  | { type: 'phrases'; kind: 'pad' | 'key'; minPhrases: number; notesPerPhrase: number; gapMs: number; withinMs: number }
  | { type: 'alternation'; minHits: number; minUnique: number; changeRatio: number; withinMs: number }
  | { type: 'variety'; kind: 'pad' | 'key'; minHits: number; minUnique: number; withinMs: number }
  | { type: 'density'; kind: 'pad' | 'key'; minHits: number; ratio: number; withinMs: number }
  | { type: 'controlrange'; kind: 'knob' | 'pitch' | 'mod'; index?: number; span: number }
  | { type: 'mix'; withinMs: number; keys?: number; pads?: number; knobs?: number; keySpan?: number; controlSpan?: number; pitch?: true; mod?: true }
  | { type: 'confirm' }

export type LessonStep = { id: string; title: string; instruction: string; hint?: string; goal: GoalSpec; recap?: string[]; highlight?: 'arp' | 'latch' | 'tap' | 'note-repeat' | 'chords' | 'scales' | 'pitch' | 'mod'; confirm?: string }
export type PatternEvent = { kind: 'pattern'; grid: boolean[][]; ts: number }
export type LessonEvent = ControlEvent | PatternEvent
type CapturedControl = Pick<ControlEvent, 'kind' | 'index' | 'value' | 'ts'>
export type DetectorState = { count: number; progress: number; done: boolean; min: number; max: number; sequence: number[]; times: number[]; captured: number[]; baselineMedian?: number; values: number[]; events: CapturedControl[] }
export const initialDetectorState = (): DetectorState => ({ count: 0, progress: 0, done: false, min: 1, max: 0, sequence: [], times: [], captured: [], values: [], events: [] })

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
  let next = { ...state, sequence: [...state.sequence], times: [...state.times], captured: [...state.captured], values: [...state.values], events: [...state.events] }
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
    const baseDone = notes.length >= goal.n && medianInterval >= 45 && medianInterval <= 500 && coefficientOfVariation < .4
    const hasExtraCriterion = goal.minSpan !== undefined || goal.direction !== undefined || goal.denser === true
    let baselineMedian = next.baselineMedian
    let denserDone = goal.denser !== true
    if (goal.denser && baseDone) {
      if (baselineMedian === undefined || medianInterval > baselineMedian) baselineMedian = medianInterval
      denserDone = medianInterval <= baselineMedian / 1.6
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
    if (goal.denser && steady) { if (baselineMedian === undefined || medianInterval > baselineMedian) baselineMedian = medianInterval; denserDone = medianInterval <= baselineMedian / 1.6 }
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
  } else if (goal.type === 'contour' && event.kind === 'key' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((note, index) => ({ note, time: next.times[index] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ note: event.index, time: event.ts })
    const notes = pairs.map((item) => item.note)
    const deltas = notes.slice(1).map((note, index) => note - (notes[index] ?? note)).filter((delta) => delta !== 0)
    const span = Math.max(...notes) - Math.min(...notes)
    const wantedDirection = goal.direction === 'up' ? 1 : goal.direction === 'down' ? -1 : 0
    const directional = wantedDirection === 0 ? 1 : deltas.filter((delta) => Math.sign(delta) === wantedDirection).length / Math.max(1, deltas.length)
    const signs = deltas.map(Math.sign)
    const turns = signs.slice(1).filter((sign, index) => sign !== signs[index]).length
    const motionProgress = Math.min(Math.min(1, directional / .65), goal.minTurns === undefined ? 1 : Math.min(1, turns / goal.minTurns))
    const movesNeeded = Math.max(3, goal.minNotes - 3)
    const done = notes.length >= goal.minNotes && deltas.length >= movesNeeded && span >= goal.minSpan && directional >= .65 && (goal.minTurns === undefined || turns >= goal.minTurns)
    const progress = done ? 1 : Math.min(1, notes.length / goal.minNotes, deltas.length / movesNeeded, span / goal.minSpan, motionProgress)
    next = { ...next, sequence: notes, times: pairs.map((item) => item.time), count: notes.length, progress, done }
  } else if (goal.type === 'phrases' && event.kind === goal.kind && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((index, position) => ({ index, time: next.times[position] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ index: event.index, time: event.ts })
    const gaps = pairs.slice(1).map((item, position) => item.time - (pairs[position]?.time ?? item.time))
    const breakGap = Math.max(goal.gapMs, median(gaps) * 1.8)
    const phrases: typeof pairs[] = []
    pairs.forEach((item) => {
      const current = phrases[phrases.length - 1]
      if (current && item.time - current[current.length - 1]!.time < breakGap) current.push(item)
      else phrases.push([item])
    })
    const completePhrases = phrases.filter((phrase) => phrase.length >= goal.notesPerPhrase).length
    const trailing = phrases[phrases.length - 1]
    const partial = trailing && trailing.length < goal.notesPerPhrase ? trailing.length / goal.notesPerPhrase : 0
    const progress = Math.min(1, (completePhrases + partial) / goal.minPhrases)
    next = { ...next, sequence: pairs.map((item) => item.index), times: pairs.map((item) => item.time), count: completePhrases, progress, done: completePhrases >= goal.minPhrases }
  } else if (goal.type === 'alternation' && event.kind === 'pad' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((index, position) => ({ index, time: next.times[position] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ index: event.index, time: event.ts })
    const indices = pairs.map((item) => item.index)
    const changes = indices.slice(1).filter((index, position) => index !== indices[position]).length
    const changeRatio = changes / Math.max(1, indices.length - 1)
    const unique = new Set(indices).size
    const done = indices.length >= goal.minHits && unique >= goal.minUnique && changeRatio >= goal.changeRatio
    const progress = done ? 1 : Math.min(1, indices.length / goal.minHits, unique / goal.minUnique, changeRatio / goal.changeRatio)
    next = { ...next, sequence: indices, times: pairs.map((item) => item.time), count: indices.length, progress, done }
  } else if (goal.type === 'variety' && event.kind === goal.kind && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const pairs = next.sequence.map((index, position) => ({ index, time: next.times[position] ?? 0 })).filter((item) => item.time >= cutoff)
    pairs.push({ index: event.index, time: event.ts })
    const indices = pairs.map((item) => item.index)
    const unique = new Set(indices).size
    const done = indices.length >= goal.minHits && unique >= goal.minUnique
    const progress = Math.min(1, indices.length / goal.minHits, unique / goal.minUnique)
    next = { ...next, sequence: indices, times: pairs.map((item) => item.time), count: indices.length, progress, done }
  } else if (goal.type === 'density' && event.kind === goal.kind && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const times = [...next.times.filter((time) => time >= cutoff), event.ts]
    const recentTimes = times.slice(-goal.minHits)
    const { medianInterval, coefficientOfVariation } = intervalStats(recentTimes)
    const steady = recentTimes.length >= goal.minHits && medianInterval >= 45 && medianInterval <= 1200 && coefficientOfVariation < .5
    let baselineMedian = next.baselineMedian
    if (steady && (baselineMedian === undefined || medianInterval > baselineMedian)) baselineMedian = medianInterval
    const done = steady && baselineMedian !== undefined && medianInterval <= baselineMedian / goal.ratio
    const progress = done ? 1 : baselineMedian === undefined || medianInterval <= 0 ? Math.min(.5, recentTimes.length / goal.minHits * .5) : Math.min(.95, .5 + (baselineMedian / medianInterval) / goal.ratio * .5)
    next = { ...next, times, count: recentTimes.length, progress, done, baselineMedian }
  } else if (goal.type === 'controlrange' && event.kind === goal.kind && (goal.index === undefined || event.index === goal.index)) {
    const min = Math.min(next.min, event.value)
    const max = Math.max(next.max, event.value)
    const progress = Math.min(1, (max - min) / goal.span)
    next = { ...next, min, max, progress, done: progress >= 1 }
  } else if (goal.type === 'mix' && event.kind !== 'pattern' && event.on !== false) {
    const cutoff = event.ts - goal.withinMs
    const events = next.events.filter((item) => item.ts >= cutoff)
    const isControl = event.kind === 'knob' || event.kind === 'pitch' || event.kind === 'mod'
    const lastSame = isControl ? [...events].reverse().find((item) => item.kind === event.kind && item.index === event.index) : undefined
    if (!lastSame || Math.abs(lastSame.value - event.value) >= .01) events.push({ kind: event.kind, index: event.index, value: event.value, ts: event.ts })
    const keyEvents = events.filter((item) => item.kind === 'key')
    const padEvents = events.filter((item) => item.kind === 'pad')
    const spanFor = (kind: CapturedControl['kind'], index?: number) => {
      const values = events.filter((item) => item.kind === kind && (index === undefined || item.index === index)).map((item) => item.value)
      return values.length ? Math.max(...values) - Math.min(...values) : 0
    }
    const controlSpan = goal.controlSpan ?? .25
    const knobIndices = new Set(events.filter((item) => item.kind === 'knob').map((item) => item.index))
    const movedKnobs = [...knobIndices].filter((index) => spanFor('knob', index) >= controlSpan).length
    const keyRange = keyEvents.length ? Math.max(...keyEvents.map((item) => item.index)) - Math.min(...keyEvents.map((item) => item.index)) : 0
    const requirements = [
      goal.keys === undefined ? undefined : keyEvents.length / goal.keys,
      goal.pads === undefined ? undefined : padEvents.length / goal.pads,
      goal.knobs === undefined ? undefined : movedKnobs / goal.knobs,
      goal.keySpan === undefined ? undefined : keyRange / goal.keySpan,
      goal.pitch === undefined ? undefined : spanFor('pitch') / controlSpan,
      goal.mod === undefined ? undefined : spanFor('mod') / controlSpan,
    ].filter((value): value is number => value !== undefined)
    const progress = requirements.length ? Math.min(1, ...requirements) : 0
    next = { ...next, events, count: keyEvents.length + padEvents.length, progress, done: requirements.length > 0 && requirements.every((value) => value >= 1) }
  } else if (goal.type === 'confirm') {
    return { state, progress: state.progress, done: false }
  }
  return { state: next, progress: next.progress, done: next.done }
}
