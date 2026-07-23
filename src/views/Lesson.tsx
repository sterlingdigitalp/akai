import { useCallback, useEffect, useRef, useState } from 'react'
import './lesson.css'
import { DeviceView } from '../components/device/DeviceView'
import { MixMeter } from '../components/MixMeter'
import { getLesson } from '../lessons/content'
import { initialDetectorState, mixParts, reduceGoal, type DetectorState } from '../lessons/engine'
import { subscribeControls, subscribeRawMidi } from '../midi/midi'
import { noteOff, noteOn, setParam } from '../audio/synth'
import { trigger } from '../audio/drums'
import { getEngine } from '../audio/engine'
import { useProgressStore } from '../state/progressStore'
import { useProfileStore } from '../state/profileStore'
import { useUiStore } from '../state/uiStore'
import { useDiagnosticsStore, type StepSession } from '../state/diagnosticsStore'
import { captureStep } from '../lessons/diagnostics'

export function LessonView() {
  const id = useUiStore((s) => s.activeLessonId); const go = useUiStore((s) => s.go); const lesson = getLesson(id); const saved = useProgressStore((s) => s.lessons[lesson.id]); const completeStep = useProgressStore((s) => s.completeStep)
  const firstIncomplete = lesson.steps.findIndex((step) => !saved?.completedSteps.includes(step.id))
  const [index, setIndex] = useState(firstIncomplete < 0 ? lesson.steps.length - 1 : firstIncomplete)
  const [detector, setDetector] = useState<DetectorState>(initialDetectorState()); const [justDone, setJustDone] = useState(false); const detectorRef = useRef(detector); detectorRef.current = detector
  const learnPad = useProfileStore((s) => s.learnPad); const learnKnob = useProfileStore((s) => s.learnKnob)
  const step = lesson.steps[index]!
  const isRecap = step.goal.type === 'count' && step.goal.n === 0
  const completed = !!saved?.completedSteps.includes(step.id) || isRecap
  const outcomeRef = useRef<StepSession['outcome']>('left'); const captureRef = useRef<ReturnType<typeof captureStep> | null>(null)
  useEffect(() => { window.scrollTo({ top: 0 }) }, [lesson.id])
  useEffect(() => { const next = initialDetectorState(); setDetector(next); detectorRef.current = next; setJustDone(false) }, [index, lesson.id])
  useEffect(() => {
    outcomeRef.current = 'left'; captureRef.current = captureStep(lesson.id, step.id, step.goal.type)
    return () => { const capture = captureRef.current; captureRef.current = null; if (!capture) return; capture.setOutcome(outcomeRef.current); const session = capture.finish(); if (session) useDiagnosticsStore.getState().addSession(session) }
  }, [index, lesson.id])
  const handleEvent = useCallback((event: Parameters<typeof reduceGoal>[2]) => {
    if ('source' in event && event.source === 'replay') return
    const result = reduceGoal(step.goal, detectorRef.current, event); detectorRef.current = result.state; setDetector(result.state)
    if (result.done && !saved?.completedSteps.includes(step.id)) { completeStep(lesson.id, step.id, index === lesson.steps.length - 1); setJustDone(true); outcomeRef.current = 'completed' }
  }, [step, saved, completeStep, lesson.id, index, lesson.steps.length])
  useEffect(() => subscribeControls(handleEvent), [handleEvent])
  useEffect(() => {
    if (step.goal.type !== 'calibrate') return
    const captured = new Set<number>()
    return subscribeRawMidi((message) => {
      const targetPads = step.goal.type === 'calibrate' && step.goal.target === 'pads'
      if (targetPads && message.type === 'noteOn' && !captured.has(message.note)) {
        const next = captured.size; captured.add(message.note); learnPad(next, message.note, message.channel)
        const progress = captured.size / 8; detectorRef.current = { ...detectorRef.current, captured: [...captured], progress, done: captured.size >= 8 }; setDetector(detectorRef.current)
        if (captured.size >= 8) { completeStep(lesson.id, step.id); setJustDone(true); outcomeRef.current = 'completed' }
      }
      if (!targetPads && message.type === 'cc' && !captured.has(message.controller)) {
        const next = captured.size; captured.add(message.controller); learnKnob(next, message.controller)
        const progress = captured.size / 8; detectorRef.current = { ...detectorRef.current, captured: [...captured], progress, done: captured.size >= 8 }; setDetector(detectorRef.current)
        if (captured.size >= 8) { completeStep(lesson.id, step.id); setJustDone(true); outcomeRef.current = 'completed' }
      }
    })
  }, [step, learnPad, learnKnob, completeStep, lesson.id])
  const backingPhrase = lesson.id === 'sound' || (lesson.id === 'signature-sound' && step.goal.type === 'gesture')
  useEffect(() => {
    if (!backingPhrase) return
    const notes = [48, 55, 60, 63]; let i = 0; setParam('attack', .35)
    const timer = window.setInterval(() => { const note = notes[i++ % notes.length]!; noteOn(note, .24); window.setTimeout(() => noteOff(note), 520) }, 680)
    return () => { clearInterval(timer); notes.forEach(noteOff) }
  }, [backingPhrase])
  const skip = () => { outcomeRef.current = step.goal.type === 'confirm' ? 'confirmed' : 'skipped'; completeStep(lesson.id, step.id); setJustDone(true) }
  const playBeat = () => { const sixteenth = 60000 / 90 / 4; for (let s = 0; s < 16; s++) { if ([0, 8].includes(s)) window.setTimeout(() => trigger(0, .82), s * sixteenth); if ([4, 12].includes(s)) window.setTimeout(() => trigger(1, .76), s * sixteenth); if (s % 2 === 0) window.setTimeout(() => trigger(2, .54), s * sixteenth) } skip() }
  const next = () => { if (!saved?.completedSteps.includes(step.id)) completeStep(lesson.id, step.id, index === lesson.steps.length - 1); if (index < lesson.steps.length - 1) setIndex(index + 1); else go('home') }
  const done = completed || justDone
  const now = useTick(step.goal.type === 'mix' && !done)
  const parts = step.goal.type === 'mix' ? mixParts(step.goal, detector.events, now) : []
  const liveProgress = step.goal.type === 'mix' ? (parts.length ? Math.min(1, ...parts.map((part) => part.ratio)) : 0) : detector.progress
  return <section className="lesson-view"><button className="back-link" onClick={() => go('home')}>← Lesson path</button><div className="lesson-meta"><span>Lesson {lesson.number}</span><span>{index + 1} / {lesson.steps.length}</span></div><article className={`instruction-card ${done ? 'is-complete' : ''}`}><div className="step-check">{done ? '✓' : index + 1}</div><div className="instruction-copy"><p className="eyebrow">{lesson.title}</p><h1>{step.title}</h1><p className="lead">{step.instruction}</p>{step.hint && <details><summary>Need a hint?</summary><p>{step.hint}</p></details>}{step.recap && <div className="recap-list">{step.recap.map((point) => <span key={point}>✓ {point}</span>)}</div>}</div><div className="step-actions">{!done && !isRecap && (step.goal.type === 'confirm' ? <button className="button secondary" onClick={skip}>✓ {step.confirm}</button> : <button className="text-button" onClick={skip}>{step.goal.type === 'calibrate' ? 'Use defaults' : 'Skip for now'}</button>)}{step.id === 'play' && !done && <button className="button secondary" onClick={playBeat}>▶ Play your beat</button>}<button className="button primary" disabled={!done} onClick={next}>{index === lesson.steps.length - 1 ? 'Finish lesson' : 'Next move'} <span>→</span></button></div>{justDone && <div className="particles" aria-hidden="true">✦ · ✦ · ✦</div>}</article><div className="progress-track" aria-label={`${Math.round(done ? 100 : liveProgress * 100)}% complete`}><i style={{ width: `${done ? 100 : liveProgress * 100}%` }}/></div>{step.goal.type === 'mix' && !done && <MixMeter parts={parts} withinMs={step.goal.withinMs} now={now}/>}{step.goal.type === 'timing' && <Metronome bpm={step.goal.bpm}/>} {step.goal.type === 'pattern' ? <LessonPattern onChange={(grid) => handleEvent({ kind: 'pattern', grid, ts: performance.now() })}/> : <DeviceView highlight={step.highlight}/>}</section>
}

