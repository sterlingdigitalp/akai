import { useEffect } from 'react'
import './App.css'
import { Shell } from './components/Shell'
import { panicMidi, startMidi, subscribeControls, subscribeMidiPanic } from './midi/midi'
import { allNotesOff, noteOff, noteOn, setModDepth, setParam, setPitchBend } from './audio/synth'
import { trigger } from './audio/drums'
import { setEngineParam, unlockAudioOnGesture } from './audio/engine'
import { useUiStore } from './state/uiStore'
import { useAudioOutputStore } from './state/audioOutputStore'
import { Home } from './views/Home'
import { LessonView } from './views/Lesson'
import { Playground } from './views/Playground'
import { Settings } from './views/Settings'

function AudioBridge() {
  useEffect(() => subscribeControls((event) => {
    const ui = useUiStore.getState()
    const garageBandLesson = ui.view === 'lesson' && (ui.activeLessonId === 'daw' || ui.activeLessonId === 'live-set')
    if (!useAudioOutputStore.getState().enabled || garageBandLesson) return
    if (event.kind === 'key') {
      if (event.on === false) noteOff(event.index)
      else noteOn(event.index, event.value)
    }
    if (event.kind === 'pad' && event.on !== false) trigger(event.index, event.value)
    if (event.kind === 'knob' && event.index < 5) setParam((['cutoff', 'resonance', 'release', 'delaySend', 'attack'] as const)[event.index]!, event.value)
    if (event.kind === 'knob' && event.index >= 5) setEngineParam((['master', 'delayTime', 'feedback'] as const)[event.index - 5]!, event.value)
    if (event.kind === 'pitch') setPitchBend(event.value)
    if (event.kind === 'mod') setModDepth(event.value)
  }), [])
  return null
}
export default function App() {
  const view = useUiStore((s) => s.view)
  useEffect(() => {
    void startMidi()
    unlockAudioOnGesture()
    const panic = panicMidi
    const visibility = () => { if (document.visibilityState === 'hidden') panic() }
    window.addEventListener('blur', panic)
    window.addEventListener('pagehide', panic)
    document.addEventListener('visibilitychange', visibility)
    const stopUi = useUiStore.subscribe((state, previous) => {
      const wasDaw = previous.view === 'lesson' && (previous.activeLessonId === 'daw' || previous.activeLessonId === 'live-set')
      const isDaw = state.view === 'lesson' && (state.activeLessonId === 'daw' || state.activeLessonId === 'live-set')
      if (!wasDaw && isDaw) allNotesOff()
    })
    const stopAudio = useAudioOutputStore.subscribe((state) => { if (!state.enabled) allNotesOff() })
    const stopMidiPanic = subscribeMidiPanic(allNotesOff)
    return () => {
      window.removeEventListener('blur', panic)
      window.removeEventListener('pagehide', panic)
      document.removeEventListener('visibilitychange', visibility)
      stopUi()
      stopAudio()
      panic()
      stopMidiPanic()
    }
  }, [])
  return <Shell><AudioBridge/>{view === 'home' && <Home/>}{view === 'lesson' && <LessonView/>}{view === 'playground' && <Playground/>}{view === 'settings' && <Settings/>}</Shell>
}
