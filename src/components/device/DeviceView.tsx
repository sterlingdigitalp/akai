import { useMemo, useRef, useState } from 'react'
import { demoControl } from '../../midi/demo'
import { useMidiStore } from '../../state/midiStore'
import './device.css'

const BLACKS = new Set([1, 3, 6, 8, 10])
const isBlack = (note: number) => BLACKS.has(((note % 12) + 12) % 12)

export function DeviceView({ compact = false }: { compact?: boolean }) {
  const held = useMidiStore((s) => s.heldKeys)
  const knobs = useMidiStore((s) => s.knobValues)
  const flash = useMidiStore((s) => s.padFlash)
  const joy = useMidiStore((s) => s.joy)
  const [dragKnob, setDragKnob] = useState<number | null>(null)
  const lastY = useRef(0)
  const visibleStart = useMemo(() => {
    const notes = [...held]
    if (!notes.length) return 48
    const latest = notes[notes.length - 1] ?? 60
    if (latest < 48 || latest > 72) return Math.max(0, Math.floor((latest - 12) / 12) * 12)
    return 48
  }, [held])
  const notes = Array.from({ length: 25 }, (_, i) => visibleStart + i)
  const whites = notes.filter((note) => !isBlack(note))
  const blackNotes = notes.filter(isBlack)
  const whiteIndexBefore = (note: number) => notes.filter((n) => n < note && !isBlack(n)).length

  const knobDown = (index: number, event: React.PointerEvent<SVGGElement>) => { setDragKnob(index); lastY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId) }
  const knobMove = (index: number, event: React.PointerEvent<SVGGElement>) => {
    if (dragKnob !== index) return
    const next = knobs[index]! + (lastY.current - event.clientY) / 130; lastY.current = event.clientY; demoControl('knob', index, next)
  }
  const joyMove = (event: React.PointerEvent<SVGCircleElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const svg = event.currentTarget.ownerSVGElement!.getBoundingClientRect(); demoControl('joyX', 0, (event.clientX - svg.left) / svg.width); demoControl('joyY', 0, 1 - (event.clientY - svg.top) / svg.height)
  }
  return (
    <div className={`device-wrap ${compact ? 'is-compact' : ''}`}>
      <div className="device-caption"><span>MPK mini</span><span className="device-caption-model">PLAYABLE SURFACE</span></div>
      <svg className="device" viewBox="0 0 1120 490" role="group" aria-label="Interactive on-screen MPK Mini keyboard">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#282526"/><stop offset="1" stopColor="#151314"/></linearGradient>
          <filter id="padGlow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x="8" y="8" width="1104" height="474" rx="30" fill="url(#body)" stroke="#3a3536" strokeWidth="2"/>
        <path d="M30 32h1060" stroke="rgba(255,255,255,.08)"/>
        <text x="54" y="72" fill="#ef493f" fontSize="28" fontWeight="700" letterSpacing="-1">AKAI</text>
        <text x="125" y="72" fill="#aaa3a4" fontSize="14" letterSpacing="2">professional</text>
        <rect x="50" y="102" width="96" height="96" rx="18" fill="#0c0b0b" stroke="#403a3b"/>
        <circle cx={98 + (joy.x - .5) * 45} cy={150 - (joy.y - .5) * 45} r="17" fill="#e7e2dc" stroke="#777" strokeWidth="5" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); joyMove(e) }} onPointerMove={joyMove} onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); demoControl('joyX', 0, .5); demoControl('joyY', 0, .5) }} style={{ cursor: 'grab' }}/>
        <text x="62" y="220" fill="#777" fontSize="10" letterSpacing="1">PITCH / MOD</text>
        {Array.from({ length: 8 }, (_, index) => {
          const x = 204 + (index % 4) * 100; const y = 77 + Math.floor(index / 4) * 105; const value = knobs[index] ?? .5; const angle = -135 + value * 270; const rad = angle * Math.PI / 180
          return <g key={`knob-${index}`} className="svg-knob" onPointerDown={(e) => knobDown(index, e)} onPointerMove={(e) => knobMove(index, e)} onPointerUp={() => setDragKnob(null)} role="slider" aria-label={`Knob ${index + 1}`} aria-valuenow={Math.round(value * 100)} tabIndex={0}>
            <circle cx={x} cy={y} r="28" fill="#0b0a0a" stroke="#474243" strokeWidth="3"/>
            <path d={`M ${x + Math.cos((-135) * Math.PI / 180) * 35} ${y + Math.sin((-135) * Math.PI / 180) * 35} A 35 35 0 ${value > .67 ? 1 : 0} 1 ${x + Math.cos(rad) * 35} ${y + Math.sin(rad) * 35}`} fill="none" stroke="#ef493f" strokeWidth="4" strokeLinecap="round"/>
            <line x1={x} y1={y} x2={x + Math.cos(rad) * 19} y2={y + Math.sin(rad) * 19} stroke="#eee8e1" strokeWidth="3" strokeLinecap="round"/>
            <text x={x} y={y + 48} textAnchor="middle" fill="#777" fontSize="11">{index + 1}</text>
          </g>
        })}
        {Array.from({ length: 8 }, (_, index) => {
          const col = index % 4; const row = Math.floor(index / 4); const x = 640 + col * 106; const y = 45 + row * 106; const active = flash?.index === index && performance.now() - flash.ts < 260; const velocity = active ? flash.velocity : 0
          return <g key={`pad-${index}`} className={active ? 'svg-pad is-hit' : 'svg-pad'} style={{ transformOrigin: `${x + 44}px ${y + 42}px` }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); demoControl('pad', index, .82, true) }} onPointerUp={() => demoControl('pad', index, 0, false)} role="button" aria-label={`Pad ${index + 1}`} tabIndex={0}>
            <rect x={x} y={y} width="88" height="82" rx="12" fill={active ? `hsl(${6 + velocity * 30} 90% ${46 + velocity * 12}%)` : '#3b1616'} stroke={active ? '#ffaf3f' : '#6c2928'} strokeWidth="2" filter={active ? 'url(#padGlow)' : undefined}/>
            <text x={x + 44} y={y + 49} textAnchor="middle" fill={active ? '#180b04' : '#c66'} fontSize="17" fontWeight="700">{index + 1}</text>
          </g>
        })}
        <g className="keys">
          {whites.map((note, index) => <rect key={note} x={48 + index * 59} y="265" width="57" height="190" rx={3} fill={held.has(note) ? '#ffae43' : '#e8e3dc'} stroke="#181617" strokeWidth="2" className="svg-key" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Piano key" tabIndex={0}/>) }
          {blackNotes.map((note) => { const prior = whiteIndexBefore(note); return <rect key={note} x={48 + prior * 59 - 19} y="265" width="38" height="118" rx={2.5} fill={held.has(note) ? '#d94339' : '#151314'} stroke="#050505" strokeWidth="2" className="svg-key black" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Black piano key" tabIndex={0}/> })}
        </g>
      </svg>
      <p className="device-help">Play the keys and pads, drag knobs up or down, and move the joystick.</p>
    </div>
  )
}
