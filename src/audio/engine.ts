let context: AudioContext | null = null
let master: GainNode | null = null
let delay: DelayNode | null = null
let feedback: GainNode | null = null
let delayInput: GainNode | null = null

export type AudioEngine = { context: AudioContext; master: GainNode; delayInput: GainNode }
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
    delayInput.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(master)
    master.connect(compressor).connect(context.destination)
    return { context, master, delayInput }
  }
  if (context.state === 'suspended') void context.resume()
  return { context, master: master!, delayInput: delayInput! }
}

export function connectDelaySend(source: AudioNode, amount: number) {
  const engine = getEngine()
  const send = engine.context.createGain()
  send.gain.value = amount
  source.connect(send)
  send.connect(delay!)
  return send
}
