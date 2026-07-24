import { connectDelaySend, getEngine } from './engine'

export type SynthParam = 'cutoff' | 'resonance' | 'attack' | 'release' | 'delaySend'
type Voice = { oscillators: OscillatorNode[]; amp: GainNode; filter: BiquadFilterNode; modGain: GainNode; frequency: number }
const params: Record<SynthParam, number> = { cutoff: .55, resonance: .22, attack: .12, release: .36, delaySend: .18 }
const voices = new Map<number, Voice>()
let modDepth = 0
let pitchBend = .5
export const SYNTH_PRESETS = {
  'Warm Pad': { cutoff: .5, resonance: .18, attack: .52, release: .7, delaySend: .28 },
  Pluck: { cutoff: .72, resonance: .25, attack: .01, release: .14, delaySend: .12 },
  'Acid Bass': { cutoff: .38, resonance: .78, attack: .01, release: .24, delaySend: .08 },
} satisfies Record<string, Record<SynthParam, number>>

export function setParam(name: SynthParam, value: number) { params[name] = Math.max(0, Math.min(1, value)) }
export function setPreset(name: keyof typeof SYNTH_PRESETS) { Object.entries(SYNTH_PRESETS[name]).forEach(([key, value]) => setParam(key as SynthParam, value)) }
export function setModDepth(value: number) {
  modDepth = Math.max(0, Math.min(1, value))
  voices.forEach((voice) => voice.modGain.gain.setTargetAtTime(voice.frequency * modDepth * .012, voice.modGain.context.currentTime, .01))
}
export function setPitchBend(value: number) {
  pitchBend = Math.max(0, Math.min(1, value))
  const bendCents = (pitchBend - .5) * 400
  voices.forEach((voice) => voice.oscillators.forEach((oscillator, index) => oscillator.detune.setTargetAtTime(bendCents + (index ? 7 : -4), oscillator.context.currentTime, .01)))
}

export function noteOn(note: number, velocity = .75) {
  noteOff(note)
  if (voices.size >= 8) noteOff(voices.keys().next().value as number)
  const { context, master, lfo } = getEngine()
  const now = context.currentTime
  const frequency = 440 * 2 ** ((note - 69) / 12)
  const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 1 + params.resonance * 18
  const amp = context.createGain(); amp.gain.setValueAtTime(.0001, now); amp.gain.linearRampToValueAtTime(Math.max(.001, velocity * .17), now + .004 + params.attack * .8)
  filter.frequency.setValueAtTime(240 + params.cutoff * 1600, now); filter.frequency.exponentialRampToValueAtTime(380 + params.cutoff * 7600, now + .05); filter.frequency.exponentialRampToValueAtTime(220 + params.cutoff * 2000, now + .45)
  const bendCents = (pitchBend - .5) * 400
  const oscillators = (['sawtooth', 'square'] as OscillatorType[]).map((type, index) => { const osc = context.createOscillator(); osc.type = type; osc.frequency.value = frequency; osc.detune.value = bendCents + (index ? 7 : -4); const mix = context.createGain(); mix.gain.value = index ? .34 : .55; osc.connect(mix).connect(filter); osc.start(); return osc })
  const modGain = context.createGain(); modGain.gain.value = frequency * modDepth * .012; lfo.connect(modGain); oscillators.forEach((oscillator) => modGain.connect(oscillator.frequency))
  filter.connect(amp).connect(master); connectDelaySend(amp, params.delaySend)
  voices.set(note, { oscillators, amp, filter, modGain, frequency })
}
export function noteOff(note: number) {
  const voice = voices.get(note); if (!voice) return
  const { context, lfo } = getEngine(); const now = context.currentTime; const end = now + .06 + params.release * 1.8
  voice.amp.gain.cancelScheduledValues(now); voice.amp.gain.setTargetAtTime(.0001, now, Math.max(.02, params.release * .3)); voice.oscillators.forEach((osc) => osc.stop(end + .1)); lfo.disconnect(voice.modGain); voice.modGain.disconnect(); voices.delete(note)
}
