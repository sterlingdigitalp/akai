import { describe, expect, it, vi } from 'vitest'
import { dueEvents, type Take, type TakeEvent } from '../audio/recorder'

const memoryStorage = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => memoryStorage.get(k) ?? null, setItem: (k: string, v: string) => { memoryStorage.set(k, v) }, removeItem: (k: string) => { memoryStorage.delete(k) } })
const { useTakesStore } = await import('../state/takesStore')

const ev = (t: number): TakeEvent => ({ kind: 'key', index: 60, value: .8, on: true, t })
const take = (id: string, name = id): Take => ({ id, name, createdAt: new Date().toISOString(), durationMs: 1000, events: [] })

describe('dueEvents', () => {
  it('excludes an event exactly at fromMs and includes one exactly at toMs', () => { const events = [ev(100), ev(200)]; expect(dueEvents(events, 100, 200)).toEqual([ev(200)]) })
  it('returns events in ascending t order', () => { const events = [ev(50), ev(10), ev(30)]; expect(dueEvents(events, 0, 100).map((e) => e.t)).toEqual([10, 30, 50]) })
  it('returns an empty array for an empty window', () => { expect(dueEvents([ev(10), ev(20)], 50, 50)).toEqual([]) })
  // every take stamps its first event at t=0, so playback must start below zero or that note is silently dropped
  it('includes the take-opening event at t=0 when playback starts its cursor below zero', () => { const events = [ev(0), ev(200)]; expect(dueEvents(events, 0, 16)).toEqual([]); expect(dueEvents(events, -1, 16)).toEqual([ev(0)]) })
})

describe('takesStore', () => {
  it('addTake caps the list at 12 and keeps the newest', () => {
    useTakesStore.setState({ takes: [] })
    Array.from({ length: 15 }, (_, i) => take(`t${i}`)).forEach((t) => useTakesStore.getState().addTake(t))
    const { takes } = useTakesStore.getState()
    expect(takes.length).toBe(12)
    expect(takes.find((t) => t.id === 't0')).toBeUndefined()
    expect(takes.find((t) => t.id === 't14')).toBeDefined()
  })

  it('removeTake removes the matching take', () => {
    useTakesStore.setState({ takes: [take('a'), take('b')] })
    useTakesStore.getState().removeTake('a')
    expect(useTakesStore.getState().takes.map((t) => t.id)).toEqual(['b'])
  })

  it('renameTake renames only the matching take', () => {
    useTakesStore.setState({ takes: [take('a'), take('b')] })
    useTakesStore.getState().renameTake('a', 'My Groove')
    const { takes } = useTakesStore.getState()
    expect(takes.find((t) => t.id === 'a')?.name).toBe('My Groove')
    expect(takes.find((t) => t.id === 'b')?.name).toBe('b')
  })
})
