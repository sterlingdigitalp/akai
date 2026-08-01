import { afterEach, describe, expect, it, vi } from 'vitest'
import { isRecording, playTake, startRecording, stopPlayback, stopRecording, type Take } from '../audio/recorder'
import { emitControl, subscribeControls } from '../midi/midi'
import type { ControlEvent } from '../midi/types'

const memoryStorage = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => memoryStorage.get(k) ?? null, setItem: (k: string, v: string) => { memoryStorage.set(k, v) }, removeItem: (k: string) => { memoryStorage.delete(k) } })
const { useTakesStore } = await import('../state/takesStore')

const take = (id: string, name = id): Take => ({ id, name, createdAt: new Date().toISOString(), durationMs: 1000, events: [] })

describe('playTake cursor playback', () => {
  let now = 0
  let pending: FrameRequestCallback | null = null
  let rafId = 0

  afterEach(() => {
    stopPlayback()
    pending = null
    now = 0
    vi.restoreAllMocks()
  })

  function installClock() {
    now = 0
    pending = null
    rafId = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pending = cb
      return ++rafId
    })
    vi.stubGlobal('cancelAnimationFrame', () => { pending = null })
  }

  function advanceTo(ms: number) {
    now = ms
    const cb = pending
    pending = null
    if (cb) cb(ms)
  }

  it('emits events in sorted time order even when the take stores them out of order', () => {
    installClock()
    const heard: number[] = []
    const unsubscribe = subscribeControls((event) => {
      if (event.source === 'replay') heard.push(event.index)
    })
    const sample: Take = {
      id: 'order',
      name: 'order',
      createdAt: new Date().toISOString(),
      durationMs: 300,
      events: [
        { kind: 'key', index: 62, value: .7, on: true, t: 200 },
        { kind: 'key', index: 60, value: .8, on: true, t: 0 },
        { kind: 'key', index: 61, value: .6, on: true, t: 100 },
      ],
    }
    playTake(sample, () => {})
    advanceTo(0)
    expect(heard).toEqual([60])
    advanceTo(100)
    expect(heard).toEqual([60, 61])
    advanceTo(200)
    expect(heard).toEqual([60, 61, 62])
    unsubscribe()
  })

  it('advances the O(n) cursor so earlier events are not re-emitted', () => {
    installClock()
    const heard: Array<{ index: number; t: number }> = []
    const unsubscribe = subscribeControls((event) => {
      if (event.source === 'replay') heard.push({ index: event.index, t: event.ts })
    })
    const sample: Take = {
      id: 'cursor',
      name: 'cursor',
      createdAt: new Date().toISOString(),
      durationMs: 400,
      events: [
        { kind: 'key', index: 60, value: .8, on: true, t: 0 },
        { kind: 'key', index: 61, value: .7, on: true, t: 150 },
        { kind: 'key', index: 62, value: .6, on: true, t: 300 },
      ],
    }
    playTake(sample, () => {})
    advanceTo(150)
    expect(heard.map((item) => item.index)).toEqual([60, 61])
    const afterFirst = heard.length
    advanceTo(200)
    expect(heard.length).toBe(afterFirst)
    advanceTo(300)
    expect(heard.map((item) => item.index)).toEqual([60, 61, 62])
    unsubscribe()
  })

  it('releases held keys when playback is stopped mid-note', () => {
    installClock()
    const heard: ControlEvent[] = []
    const unsubscribe = subscribeControls((event) => {
      if (event.source === 'replay') heard.push(event)
    })
    const sample: Take = {
      id: 'held',
      name: 'held',
      createdAt: new Date().toISOString(),
      durationMs: 1000,
      events: [
        { kind: 'key', index: 64, value: .9, on: true, t: 0 },
        { kind: 'key', index: 67, value: .8, on: true, t: 50 },
      ],
    }
    const stop = playTake(sample, () => {})
    advanceTo(50)
    expect(heard.filter((event) => event.on).map((event) => event.index)).toEqual([64, 67])
    stop()
    const releases = heard.filter((event) => event.on === false)
    expect(releases.map((event) => event.index).sort((a, b) => a - b)).toEqual([64, 67])
    expect(releases.every((event) => event.value === 0)).toBe(true)
    unsubscribe()
  })

  it('fires the take-opening event at t=0 and calls onEnd when duration elapses', () => {
    installClock()
    const heard: number[] = []
    let ended = false
    const unsubscribe = subscribeControls((event) => {
      if (event.source === 'replay' && event.on) heard.push(event.index)
    })
    const sample: Take = {
      id: 'open',
      name: 'open',
      createdAt: new Date().toISOString(),
      durationMs: 250,
      events: [{ kind: 'key', index: 60, value: .8, on: true, t: 0 }],
    }
    playTake(sample, () => { ended = true })
    advanceTo(0)
    expect(heard).toEqual([60])
    expect(ended).toBe(false)
    advanceTo(250)
    expect(ended).toBe(true)
    unsubscribe()
  })
})

describe('recording lifecycle', () => {
  it('auto-stops at the time cap and reports why', () => {
    let reason = ''
    startRecording((next) => { reason = next })
    emitControl({ kind: 'key', index: 60, value: .8, on: true, channel: 0, ts: 100, source: 'demo' })
    emitControl({ kind: 'key', index: 60, value: 0, on: false, channel: 0, ts: 180101, source: 'demo' })
    expect(isRecording()).toBe(false)
    expect(reason).toBe('time-limit')
    stopRecording('Capped')
  })

  it('gives a one-event take enough duration to sound and release', () => {
    startRecording()
    emitControl({ kind: 'key', index: 60, value: .8, on: true, channel: 0, ts: 100, source: 'demo' })
    expect(stopRecording('One note')?.durationMs).toBe(250)
  })
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
