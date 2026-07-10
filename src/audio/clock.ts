export function stepDurationSeconds(bpm: number) { return 60 / Math.max(1, bpm) / 4 }
export function stepTime(start: number, step: number, bpm: number, swing: number) {
  const duration = stepDurationSeconds(bpm)
  return start + step * duration + (step % 2 === 1 ? duration * Math.max(0, Math.min(.6, swing)) : 0)
}

export function nearestRecordedStep(currentStep: number, lastStepTime: number, currentTime: number, bpm: number) {
  const late = currentTime - lastStepTime > stepDurationSeconds(bpm) / 2
  return late ? (currentStep + 1) % 16 : currentStep
}

export class StepClock {
  private timer: number | null = null; private step = 0; private next = 0
  private context: AudioContext
  private callback: (step: number, time: number) => void
  bpm: number
  swing: number
  constructor(context: AudioContext, callback: (step: number, time: number) => void, bpm = 100, swing = 0) { this.context = context; this.callback = callback; this.bpm = bpm; this.swing = swing }
  start() { if (this.timer !== null) return; this.step = 0; this.next = this.context.currentTime + .05; this.timer = window.setInterval(() => this.tick(), 25); this.tick() }
  private tick() { while (this.next < this.context.currentTime + .1) { this.callback(this.step % 16, this.next); const duration = stepDurationSeconds(this.bpm); this.next += duration + (this.step % 2 === 0 ? duration * this.swing : -duration * this.swing); this.step++ } }
  stop() { if (this.timer !== null) window.clearInterval(this.timer); this.timer = null }
}
