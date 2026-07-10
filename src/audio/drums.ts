import { getEngine } from './engine'

function noise(context: AudioContext, duration: number) {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate)
  const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = context.createBufferSource(); source.buffer = buffer; return source
}
function envelope(gain: AudioParam, now: number, peak: number, duration: number) { gain.setValueAtTime(Math.max(.001, peak), now); gain.exponentialRampToValueAtTime(.001, now + duration) }

export function trigger(index: number, velocity = .8, at?: number) {
  const { context, master } = getEngine(); const now = at ?? context.currentTime; const v = .08 + velocity * .32
  if (index === 0 || index === 5) {
    const osc = context.createOscillator(); const gain = context.createGain(); osc.type = 'sine'; const start = index === 0 ? 150 : 120; const end = index === 0 ? 50 : 80; const dur = index === 0 ? .45 : .28
    osc.frequency.setValueAtTime(start, now); osc.frequency.exponentialRampToValueAtTime(end, now + dur); envelope(gain.gain, now, v, dur); osc.connect(gain).connect(master); osc.start(now); osc.stop(now + dur)
    if (index === 0) { const click = noise(context, .018); const hp = context.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; const cg = context.createGain(); envelope(cg.gain, now, v * .3, .018); click.connect(hp).connect(cg).connect(master); click.start(now) }
    return
  }
  if (index === 6) { const osc = context.createOscillator(); const filter = context.createBiquadFilter(); const gain = context.createGain(); osc.type = 'square'; osc.frequency.value = 700; filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 6; envelope(gain.gain, now, v * .55, .045); osc.connect(filter).connect(gain).connect(master); osc.start(now); osc.stop(now + .05); return }
  const duration = index === 3 ? .4 : index === 7 ? 1.2 : index === 4 ? .18 : index === 1 ? .22 : .06
  const source = noise(context, duration); const filter = context.createBiquadFilter(); const gain = context.createGain(); filter.type = index === 1 ? 'bandpass' : 'highpass'; filter.frequency.value = index === 1 ? 1900 + velocity * 1800 : 5000 + velocity * 3000; filter.Q.value = index === 1 ? .8 : .35; envelope(gain.gain, now, v, duration)
  source.connect(filter).connect(gain).connect(master); source.start(now)
  if (index === 1) { const tone = context.createOscillator(); const tg = context.createGain(); tone.frequency.value = 180; envelope(tg.gain, now, v * .28, .12); tone.connect(tg).connect(master); tone.start(now); tone.stop(now + .13) }
  if (index === 4) { [0, .026, .052].forEach((offset) => { const clap = noise(context, .035); const cg = context.createGain(); envelope(cg.gain, now + offset, v * .6, .035); clap.connect(cg).connect(master); clap.start(now + offset) }) }
}
