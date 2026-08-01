import type { Take, TakeEvent } from '../audio/recorder'
import { DEFAULT_PROFILE, type DeviceProfile } from '../midi/profile'
import type { DiagnosticsStateData, RawCapture, StepSession } from './diagnosticsStore'
import type { LessonProgress } from './progressStore'

export const DATA_SCHEMA_VERSION = 2
export const PATTERN_ROWS = 8
export const PATTERN_STEPS = 16
export const MAX_TAKES = 12
export const MAX_TAKE_EVENTS = 4000
export const MAX_DIAGNOSTIC_SESSIONS = 25
export const MAX_DIAGNOSTIC_MESSAGES = 400

export type Pattern = boolean[][]
export type ProgressData = { lessons: Record<string, LessonProgress>; practiceDays: string[] }
export type WoodshedData = {
  schema: 'woodshed'
  version: typeof DATA_SCHEMA_VERSION
  exportedAt: string
  progress: ProgressData
  profile: DeviceProfile
  pattern: Pattern
  takes: Take[]
  diagnostics: DiagnosticsStateData
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max
const isIsoDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value))
const isLocalDay = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

export const emptyPattern = (): Pattern =>
  Array.from({ length: PATTERN_ROWS }, () => Array(PATTERN_STEPS).fill(false) as boolean[])

export function parsePattern(value: unknown): Pattern | null {
  if (!Array.isArray(value) || value.length !== PATTERN_ROWS) return null
  const rows = value.map((row) => {
    if (!Array.isArray(row) || row.length !== PATTERN_STEPS || row.some((cell) => typeof cell !== 'boolean')) return null
    return [...row] as boolean[]
  })
  return rows.some((row) => row === null) ? null : rows as Pattern
}

export function parseProgress(value: unknown): ProgressData | null {
  if (!isRecord(value) || !isRecord(value.lessons) || !Array.isArray(value.practiceDays)) return null
  if (Object.keys(value.lessons).length > 64 || value.practiceDays.length > 3660 || !value.practiceDays.every(isLocalDay)) return null
  const lessons: Record<string, LessonProgress> = {}
  for (const [lessonId, candidate] of Object.entries(value.lessons)) {
    if (!lessonId || lessonId.length > 100 || !isRecord(candidate) || !Array.isArray(candidate.completedSteps)) return null
    if (candidate.completedSteps.length > 256 || !candidate.completedSteps.every((step) => typeof step === 'string' && step.length <= 100)) return null
    if (candidate.completedAt !== undefined && !isIsoDate(candidate.completedAt)) return null
    lessons[lessonId] = {
      completedSteps: [...new Set(candidate.completedSteps)],
      ...(candidate.completedAt === undefined ? {} : { completedAt: candidate.completedAt as string }),
    }
  }
  return { lessons, practiceDays: [...new Set(value.practiceDays)] as string[] }
}

export function parseProfile(value: unknown): DeviceProfile | null {
  if (!isRecord(value)) return null
  if (!Array.isArray(value.padNotes) || value.padNotes.length !== 8 || !value.padNotes.every((item) => isIntegerIn(item, 0, 127))) return null
  if (!Array.isArray(value.knobCCs) || value.knobCCs.length !== 8 || !value.knobCCs.every((item) => isIntegerIn(item, 0, 127))) return null
  if (!isIntegerIn(value.padChannel, 0, 15) || !isIntegerIn(value.keyChannel, 0, 15) || !isIntegerIn(value.modCC, 0, 127) || typeof value.pitchIsBend !== 'boolean') return null
  return {
    padNotes: [...value.padNotes] as number[],
    knobCCs: [...value.knobCCs] as number[],
    padChannel: value.padChannel as number,
    keyChannel: value.keyChannel as number,
    modCC: value.modCC as number,
    pitchIsBend: value.pitchIsBend,
  }
}

export function cloneDefaultProfile(): DeviceProfile {
  return { ...DEFAULT_PROFILE, padNotes: [...DEFAULT_PROFILE.padNotes], knobCCs: [...DEFAULT_PROFILE.knobCCs] }
}

function parseTakeEvent(value: unknown): TakeEvent | null {
  if (!isRecord(value) || !['key', 'pad', 'knob', 'pitch', 'mod'].includes(String(value.kind))) return null
  if (!isIntegerIn(value.index, 0, 127) || !isFiniteNumber(value.value) || value.value < 0 || value.value > 1 || !isFiniteNumber(value.t) || value.t < 0 || value.t > 180000) return null
  if (value.on !== undefined && typeof value.on !== 'boolean') return null
  return { kind: value.kind as TakeEvent['kind'], index: value.index as number, value: value.value, t: value.t, ...(value.on === undefined ? {} : { on: value.on }) }
}

