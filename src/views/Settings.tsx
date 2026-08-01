import { invoke } from '@tauri-apps/api/core'
import { useEffect, useRef, useState } from 'react'
import { isTauri } from '../midi/tauri'
import { setDemoMode, subscribeRawMidi } from '../midi/midi'
import type { ParsedMidiMessage } from '../midi/parser'
import { useMidiStore } from '../state/midiStore'
import { useProfileStore } from '../state/profileStore'
import { useProgressStore } from '../state/progressStore'
import { useDiagnosticsStore } from '../state/diagnosticsStore'
import { DATA_SCHEMA_VERSION, parseWoodshedData, type WoodshedData } from '../state/dataSchema'
import { usePatternStore } from '../state/patternStore'
import { useTakesStore } from '../state/takesStore'
import { useAudioOutputStore } from '../state/audioOutputStore'

type RawLine = { time: string; message: ParsedMidiMessage; bytes: number[]; port?: string }

function exportData(): WoodshedData {
  const { lessons, practiceDays } = useProgressStore.getState()
  return {
    schema: 'woodshed',
    version: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    progress: { lessons, practiceDays },
    profile: useProfileStore.getState().profile,
    pattern: usePatternStore.getState().pattern,
    takes: useTakesStore.getState().takes,
    diagnostics: {
      enabled: useDiagnosticsStore.getState().enabled,
      sessions: useDiagnosticsStore.getState().sessions,
    },
  }
}

