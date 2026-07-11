import { useMemo, useRef, useState } from 'react'
import { demoControl } from '../../midi/demo'
import type { ControlKind } from '../../midi/types'
import { useMidiStore } from '../../state/midiStore'
import './device.css'

const BLACKS = new Set([1, 3, 6, 8, 10])
const VIEWBOX_HEIGHT = 600
const WHEEL_TRAVEL_TOP = 101
const WHEEL_TRAVEL_BOTTOM = 166
const PAD_FUNCTION_BUTTONS = [
  { lines: ['ARP'], subLabel: 'CONFIG' },
  { lines: ['LATCH'], subLabel: 'FULL LEVEL' },
  { lines: ['NOTE', 'REPEAT'], subLabel: 'CONFIG' },
  { lines: ['TAP', 'TEMPO'], subLabel: 'METRONOME' },
  { lines: ['BANK', 'A/B'], color: '#c2554f' },
]
const PAD_PANEL_LABELS = [
  [
    { number: '5', label: 'CHORDS' },
    { number: '6', label: 'CHORDS CONFIG' },
    { number: '7', label: 'SCALES' },
    { number: '8', label: 'SCALES CONFIG' },
  ],
  [
    { number: '1', label: '' },
    { number: '2', label: 'PROG CHNG' },
    { number: '3', label: 'CC#' },
    { number: '4', label: 'NOTES' },
  ],
]
const KNOB_PANEL_LABELS = [
  'DIVISION', 'SWING', 'MODE', 'OCT',
  'LATCH', 'SYNC', 'GATE', 'BPM',
]
const ARP_LEGEND = [
  '1/4', '1/4 T', '1/8', '1/8 T', '1/16', '1/16 T', '1/32', '1/32 T',
  'UP', 'DOWN', 'EXCL', 'INCL', 'ORDER', 'RAND', 'CHORD', 'OCT 1', 'OCT 2',
  'OCT 3', 'OCT 4', 'SWING', 'PATTERN', 'EDIT', 'MUTATE', 'FREEZE', 'SYNC',
]
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
      <svg className="device" viewBox="0 0 1280 600" role="group" aria-label="Interactive on-screen MPK Mini keyboard">
        <defs>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#282526"/><stop offset="1" stopColor="#151314"/></linearGradient>
          <linearGradient id="wheel" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#171516"/><stop offset=".5" stopColor="#454142"/><stop offset="1" stopColor="#111011"/></linearGradient>
          <radialGradient id="browse" cx="40%" cy="34%"><stop stopColor="#454142"/><stop offset=".72" stopColor="#1b191a"/><stop offset="1" stopColor="#0b0a0a"/></radialGradient>
          <filter id="padGlow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect x="8" y="8" width="1264" height="584" rx="30" fill="url(#body)" stroke="#3a3536" strokeWidth="2"/>
        <path d="M30 32h1220" stroke="rgba(255,255,255,.08)"/>
        <text x="47" y="61" fill="#ef493f" fontSize="27" fontWeight="700" letterSpacing="-1">AKAI</text>
        <text x="116" y="61" fill="#aaa3a4" fontSize="13" letterSpacing="2">professional</text>

        <g className="panel-trim" aria-hidden="true" pointerEvents="none" fill="none" stroke="#4a1a17" strokeWidth="1" opacity=".8">
          <rect x="194" y="49" width="402" height="208" rx="13"/>
          <rect x="194" y="260" width="392" height="62" rx="9"/>
          <rect x="790" y="56" width="432" height="194" rx="13"/>
          <rect x="856" y="258" width="302" height="62" rx="9"/>
          <rect x="43" y="210" width="127" height="42" rx="9"/>
          <rect x="615" y="291" width="173" height="51" rx="9"/>
        </g>

        <g className="panel-print" aria-hidden="true" pointerEvents="none">
          <text x="619" y="61" fontSize="17" letterSpacing="-.35">
            <tspan fill="#d8d2cf" fontWeight="750">MPK</tspan>
            <tspan dx="4" fill="#a8a2a3" fontSize="15" fontWeight="400">mini</tspan>
          </text>

          {PAD_PANEL_LABELS.map((row, rowIndex) => row.map(({ number, label }, column) => (
            <text key={`${number}-${label}`} x={205 + column * 99} y={rowIndex === 0 ? 70 : 250} fill="#6b6667" fontSize="8.5" letterSpacing=".2">
              <tspan fill="#8b8586" fontWeight="750">{number}</tspan>
              {label && <tspan dx="3" fontWeight="500">{label}</tspan>}
            </text>
          )))}

          {KNOB_PANEL_LABELS.map((label, index) => {
            const x = 866 + (index % 4) * 94
            const y = 103 + Math.floor(index / 4) * 102
            return <text key={label} x={x} y={y + 43} textAnchor="middle" fill="#6b6667" fontSize="7.5" letterSpacing=".3">
              <tspan fill="#8b8586" fontWeight="750">{index + 1}</tspan>
              <tspan dx="3" fontWeight="500">{label}</tspan>
            </text>
          })}
        </g>

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
          </g>
        })}

        <g className="function-band" aria-hidden="true" pointerEvents="none">
          <g fill="#5d5859" fontSize="7.5" letterSpacing=".7" textAnchor="middle">
            <text x="76.5" y="257">PROG EDIT</text>
            <text x="136.5" y="257">SAVE</text>
          </g>

          <g>
            {PAD_FUNCTION_BUTTONS.map(({ lines, subLabel, color }, index) => {
              const x = 205 + index * 76
              return <g key={lines.join('-')}>
                <rect x={x} y="266" width="66" height="30" rx="6" fill="#1a1819" stroke="#4b4647"/>
                <text x={x + 33} y={lines.length === 1 ? 284.5 : 279.5} textAnchor="middle" fill={color ?? '#777173'} fontSize="8.5" fontWeight="600" letterSpacing=".55">
                  {lines.map((line, lineIndex) => <tspan key={line} x={x + 33} dy={lineIndex === 0 ? 0 : 9.5}>{line}</tspan>)}
                </text>
                {subLabel && <text x={x + 33} y="310" textAnchor="middle" fill="#5d5859" fontSize="7.5" letterSpacing=".65">{subLabel}</text>}
              </g>
            })}
          </g>

          <g>
            <text x="702" y="260" textAnchor="middle" fill="#777173" fontSize="8" letterSpacing="1.1">&lt; BANK &gt;</text>
            <rect x="663" y="266" width="34" height="24" rx="5" fill="#1a1819" stroke="#4b4647"/>
            <rect x="707" y="266" width="34" height="24" rx="5" fill="#1a1819" stroke="#4b4647"/>
            <text x="680" y="282" textAnchor="middle" fill="#777173" fontSize="13">−</text>
            <text x="724" y="282" textAnchor="middle" fill="#777173" fontSize="13">+</text>

            <rect x="625" y="298" width="72" height="26" rx="5" fill="#1a1819" stroke="#4b4647"/>
            <rect x="707" y="298" width="72" height="26" rx="5" fill="#1a1819" stroke="#4b4647"/>
            <rect x="643" y="305" width="36" height="12" rx="1.5" fill="none" stroke="#777173" strokeWidth=".8"/>
            <text x="661" y="314" textAnchor="middle" fill="#777173" fontSize="7" letterSpacing=".5">SHIFT</text>
            <text x="743" y="308.5" textAnchor="middle" fill="#c2554f" fontSize="7.5" fontWeight="600" letterSpacing=".35">
              <tspan x="743">PLUGIN/</tspan>
              <tspan x="743" dy="8.5">DAW</tspan>
            </text>
            <text x="702" y="335" textAnchor="middle" fill="#5d5859" fontSize="7.5" letterSpacing=".7">USER PRESETS</text>
          </g>

          <g>
            {[866, 924, 982, 1040, 1098].map((x) => <rect key={x} x={x} y="266" width="48" height="30" rx="6" fill="#1a1819" stroke="#4b4647"/>)}
            <text x="890" y="284.5" textAnchor="middle" fill="#777173" fontSize="8" fontWeight="600" letterSpacing=".45">UNDO</text>

            <path d="M937 278.5v-1.5a5 5 0 0 1 5-5h13a5 5 0 0 1 5 5v7a5 5 0 0 1-5 5h-14a5 5 0 0 1-5-5" fill="none" stroke="#777173" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="m934 279 3-3 3 3" fill="none" stroke="#777173" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>

            <rect x="994" y="277" width="7" height="7" rx=".7" fill="#777173"/>
            <path d="m1008 276 10 5-10 5z" fill="#777173"/>

            <circle cx="1064" cy="281" r="6" fill="#a33a35"/>

            <circle cx="1122" cy="281" r="9" fill="none" stroke="#777173" strokeWidth="1.3"/>
            <path d="M1117.5 281h9M1122 276.5v9" stroke="#777173" strokeWidth="1.3" strokeLinecap="round"/>

            {['REDO', 'GLOBAL', 'CONTINUE', 'QUANTIZE', 'AUTOMATION'].map((label, index) => <text key={label} x={890 + index * 58} y="310" textAnchor="middle" fill="#5d5859" fontSize="7.5" letterSpacing=".55">{label}</text>)}
          </g>

          <g fill="#565152" fontSize="7.5" letterSpacing=".5" textAnchor="middle">
            {ARP_LEGEND.map((label, index) => <text key={label} x={53 + index * 48.8} y="344">{label}</text>)}
            <path d="M777 329h176" fill="none" stroke="#565152" strokeWidth=".8"/>
            <text x="865" y="326" fontSize="6.5" letterSpacing="1">ARP</text>
          </g>
        </g>

        <line className="keybed-pinstripe" x1="9" x2="1271" y1="349" y2="349" stroke="#7c2420" strokeWidth="2" aria-hidden="true" pointerEvents="none"/>

        <g className="keys">
          {whites.map((note, index) => <rect key={note} x={47 + index * 79} y="352" width="77" height="215" rx={3} fill={held.has(note) ? '#ffae43' : '#e8e3dc'} stroke="#181617" strokeWidth="2" className="svg-key" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Piano key" tabIndex={0}/>) }
          {blackNotes.map((note) => {
            const prior = whiteIndexBefore(note)
            return <rect key={note} x={47 + prior * 79 - 25} y="352" width="50" height="133" rx={2.5} fill={held.has(note) ? '#d94339' : '#151314'} stroke="#050505" strokeWidth="2" className="svg-key black" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); demoControl('key', note, .72, true) }} onPointerUp={() => demoControl('key', note, 0, false)} role="button" aria-label="Black piano key" tabIndex={0}/>
          })}
        </g>
      </svg>
      <p className="device-help">Play the keys and pads, drag knobs or wheels up and down, and shape the sound.</p>
    </div>
  )
}