function useTick(active: boolean) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    setNow(performance.now())
    const timer = window.setInterval(() => setNow(performance.now()), 180)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function Metronome({ bpm }: { bpm: number }) {
  const [beat, setBeat] = useState(() => Math.floor(performance.now() / (60000 / bpm)) % 4)
  const previousBeat = useRef(beat)
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextBeat = Math.floor(performance.now() / (60000 / bpm)) % 4
      if (nextBeat === previousBeat.current) return
      previousBeat.current = nextBeat
      setBeat(nextBeat)
      const { context, master } = getEngine()
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(nextBeat === 0 ? 1600 : 1200, now)
      gain.gain.setValueAtTime(nextBeat === 0 ? .22 : .15, now)
      gain.gain.exponentialRampToValueAtTime(.001, now + .03)
      oscillator.connect(gain).connect(master)
      oscillator.start(now)
      oscillator.stop(now + .03)
    }, 30)
    return () => clearInterval(timer)
  }, [bpm])
  return <div className="metronome"><span>{bpm} BPM</span>{[0,1,2,3].map((current) => <i className={beat === current ? 'active' : ''} key={current}>{current + 1}</i>)}</div>
}

function LessonPattern({ onChange }: { onChange: (grid: boolean[][]) => void }) {
  const [grid, setGrid] = useState(() => Array.from({ length: 3 }, () => Array(16).fill(false) as boolean[])); const names = ['Kick', 'Snare', 'Closed hat']
  const toggle = (rowIndex: number, stepIndex: number) => setGrid((old) => { const next = old.map((row) => [...row]); next[rowIndex]![stepIndex] = !next[rowIndex]![stepIndex]; queueMicrotask(() => onChange(next)); return next })
  return <div className="sequencer-card lesson-pattern"><div className="beat-count"><span/>{Array.from({ length: 16 }, (_, i) => <b key={i}>{i % 4 === 0 ? i / 4 + 1 : '·'}</b>)}</div>{grid.map((row, r) => <div className="seq-row" key={names[r]}><span className="voice-trigger">{names[r]}</span>{row.map((active, s) => <button key={s} className={`step-cell ${active ? 'active' : ''}`} onClick={() => toggle(r, s)} aria-label={`${names[r]}, step ${s + 1}`}/>)}</div>)}</div>
}