export function Settings() {
  type CalibrationTarget = 'pads' | 'knobs' | 'keys' | 'mod'
  const status = useMidiStore((state) => state.status)
  const learnPad = useProfileStore((state) => state.learnPad)
  const learnKnob = useProfileStore((state) => state.learnKnob)
  const learnKeyChannel = useProfileStore((state) => state.learnKeyChannel)
  const learnModCC = useProfileStore((state) => state.learnModCC)
  const resetProgress = useProgressStore((state) => state.reset)
  const [confirm, setConfirm] = useState(false)
  const [raw, setRaw] = useState<RawLine[]>([])
  const [calibrating, setCalibrating] = useState<CalibrationTarget | null>(null)
  const [calCount, setCalCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [dataMessage, setDataMessage] = useState('')
  const [importText, setImportText] = useState('')
  const calibrationRef = useRef<{ target: CalibrationTarget; captured: Set<number>; port?: string } | null>(null)
  const diagnosticsEnabled = useDiagnosticsStore((state) => state.enabled)
  const setDiagnosticsEnabled = useDiagnosticsStore((state) => state.setEnabled)
  const diagnosticsSessions = useDiagnosticsStore((state) => state.sessions)
  const clearDiagnostics = useDiagnosticsStore((state) => state.clear)
  const [diagMessage, setDiagMessage] = useState('')
  const audioEnabled = useAudioOutputStore((state) => state.enabled)
  const setAudioEnabled = useAudioOutputStore((state) => state.setEnabled)

  useEffect(() => subscribeRawMidi((message, bytes, port) => {
    setRaw((lines) => [{ time: new Date().toLocaleTimeString(), message, bytes, port }, ...lines].slice(0, 12))
  }), [])

  useEffect(() => subscribeRawMidi((message, _bytes, port) => {
    const session = calibrationRef.current
    if (!session) return
    const value = session.target === 'pads' && message.type === 'noteOn'
      ? message.note
      : session.target === 'knobs' && message.type === 'cc' ? message.controller : null
    if (session.target === 'keys' && message.type === 'noteOn') {
      learnKeyChannel(message.channel); calibrationRef.current = null; setCalibrating(null); setCalCount(1); return
    }
    if (session.target === 'mod' && message.type === 'cc') {
      learnModCC(message.controller); calibrationRef.current = null; setCalibrating(null); setCalCount(1); return
    }
    if (value === null || session.captured.has(value)) return
    if (session.port && port !== session.port) return
    if (!session.port && port) session.port = port
    const index = session.captured.size
    session.captured.add(value)
    if (session.target === 'pads' && message.type === 'noteOn') learnPad(index, message.note, message.channel)
    else if (message.type === 'cc') learnKnob(index, message.controller)
    setCalCount(session.captured.size)
    if (session.captured.size >= 8) {
      calibrationRef.current = null
      setCalibrating(null)
    }
  }), [learnPad, learnKnob, learnKeyChannel, learnModCC])

  const beginCalibration = (target: CalibrationTarget) => {
    calibrationRef.current = { target, captured: new Set() }
    setCalibrating(target)
    setCalCount(0)
  }

  const handleExport = async () => {
    setExporting(true)
    setDataMessage('')
    const data = JSON.stringify(exportData(), null, 2)
    try {
      if (isTauri()) {
        const path = await invoke<string>('export_json', { data, filename: 'woodshed-progress.json' })
        setDataMessage(`Saved a copy to ${path}`)
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = 'woodshed-progress.json'
        link.click()
        URL.revokeObjectURL(url)
        setDataMessage('Your Woodshed data has been downloaded.')
      }
    } catch {
      setDataMessage('Woodshed couldn’t export your data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const copyDiagnostics = async () => {
    setDiagMessage('')
    const payload = { app: 'woodshed', capturedAt: new Date().toISOString(), profile: useProfileStore.getState().profile, sessions: useDiagnosticsStore.getState().sessions }
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload))
      setDiagMessage('Copied to your clipboard.')
    } catch {
      setDiagMessage('Woodshed couldn’t copy that. Please try again.')
    }
  }

  const handleImport = () => {
    try {
      const data = parseWoodshedData(importText)
      useProgressStore.setState({ lessons: data.progress.lessons, practiceDays: data.progress.practiceDays })
      useProfileStore.setState({ profile: data.profile })
      usePatternStore.setState({ pattern: data.pattern })
      useTakesStore.setState({ takes: data.takes })
      useDiagnosticsStore.setState({ enabled: data.diagnostics.enabled, sessions: data.diagnostics.sessions })
      setImportText('')
      setDataMessage('Your progress, setup, beat, takes, and diagnostics are ready.')
    } catch {
      setDataMessage('That doesn’t look like a Woodshed export. Check the text and try again.')
    }
  }

  return <section className="settings">
    <div className="page-title"><div><p className="eyebrow">Make it yours</p><h1>Settings</h1></div></div>
    <div className="settings-list">
      <article className="setting-card">
        <div><h2>Your controller</h2><p>{calibrating ? calibrating === 'pads' ? `Press each pad in order — ${calCount} of 8 learned.` : calibrating === 'knobs' ? `Turn each knob in order — ${calCount} of 8 learned.` : calibrating === 'keys' ? 'Press one piano key to learn its MIDI channel.' : 'Move only the mod wheel to learn its controller number.' : 'Teach Woodshed your pad, knob, key-channel, and mod-wheel layout again at any time.'}</p></div>
        <div className="setting-actions"><button className="button secondary" onClick={() => beginCalibration('pads')}>Recalibrate pads</button><button className="button secondary" onClick={() => beginCalibration('knobs')}>Recalibrate knobs</button><button className="button secondary" onClick={() => beginCalibration('keys')}>Learn key channel</button><button className="button secondary" onClick={() => beginCalibration('mod')}>Learn mod wheel</button></div>
      </article>
      <article className="setting-card">
        <div><h2>Demo mode</h2><p>Use the on-screen controller when your MPK isn’t nearby.</p></div>
        <button className={`toggle ${status === 'demo' ? 'on' : ''}`} role="switch" aria-checked={status === 'demo'} onClick={() => setDemoMode(status !== 'demo')}><i/></button>
      </article>
      <article className="setting-card">
        <div><h2>Woodshed audio</h2><p>Mute Woodshed’s synth and drums when monitoring another app. GarageBand lessons mute Woodshed automatically.</p></div>
        <button className={`toggle ${audioEnabled ? 'on' : ''}`} role="switch" aria-label="Woodshed audio" aria-checked={audioEnabled} onClick={() => setAudioEnabled(!audioEnabled)}><i/></button>
      </article>
      <article className="setting-card data-card">
        <div className="data-copy">
          <h2>Your data</h2>
          <p>Keep a versioned portable copy of your lesson progress, controller setup, saved beat, takes, and diagnostics.</p>
          {dataMessage && <p className="data-message" role="status">{dataMessage}</p>}
          <details className="import-details">
            <summary>Import a previous export</summary>
            <div className="import-form">
              <label htmlFor="woodshed-import">Paste the contents of your Woodshed export</label>
              <textarea id="woodshed-import" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste your export here…"/>
              <button className="button secondary" disabled={!importText.trim()} onClick={handleImport}>Apply imported data</button>
            </div>
          </details>
        </div>
        <button className="button secondary" disabled={exporting} onClick={() => void handleExport()}>{exporting ? 'Exporting…' : 'Export progress'}</button>
      </article>
      <article className="setting-card data-card">
        <div className="data-copy">
          <h2>Lesson diagnostics</h2>
          <p>While you do lessons, Woodshed quietly records what your keyboard actually sends — including messages it doesn’t recognize yet — so we can fix the lessons when something doesn’t work. It stays on this device. Nothing is sent anywhere.</p>
          <p>{diagnosticsSessions.length} step session{diagnosticsSessions.length === 1 ? '' : 's'} stored.</p>
          {diagMessage && <p className="data-message" role="status">{diagMessage}</p>}
        </div>
        <div className="setting-actions">
          <button className={`toggle ${diagnosticsEnabled ? 'on' : ''}`} role="switch" aria-checked={diagnosticsEnabled} onClick={() => setDiagnosticsEnabled(!diagnosticsEnabled)}><i/></button>
          <button className="button secondary" onClick={() => void copyDiagnostics()}>Copy diagnostics</button>
          <button className="button secondary" onClick={clearDiagnostics}>Clear</button>
        </div>
      </article>
      <article className="setting-card danger">
        <div><h2>Start fresh</h2><p>Clear lesson completions and your practice history. Your controller setup stays put.</p></div>
        {confirm ? <div className="confirm-row"><span>Are you sure?</span><button className="button primary" onClick={() => { resetProgress(); setConfirm(false) }}>Reset progress</button><button className="text-button" onClick={() => setConfirm(false)}>Cancel</button></div> : <button className="button secondary" onClick={() => setConfirm(true)}>Reset progress</button>}
      </article>
      <details className="developer-details"><summary>Developer details</summary><div className="monitor"><div><span>Build {__BUILD_SHA__}</span><small>Raw messages and source-port identity appear only here.</small></div>{raw.length ? raw.map((line, index) => <code key={`${line.time}-${index}`}>{line.time} · {line.port ?? 'unknown port'} · {line.message.type} · [{line.bytes.join(', ')}] · {JSON.stringify(line.message)}</code>) : <p>Move a hardware control to see its raw message.</p>}</div></details>
    </div>
  </section>
}
