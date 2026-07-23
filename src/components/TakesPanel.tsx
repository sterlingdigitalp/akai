import { useEffect, useRef, useState } from 'react'
import { DeviceView } from './device/DeviceView'
import { isRecording, playTake, recordingElapsedMs, startRecording, stopRecording, type Take } from '../audio/recorder'
import { useTakesStore } from '../state/takesStore'

const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const dateLabel = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/ (am|pm)$/, '$1')

export function TakesPanel() {
  const takes = useTakesStore((s) => s.takes); const addTake = useTakesStore((s) => s.addTake); const removeTake = useTakesStore((s) => s.removeTake); const renameTake = useTakesStore((s) => s.renameTake)
  const [recording, setRecording] = useState(false); const [elapsed, setElapsed] = useState<number | null>(null); const [playingId, setPlayingId] = useState<string | null>(null); const [editingId, setEditingId] = useState<string | null>(null); const [editName, setEditName] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  useEffect(() => { if (isRecording()) { setRecording(true); setElapsed(recordingElapsedMs()) } }, [])
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setElapsed(recordingElapsedMs()), 250); return () => clearInterval(timer) }, [recording])
  useEffect(() => () => stopRef.current?.(), [])
  const toggleRecord = () => {
    if (recording) { const take = stopRecording(`Take ${takes.length + 1}`); setRecording(false); setElapsed(null); if (take) addTake(take); return }
    startRecording(); setRecording(true); setElapsed(null)
  }
  const togglePlay = (take: Take) => {
    if (playingId === take.id) { stopRef.current?.(); stopRef.current = null; setPlayingId(null); return }
    stopRef.current?.(); stopRef.current = playTake(take, () => { setPlayingId(null); stopRef.current = null }); setPlayingId(take.id)
  }
  const commitRename = (id: string) => { const name = editName.trim(); if (name) renameTake(id, name); setEditingId(null) }
  return <>
    <div className="control-bar takes-transport"><div><span className="control-label">Takes</span><p className="lead">Play something, catch it, come back to it later.</p></div><button className={`button primary record-button ${recording ? 'is-recording' : ''}`} onClick={toggleRecord}>{recording ? <>■ Stop <span className="record-timer">{elapsed === null ? 'play to start' : clock(elapsed)}</span></> : '● Record'}</button></div>
    {takes.length === 0 ? <div className="empty-state takes-empty"><p className="lead">Hit record, play a few bars on the keys or pads, and your first take will land right here.</p></div> : <ul className="takes-list">{takes.map((take) => <li className="take-row" key={take.id}>
      {editingId === take.id
        ? <input className="take-name-input" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={() => commitRename(take.id)} onKeyDown={(e) => { if (e.key === 'Enter') commitRename(take.id); if (e.key === 'Escape') setEditingId(null) }}/>
        : <button className="take-name text-button" onClick={() => { setEditingId(take.id); setEditName(take.name) }}>{take.name}</button>}
      <span className="take-date">{dateLabel(take.createdAt)}</span>
      <span className="take-duration">{clock(take.durationMs)}</span>
      <button className="button secondary take-play" onClick={() => togglePlay(take)}>{playingId === take.id ? '■ Stop' : '▶ Play'}</button>
      <button className="text-button take-delete" onClick={() => removeTake(take.id)}>Delete</button>
    </li>)}</ul>}
    <DeviceView/>
  </>
}
