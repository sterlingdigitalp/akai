import { describe, expect, it } from 'vitest'
import { DATA_SCHEMA_VERSION, emptyPattern, parsePattern, parseWoodshedData } from '../state/dataSchema'
import { DEFAULT_PROFILE } from '../midi/profile'

const valid = () => ({
  schema: 'woodshed',
  version: DATA_SCHEMA_VERSION,
  exportedAt: '2026-07-29T12:00:00.000Z',
  progress: { lessons: { meet: { completedSteps: ['any-key'] } }, practiceDays: ['2026-07-29'] },
  profile: DEFAULT_PROFILE,
  pattern: emptyPattern(),
  takes: [],
  diagnostics: { enabled: true, sessions: [] },
})

describe('versioned Woodshed data', () => {
  it('accepts and clones a deeply valid current export', () => {
    const source = valid()
    const parsed = parseWoodshedData(JSON.stringify(source))
    expect(parsed.version).toBe(2)
    expect(parsed.progress.lessons.meet?.completedSteps).toEqual(['any-key'])
    expect(parsed.pattern).not.toBe(source.pattern)
  })

  it('migrates the legacy progress/profile/pattern export without discarding it', () => {
    const source = valid()
    const parsed = parseWoodshedData({ progress: source.progress, profile: source.profile, pattern: source.pattern })
    expect(parsed.version).toBe(2)
    expect(parsed.takes).toEqual([])
    expect(parsed.diagnostics.sessions).toEqual([])
  })

  it('rejects malformed lesson records, profiles, patterns, takes, and unsupported versions', () => {
    expect(() => parseWoodshedData({ ...valid(), progress: { lessons: { meet: {} }, practiceDays: [] } })).toThrow()
    expect(() => parseWoodshedData({ ...valid(), profile: { ...DEFAULT_PROFILE, padNotes: [36] } })).toThrow()
    expect(() => parseWoodshedData({ ...valid(), pattern: [null] })).toThrow()
    expect(() => parseWoodshedData({ ...valid(), takes: [{ id: 'x', events: 'bad' }] })).toThrow()
    expect(() => parseWoodshedData({ ...valid(), version: 99 })).toThrow()
  })

  it('requires an exact 8×16 boolean pattern', () => {
    expect(parsePattern(emptyPattern())).toHaveLength(8)
    expect(parsePattern(Array.from({ length: 8 }, () => Array(15).fill(false)))).toBeNull()
    expect(parsePattern(Array.from({ length: 8 }, () => Array(16).fill('false')))).toBeNull()
  })
})
