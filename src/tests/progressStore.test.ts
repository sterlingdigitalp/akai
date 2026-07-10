import { describe, expect, it } from 'vitest'
import { localDay } from '../state/progressStore'

describe('localDay', () => {
  it('formats the date from local calendar fields', () => {
    const date = new Date(2026, 6, 9, 23, 45)
    expect(localDay(date)).toBe('2026-07-09')
  })

  it('pads single-digit months and days', () => {
    expect(localDay(new Date(2026, 0, 4))).toBe('2026-01-04')
  })
})
