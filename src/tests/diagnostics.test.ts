import { describe, expect, it, vi } from 'vitest'
import type { StepSession } from '../state/diagnosticsStore'

const memoryStorage = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => memoryStorage.get(k) ?? null, setItem: (k: string, v: string) => { memoryStorage.set(k, v) }, removeItem: (k: string) => { memoryStorage.delete(k) } })
const { useDiagnosticsStore } = await import('../state/diagnosticsStore')
const { captureStep } = await import('../lessons/diagnostics')

const session = (id: string, outcome: StepSession['outcome'] = 'completed', messageCount = 1): StepSession => ({
  lessonId: 'l1', stepId: id, goalType: 'count', outcome, startedAt: new Date().toISOString(), durationMs: 100,
  messages: Array.from({ length: messageCount }, (_, i) => ({ t: i, type: 'cc', channel: 0, data1: 1, data2: 2, known: true })),
  channels: [0], notes: [], controllers: [1], counts: { cc: messageCount }, unknownCount: 0,
})

describe('diagnosticsStore', () => {
  it('addSession caps at 25 and keeps the newest', () => {
    useDiagnosticsStore.setState({ sessions: [] })
    Array.from({ length: 30 }, (_, i) => session(`s${i}`)).forEach((s) => useDiagnosticsStore.getState().addSession(s))
    const { sessions } = useDiagnosticsStore.getState()
    expect(sessions.length).toBe(25)
    expect(sessions.find((s) => s.stepId === 's0')).toBeUndefined()
    expect(sessions.find((s) => s.stepId === 's29')).toBeDefined()
  })

  it('drops a zero-message left session but keeps a zero-message skipped session', () => {
    useDiagnosticsStore.setState({ sessions: [] })
    useDiagnosticsStore.getState().addSession(session('left', 'left', 0))
    expect(useDiagnosticsStore.getState().sessions.length).toBe(0)
    useDiagnosticsStore.getState().addSession(session('skipped', 'skipped', 0))
    expect(useDiagnosticsStore.getState().sessions.length).toBe(1)
  })

  it('clear() empties sessions', () => {
    useDiagnosticsStore.setState({ sessions: [session('a')] })
    useDiagnosticsStore.getState().clear()
    expect(useDiagnosticsStore.getState().sessions).toEqual([])
  })

  // program change, aftertouch and MMC sysex are exactly the traffic we're hunting, and parseMidi can't read any of them
  it('captures messages parseMidi cannot parse, which is where the unknown hardware traffic lives', async () => {
    const { receiveMidiBytes } = await import('../midi/midi')
    useDiagnosticsStore.setState({ sessions: [], enabled: true })
    const capture = captureStep('arp', 'arp-on', 'stream')
    receiveMidiBytes([0x90, 60, 100]); receiveMidiBytes([0xC0, 5]); receiveMidiBytes([0xF0, 0x7F, 0x06, 0x02, 0xF7])
    const finished = capture.finish()!
    expect(finished.messages.length).toBe(3)
    expect(finished.messages.filter((m) => m.type === 'unparsed').length).toBe(2)
    expect(finished.messages.find((m) => m.type === 'unparsed')?.bytes).toEqual([0xC0, 5])
    expect(finished.unknownCount).toBe(2)
  })

  it('setEnabled(false) makes captureStep a no-op', () => {
    useDiagnosticsStore.setState({ sessions: [], enabled: true })
    useDiagnosticsStore.getState().setEnabled(false)
    const capture = captureStep('l1', 's1', 'count')
    expect(capture.finish()).toBeNull()
    expect(useDiagnosticsStore.getState().sessions.length).toBe(0)
    useDiagnosticsStore.getState().setEnabled(true)
  })
})
