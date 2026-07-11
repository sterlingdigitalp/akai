import { useEffect } from 'react'
import './App.css'
import { Shell } from './components/Shell'
import { startMidi, subscribeControls } from './midi/midi'
import { noteOff, noteOn, setModDepth, setParam, setPitchBend } from './audio/synth'
import { trigger } from './audio/drums'
import { useUiStore } from './state/uiStore'
import { Home } from './views/Home'
import { LessonView } from './views/Lesson'
import { Playground } from './views/Playground'
import { Settings } from './views/Settings'

function AudioBridge() {
  useEffect(() => subscribeControls((event) => {
    if (event.kind === 'key') event.on === false ? noteOff(event.index) : noteOn(event.index, event.value)
    if (event.kind === 'pad' && event.on !== false) trigger(event.index, event.value)
    if (event.kind === 'knob' && event.index < 4) setParam((['cutoff', 'resonance', 'release', 'delaySend'] as const)[event.index]!, event.value)
    if (event.kind === 'pitch') setPitchBend(event.value)
    if (event.kind === 'mod') setModDepth(event.value)
  }), [])
  return null
}
export default function App() {
  const view = useUiStore((s) => s.view)
  useEffect(() => { void startMidi() }, [])
  return <Shell><AudioBridge/>{view === 'home' && <Home/>}{view === 'lesson' && <LessonView/>}{view === 'playground' && <Playground/>}{view === 'settings' && <Settings/>}</Shell>
}
