import { describe, expect, it } from 'vitest'
import { nearestRecordedStep, stepDurationSeconds, stepTime } from '../audio/clock'

describe('clock math', () => {
  it('calculates a sixteenth-note duration', () => expect(stepDurationSeconds(120)).toBe(.125))
  it('places straight steps exactly', () => expect(stepTime(10, 4, 120, 0)).toBe(10.5))
  it('delays odd steps by the swing fraction', () => expect(stepTime(0, 1, 120, .4)).toBeCloseTo(.175))
  it('clamps excessive swing', () => expect(stepTime(0, 1, 120, 2)).toBeCloseTo(.2))
  it('records to the nearest sequencer step and wraps after step 16', () => {
    expect(nearestRecordedStep(4, 10, 10.05, 120)).toBe(4)
    expect(nearestRecordedStep(4, 10, 10.07, 120)).toBe(5)
    expect(nearestRecordedStep(15, 10, 10.07, 120)).toBe(0)
  })
})
