import type { MixPart } from '../lessons/engine'

const FADE_AFTER_MS = 2500
const readout = (part: MixPart) => part.unit === 'knobs' ? `${part.have} of ${part.need}` : part.unit === 'percent' ? `${part.have}/${part.need}%` : `${part.have}/${part.need}`

export function MixMeter({ parts, withinMs, now }: { parts: MixPart[]; withinMs: number; now: number }) {
  if (!parts.length) return null
  return <div className="mix-meter" role="group" aria-label="Parts still playing">
    <p className="mix-meter-head">Keep every part alive <span>last {Math.round(withinMs / 1000)}s</span></p>
    {parts.map((part) => {
      const quiet = part.lastTs !== null && !part.met && now - part.lastTs > FADE_AFTER_MS
      return <div className={`mix-lane ${part.met ? 'is-met' : ''} ${quiet ? 'is-quiet' : ''}`} key={part.id}>
        <span className="mix-lane-label">{part.label}</span>
        <span className="mix-lane-count" aria-label={`${part.label}, ${readout(part)}`}>{readout(part)}{part.met && <b aria-hidden="true">✓</b>}</span>
        <i className="mix-lane-track"><i style={{ width: `${Math.min(1, part.ratio) * 100}%` }}/></i>
      </div>
    })}
  </div>
}
