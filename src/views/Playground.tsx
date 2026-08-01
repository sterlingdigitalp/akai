import { useEffect, useRef, useState } from 'react'
import { DeviceView } from '../components/device/DeviceView'
import { TakesPanel } from '../components/TakesPanel'
import { nearestRecordedStep, StepClock } from '../audio/clock'
import { getEngine } from '../audio/engine'
import { trigger } from '../audio/drums'
import { SYNTH_PRESETS, setPreset } from '../audio/synth'
import { subscribeControls } from '../midi/midi'
import { useMidiStore } from '../state/midiStore'
import { useUiStore } from '../state/uiStore'
import { usePatternStore } from '../state/patternStore'

const DRUM_NAMES = ['Kick', 'Snare', 'Closed hat', 'Open hat', 'Clap', 'Low tom', 'Rim', 'Crash']

export function Playground() {
  const tab = useUiStore((s) => s.playgroundTab); const setTab = useUiStore((s) => s.setPlaygroundTab)
  const tabs = ['synth', 'beats', 'takes'] as const
  return <section className="playground"><div className="page-title"><div><p className="eyebrow">No wrong notes</p><h1>Playground</h1></div><div className="tabs" role="tablist" aria-label="Playground sections">{tabs.map((name) => <button key={name} id={`tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name[0]!.toUpperCase() + name.slice(1)}</button>)}</div></div><div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>{tab === 'synth' && <SynthPanel/>}{tab === 'beats' && <BeatsPanel/>}{tab === 'takes' && <TakesPanel/>}</div></section>
}
function SynthPanel() {
  const knobs = useMidiStore((s) => s.knobValues); const [preset, choose] = useState<keyof typeof SYNTH_PRESETS | 'Custom'>('Warm Pad'); const names = ['Brightness', 'Resonance', 'Release', 'Echo send', 'Attack', 'Volume', 'Echo time', 'Feedback']
  useEffect(() => { setPreset('Warm Pad'); return subscribeControls((event) => { if (event.kind === 'knob') choose('Custom') }) }, [])
  return <><div className="control-bar"><div><span className="control-label">Sound{preset === 'Custom' ? ' · Custom' : ''}</span><div className="chips">{(Object.keys(SYNTH_PRESETS) as (keyof typeof SYNTH_PRESETS)[]).map((name) => <button key={name} className={preset === name ? 'active' : ''} onClick={() => { choose(name); setPreset(name) }}>{name}</button>)}</div></div><div className="knob-readouts" aria-label="Current hardware knob positions">{names.map((name, i) => <span key={name}><b>{name}</b>{Math.round((knobs[i] ?? .5) * 100)}%</span>)}</div></div><p className="record-tip">Percentages show the physical knob positions. Turning any knob makes the selected preset custom.</p><DeviceView/></>
}
function BeatsPanel() {
  const grid = usePatternStore((state) => state.pattern); const setGrid = usePatternStore((state) => state.setPattern); const clearPattern = usePatternStore((state) => state.clear); const [playing, setPlaying] = useState(false); const [step, setStep] = useState(-1); const [bpm, setBpm] = useState(100); const [swing, setSwing] = useState(.08); const clock = useRef<StepClock | null>(null); const stepRef = useRef(step); const gridRef = useRef(grid); const lastStepTime = useRef(0); const audioContext = useRef<AudioContext | null>(null); stepRef.current = step; gridRef.current = grid
  useEffect(() => subscribeControls((event) => {
    if (!playing || event.kind !== 'pad' || event.on === false || event.source === 'replay') return
    const current = Math.max(0, stepRef.current)
    const recordedStep = nearestRecordedStep(current, lastStepTime.current, audioContext.current?.currentTime ?? lastStepTime.current, bpm)
    setGrid((old) => old.map((row, ri) => row.map((cell, si) => ri === event.index && si === recordedStep ? true : cell)))
  }), [playing, bpm, setGrid])
  useEffect(() => () => clock.current?.stop(), [])
  const togglePlay = () => {
    if (playing) { clock.current?.stop(); clock.current = null; audioContext.current = null; setPlaying(false); setStep(-1); return }
    const { context } = getEngine(); audioContext.current = context; const next = new StepClock(context, (current, time) => { lastStepTime.current = time; setStep(current); gridRef.current.forEach((row, voice) => { if (row[current]) trigger(voice, .76, time) }) }, bpm, swing); clock.current = next; next.start(); setPlaying(true)
  }
  useEffect(() => { if (clock.current) { clock.current.bpm = bpm; clock.current.swing = swing } }, [bpm, swing])
  const toggle = (voice: number, current: number) => setGrid((old) => old.map((row, ri) => row.map((cell, si) => ri === voice && si === current ? !cell : cell)))
  return <><div className="transport"><button className={`play-button ${playing ? 'playing' : ''}`} onClick={togglePlay}>{playing ? '■ Stop' : '▶ Play'}</button><label>BPM <input type="number" min="60" max="160" value={bpm} onChange={(e) => setBpm(Math.max(60, Math.min(160, Number(e.target.value))))}/></label><label>Swing <input type="range" min="0" max="0.6" step="0.01" value={swing} onChange={(e) => setSwing(Number(e.target.value))}/><span>{Math.round(swing * 100)}%</span></label><button className="text-button" onClick={clearPattern}>Clear</button></div><div className="sequencer-card"><div className="beat-count"><span/>{Array.from({ length: 16 }, (_, i) => <b key={i}>{i % 4 === 0 ? i / 4 + 1 : '·'}</b>)}</div>{grid.map((row, voice) => <div className="seq-row" key={DRUM_NAMES[voice]}><button className="voice-trigger" onClick={() => trigger(voice, .8)}>{DRUM_NAMES[voice]}</button>{row.map((active, current) => <button key={current} className={`step-cell ${active ? 'active' : ''} ${step === current ? 'current' : ''}`} onClick={() => toggle(voice, current)} aria-label={`${DRUM_NAMES[voice]}, step ${current + 1}`} aria-pressed={active}/>)}</div>)}</div><p className="record-tip"><i/> While the beat plays, your pad hits drop into the nearest step.</p></>
}
