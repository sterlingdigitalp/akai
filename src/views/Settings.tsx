import { useEffect, useRef, useState } from 'react'
import { setDemoMode, subscribeRawMidi } from '../midi/midi'
import type { ParsedMidiMessage } from '../midi/parser'
import { useMidiStore } from '../state/midiStore'
import { useProfileStore } from '../state/profileStore'
import { useProgressStore } from '../state/progressStore'

type RawLine = { time: string; message: ParsedMidiMessage; bytes: number[] }
export function Settings() {
  const status = useMidiStore((s) => s.status); const learnPad = useProfileStore((s) => s.learnPad); const learnKnob = useProfileStore((s) => s.learnKnob); const resetProgress = useProgressStore((s) => s.reset); const [confirm, setConfirm] = useState(false); const [raw, setRaw] = useState<RawLine[]>([]); const [calibrating, setCalibrating] = useState<'pads' | 'knobs' | null>(null); const [calCount, setCalCount] = useState(0); const calibrationRef = useRef<{ target: 'pads' | 'knobs'; captured: Set<number> } | null>(null)
  useEffect(() => subscribeRawMidi((message, bytes) => setRaw((lines) => [{ time: new Date().toLocaleTimeString(), message, bytes }, ...lines].slice(0, 12))), [])
  useEffect(() => subscribeRawMidi((message) => {
    const session = calibrationRef.current; if (!session) return
    const value = session.target === 'pads' && message.type === 'noteOn' ? message.note : session.target === 'knobs' && message.type === 'cc' ? message.controller : null
    if (value === null || session.captured.has(value)) return
    const index = session.captured.size; session.captured.add(value); session.target === 'pads' && message.type === 'noteOn' ? learnPad(index, message.note, message.channel) : message.type === 'cc' && learnKnob(index, message.controller); setCalCount(session.captured.size)
    if (session.captured.size >= 8) { calibrationRef.current = null; setCalibrating(null) }
  }), [learnPad, learnKnob])
  const beginCalibration = (target: 'pads' | 'knobs') => { calibrationRef.current = { target, captured: new Set() }; setCalibrating(target); setCalCount(0) }
  return <section className="settings"><div className="page-title"><div><p className="eyebrow">Make it yours</p><h1>Settings</h1></div></div><div className="settings-list"><article className="setting-card"><div><h2>Your controller</h2><p>{calibrating ? `${calibrating === 'pads' ? 'Press each pad' : 'Turn each knob'} in order — ${calCount} of 8 learned.` : 'Teach Woodshed your pad and knob layout again at any time.'}</p></div><div className="setting-actions"><button className="button secondary" onClick={() => beginCalibration('pads')}>Recalibrate pads</button><button className="button secondary" onClick={() => beginCalibration('knobs')}>Recalibrate knobs</button></div></article><article className="setting-card"><div><h2>Demo mode</h2><p>Use the on-screen controller when your MPK isn’t nearby.</p></div><button className={`toggle ${status === 'demo' ? 'on' : ''}`} role="switch" aria-checked={status === 'demo'} onClick={() => setDemoMode(status !== 'demo')}><i/></button></article><article className="setting-card danger"><div><h2>Start fresh</h2><p>Clear lesson completions and your practice history. Your controller setup stays put.</p></div>{confirm ? <div className="confirm-row"><span>Are you sure?</span><button className="button primary" onClick={() => { resetProgress(); setConfirm(false) }}>Reset progress</button><button className="text-button" onClick={() => setConfirm(false)}>Cancel</button></div> : <button className="button secondary" onClick={() => setConfirm(true)}>Reset progress</button>}</article><details className="developer-details"><summary>Developer details</summary><div className="monitor"><div><span>Live MIDI monitor</span><small>Raw messages appear only here.</small></div>{raw.length ? raw.map((line, i) => <code key={`${line.time}-${i}`}>{line.time} · {line.message.type} · [{line.bytes.join(', ')}] · {JSON.stringify(line.message)}</code>) : <p>Move a hardware control to see its raw message.</p>}</div></details></div></section>
}
