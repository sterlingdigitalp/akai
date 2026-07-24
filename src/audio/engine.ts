let context: AudioContext | null = null
let master: GainNode | null = null
let delay: DelayNode | null = null
let feedback: GainNode | null = null
let delayInput: GainNode | null = null
let lfo: OscillatorNode | null = null

export type AudioEngine = { context: AudioContext; master: GainNode; delayInput: GainNode; lfo: OscillatorNode }
export function getEngine(): AudioEngine {
  if (!context) {
    context = new AudioContext()
    master = context.createGain()
    master.gain.value = 0.72
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = -10
    compressor.ratio.value = 5
    delay = context.createDelay(1)
    delay.delayTime.value = 0.28
    feedback = context.createGain()
    feedback.gain.value = 0.28
    delayInput = context.createGain()
    lfo = context.createOscillator()
    lfo.frequency.value = 5.5
    lfo.start()
    delayInput.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(master)
    master.connect(compressor).connect(context.destination)
    return { context, master, delayInput, lfo }
  }
  if (context.state === 'suspended') void context.resume()
  return { context, master: master!, delayInput: delayInput!, lfo: lfo! }
}

// A browser only lets audio start from a real user gesture on the page. Hardware MIDI is not one,
// so a keyboard-first session would stay silent until something on screen was clicked. Unlock the
// engine on the first pointer/key gesture anywhere, once, so playing the real keyboard just works.
export function unlockAudioOnGesture() {
  const unlock = () => {
    const engine = getEngine()
    if (engine.context.state === 'suspended') void engine.context.resume()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

export function connectDelaySend(source: AudioNode, amount: number) {
  const engine = getEngine()
  const send = engine.context.createGain()
  send.gain.value = amount
  source.connect(send)
  send.connect(delay!)
  return send
}
