import { useMemo, useRef, useState } from 'react'
import { demoControl } from '../../midi/demo'
import type { ControlKind } from '../../midi/types'
import { useMidiStore } from '../../state/midiStore'
import './device.css'

const BLACKS = new Set([1, 3, 6, 8, 10])
const VIEWBOX_HEIGHT = 520
const WHEEL_TRAVEL_TOP = 101
const WHEEL_TRAVEL_BOTTOM = 166
const isBlack = (note: number) => BLACKS.has(((note % 12) + 12) % 12)

export function DeviceView({ compact = false }: { compact?: boolean }) {
  const held = useMidiStore((state) => state.heldKeys)
  const knobs = useMidiStore((state) => state.knobValues)
  const flash = useMidiStore((state) => state.padFlash)
  const wheels = useMidiStore((state) => state.wheels)
  const [dragKnob, setDragKnob] = useState<number | null>(null)
  const lastY = useRef(0)
  const visibleStart = useMemo(() => {
    const notes = [...held]
    if (!notes.length) return 48
    const latest = notes[notes.length - 1] ?? 60
    if (latest < 48 || latest > 72) return Math.max(0, Math.floor((latest - 12) / 12) * 12)
    return 48
  }, [held])
  const notes = Array.from({ length: 25 }, (_, index) => visibleStart + index)
  const whites = notes.filter((note) => !isBlack(note))
  const blackNotes = notes.filter(isBlack)
  const whiteIndexBefore = (note: number) => notes.filter((candidate) => candidate < note && !isBlack(candidate)).length

  const knobDown = (index: number, event: React.PointerEvent<SVGGElement>) => {
    setDragKnob(index)
    lastY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const knobMove = (index: number, event: React.PointerEvent<SVGGElement>) => {
    if (dragKnob !== index) return
    const next = knobs[index]! + (lastY.current - event.clientY) / 130
    lastY.current = event.clientY
    demoControl('knob', index, next)
  }
  const wheelMove = (kind: Extract<ControlKind, 'pitch' | 'mod'>, event: React.PointerEvent<SVGGElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const pointerY = (event.clientY - bounds.top) * VIEWBOX_HEIGHT / bounds.height
    demoControl(kind, 0, (WHEEL_TRAVEL_BOTTOM - pointerY) / (WHEEL_TRAVEL_BOTTOM - WHEEL_TRAVEL_TOP))
  }
  const wheelUp = (kind: Extract<ControlKind, 'pitch' | 'mod'>, event: React.PointerEvent<SVGGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (kind === 'pitch') demoControl('pitch', 0, .5)
  }

  return (
    <div className={`device-wrap ${compact ? 'is-compact' : ''}`}>
      <div className="device-caption"><span>MPK mini</span><span className="device-caption-model">PLAYABLE SURFACE</span></div>
      <svg className="device" viewBox="0 0 1280 520" role="group" aria-label="Interactive on-screen MPK Mini keyboard">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#282526"/><stop offset="1" stopColor="#151314"/></linearGradient>
          <linearGradient id="wheel" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#171516"/><stop offset=".5" stopColor="#454142"/><stop offset="1" stopColor="#111011"/></linearGradient>
          <radialGradient id="browse" cx="40%" cy="34%"><stop stopColor="#454142"/><stop offset=".72" stopColor="#1b191a"/><stop offset="1" stopColor="#0b0a0a"/></radialGradient>
          <filter id="padGlow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x="8" y="8" width="1264" height="504" rx="30" fill="url(#body)" stroke="#3a3536" strokeWidth="2"/>
        <path d="M30 32h1220" stroke="rgba(255,255,255,.08)"/>
        <text x="47" y="61" fill="#ef493f" fontSize="27" fontWeight="700" letterSpacing="-1">AKAI</text>
        <text x="116" y="61" fill="#aaa3a4" fontSize="13" letterSpacing="2">professional</text>

        {([
          { kind: 'pitch' as const, x: 53, value: wheels.pitch, label: 'PITCH' },
          { kind: 'mod' as const, x: 113, value: wheels.mod, label: 'MOD' },
        ]).map(({ kind, x, value, label }) => {
          const y = WHEEL_TRAVEL_BOTTOM - value * (WHEEL_TRAVEL_BOTTOM - WHEEL_TRAVEL_TOP)
          return <g key={kind} className="svg-wheel" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); wheelMove(kind, event) }} onPointerMove={(event) => wheelMove(kind, event)} onPointerUp={(event) => wheelUp(kind, event)} onPointerCancel={(event) => wheelUp(kind, event)} role="slider" aria-label={`${label} wheel`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} tabIndex={0}>
            <rect x={x} y="78" width="48" height="111" rx="18" fill="#090808" stroke="#403b3c" strokeWidth="2"/>
            <rect x={x + 9} y={y - 25} width="30" height="50" rx="10" fill="url(#wheel)" stroke="#5a5556" strokeWidth="1.5"/>
            {[-15, -7, 1, 9, 17].map((offset) => <line key={offset} x1={x + 13} x2={x + 35} y1={y + offset} y2={y + offset} stroke="#777173" strokeWidth="2" opacity=".62"/>)}
            <text x={x + 24} y="205" textAnchor="middle" fill="#8b8586" fontSize="10" fontWeight="650" letterSpacing="1.2">{label}</text>
          </g>
        })}
        <g className="octave-buttons" aria-hidden="true">
          <rect x="51" y="218" width="51" height="25" rx="5" fill="#1a1819" stroke="#4b4647"/>
          <rect x="111" y="218" width="51" height="25" rx="5" fill="#1a1819" stroke="#4b4647"/>
          <text x="76.5" y="234" textAnchor="middle" fill="#777173" fontSize="9" letterSpacing=".6">OCT−</text>
          <text x="136.5" y="234" textAnchor="middle" fill="#777173" fontSize="9" letterSpacing=".6">OCT+</text>
        </g>

        {Array.from({ length: 8 }, (_, index) => {
          const column = index % 4
          const row = index < 4 ? 1 : 0
          const x = 205 + column * 99
          const y = 71 + row * 91
          const active = flash?.index === index && performance.now() - flash.ts < 260
          const velocity = active ? flash.velocity : 0
          return <g key={`pad-${index}`} className={active ? 'svg-pad is-hit' : 'svg-pad'} style={{ transformOrigin: `${x + 41}px ${y + 36}px` }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); demoControl('pad', index, .82, true) }} onPointerUp={() => demoControl('pad', index, 0, false)} role="button" aria-label={`Pad ${index + 1}`} tabIndex={0}>
            <rect x={x} y={y} width="82" height="72" rx="11" fill={active ? `hsl(${6 + velocity * 30} 90% ${46 + velocity * 12}%)` : '#1d1b1c'} stroke={active ? '#ffaf3f' : '#4c4748'} strokeWidth="2" filter={active ? 'url(#padGlow)' : undefined}/>
            <text x={x + 41} y={y + 43} textAnchor="middle" fill={active ? '#180b04' : '#777173'} fontSize="16" fontWeight="700">{index + 1}</text>
          </g>
        })}

        <g className="device-display" aria-hidden="true">
          <rect x="619" y="72" width="166" height="72" rx="7" fill="#070b0d" stroke="#4a4647" strokeWidth="2"/>
          <rect x="627" y="80" width="150" height="56" rx="3" fill="#071218" stroke="#102b38"/>
          <text x="638" y="101" fill="#74b8d8" fontSize="12" fontFamily="monospace">Prg 1</text>
          <text x="638" y="123" fill="#5597b7" fontSize="12" fontFamily="monospace" letterSpacing="1">WOODSHED</text>
          <text x="768" y="101" textAnchor="end" fill="#477f99" fontSize="9" fontFamily="monospace">BPM 120</text>
          <circle cx="702" cy="201" r="35" fill="#0a0909" stroke="#464142" strokeWidth="3"/>
          <circle cx="702" cy="201" r="28" fill="url(#browse)" stroke="#5b5556"/>
          <line x1="702" y1="201" x2="690" y2="181" stroke="#b8b0ad" strokeWidth="3" strokeLinecap="round"/>
          <text x="702" y="247" textAnchor="middle" fill="#777173" fontSize="9" letterSpacing="1.1">BROWSE</text>
        </g>

        {Array.from({ length: 8 }, (_, index) => {
          const x = 866 + (index % 4) * 94
          const y = 103 + Math.floor(index / 4) * 102
          const value = knobs[index] ?? .5
          const angle = -135 + value * 270
          const radians = angle * Math.PI / 180
          return <g key={`knob-${index}`} className="svg-knob" onPointerDown={(event) => knobDown(index, event)} onPointerMove={(event) => knobMove(index, event)} onPointerUp={() => setDragKnob(null)} onPointerCancel={() => setDragKnob(null)} role="slider" aria-label={`Knob ${index + 1}`} aria-valuenow={Math.round(value * 100)} tabIndex={0}>
            <circle cx={x} cy={y} r="26" fill="#0b0a0a" stroke="#474243" strokeWidth="3"/>
            <path d={`M ${x + Math.cos(-135 * Math.PI / 180) * 33} ${y + Math.sin(-135 * Math.PI / 180) * 33} A 33 33 0 ${value > .67 ? 1 : 0} 1 ${x + Math.cos(radians) * 33} ${y + Math.sin(radians) * 33}`} fill="none" stroke="#ef493f" strokeWidth="4" strokeLinecap="round"/>
            <line x1={x} y1={y} x2={x + Math.cos(radians) * 18} y2={y + Math.sin(radians) * 18} stroke="#eee8e1" strokeWidth="3" strokeLinecap="round"/>
            <text x={x} y={y + 43} textAnchor="middle" fill="#777173" fontSize="11">{index + 1}</text>
          </g>
        })}

        <g className="keys">
          {whites.map((note, index) => <rect key={note} x={47 + index * 79} y="272" width="77" height="215" rx={3} fill={held.has(note) ? '#ffae43' : '#e8e3dc'} stroke="#181617" strokeWidth="2" className="svg-key" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Piano key" tabIndex={0}/>) }
          {blackNotes.map((note) => {
            const prior = whiteIndexBefore(note)
            return <rect key={note} x={47 + prior * 79 - 25} y="272" width="50" height="133" rx={2.5} fill={held.has(note) ? '#d94339' : '#151314'} stroke="#050505" strokeWidth="2" className="svg-key black" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Black piano key" tabIndex={0}/>
          })}
        </g>
      </svg>
      <p className="device-help">Play the keys and pads, drag knobs or wheels up and down, and shape the sound.</p>
    </div>
  )
}