export function parseTakes(value: unknown): Take[] | null {
  if (!Array.isArray(value) || value.length > MAX_TAKES) return null
  const takes: Take[] = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.id !== 'string' || !candidate.id || candidate.id.length > 100 || typeof candidate.name !== 'string' || candidate.name.length > 200 || !isIsoDate(candidate.createdAt) || !isFiniteNumber(candidate.durationMs) || candidate.durationMs < 0 || candidate.durationMs > 180000 || !Array.isArray(candidate.events) || candidate.events.length > MAX_TAKE_EVENTS) return null
    const events = candidate.events.map(parseTakeEvent)
    if (events.some((event) => event === null)) return null
    const sorted = (events as TakeEvent[]).sort((a, b) => a.t - b.t)
    takes.push({ id: candidate.id, name: candidate.name, createdAt: candidate.createdAt as string, durationMs: Math.max(candidate.durationMs, sorted.at(-1)?.t ?? 0), events: sorted })
  }
  return takes
}

function parseRawCapture(value: unknown): RawCapture | null {
  if (!isRecord(value) || !isFiniteNumber(value.t) || value.t < 0 || typeof value.type !== 'string' || !isIntegerIn(value.channel, 0, 15) || !isIntegerIn(value.data1, 0, 16383) || !isIntegerIn(value.data2, 0, 127) || typeof value.known !== 'boolean') return null
  if (value.port !== undefined && (typeof value.port !== 'string' || value.port.length > 256)) return null
  if (value.bytes !== undefined && (!Array.isArray(value.bytes) || value.bytes.length > 8 || !value.bytes.every((byte) => isIntegerIn(byte, 0, 255)))) return null
  return value as RawCapture
}

export function parseDiagnostics(value: unknown): DiagnosticsStateData | null {
  if (!isRecord(value) || typeof value.enabled !== 'boolean' || !Array.isArray(value.sessions) || value.sessions.length > MAX_DIAGNOSTIC_SESSIONS) return null
  const sessions: StepSession[] = []
  for (const candidate of value.sessions) {
    if (!isRecord(candidate) || typeof candidate.lessonId !== 'string' || typeof candidate.stepId !== 'string' || typeof candidate.goalType !== 'string' || !['completed', 'confirmed', 'skipped', 'left'].includes(String(candidate.outcome)) || !isIsoDate(candidate.startedAt) || !isFiniteNumber(candidate.durationMs) || candidate.durationMs < 0 || !Array.isArray(candidate.messages) || candidate.messages.length > MAX_DIAGNOSTIC_MESSAGES || !Array.isArray(candidate.channels) || !Array.isArray(candidate.notes) || !Array.isArray(candidate.controllers) || !isRecord(candidate.counts) || !isIntegerIn(candidate.unknownCount, 0, Number.MAX_SAFE_INTEGER)) return null
    const messages = candidate.messages.map(parseRawCapture)
    if (messages.some((message) => message === null) || !candidate.channels.every((item) => isIntegerIn(item, 0, 15)) || !candidate.notes.every((item) => isIntegerIn(item, 0, 127)) || !candidate.controllers.every((item) => isIntegerIn(item, 0, 127)) || !Object.values(candidate.counts).every((item) => isIntegerIn(item, 0, Number.MAX_SAFE_INTEGER))) return null
    sessions.push({ ...candidate, messages: messages as RawCapture[] } as StepSession)
  }
  return { enabled: value.enabled, sessions }
}

function migrateLegacy(value: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: 'woodshed',
    version: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    progress: value.progress,
    profile: value.profile,
    pattern: value.pattern ?? emptyPattern(),
    takes: value.takes ?? [],
    diagnostics: value.diagnostics ?? { enabled: true, sessions: [] },
  }
}

export function parseWoodshedData(value: string | unknown): WoodshedData {
  const decoded: unknown = typeof value === 'string' ? JSON.parse(value) : value
  if (!isRecord(decoded)) throw new Error('Woodshed data must be an object')
  const candidate = decoded.schema === undefined && decoded.version === undefined ? migrateLegacy(decoded) : decoded
  if (candidate.schema !== 'woodshed' || candidate.version !== DATA_SCHEMA_VERSION || !isIsoDate(candidate.exportedAt)) throw new Error('Unsupported Woodshed data version')
  const progress = parseProgress(candidate.progress)
  const profile = parseProfile(candidate.profile)
  const pattern = parsePattern(candidate.pattern)
  const takes = parseTakes(candidate.takes)
  const diagnostics = parseDiagnostics(candidate.diagnostics)
  if (!progress || !profile || !pattern || !takes || !diagnostics) throw new Error('Woodshed data failed validation')
  return { schema: 'woodshed', version: DATA_SCHEMA_VERSION, exportedAt: candidate.exportedAt as string, progress, profile, pattern, takes, diagnostics }
}
