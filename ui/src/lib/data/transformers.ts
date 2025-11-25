import { getConfig } from '../config'
import type { Clip, TagAction } from '../types'

const toStringOrUndefined = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  const str = String(value).trim()
  return str.length ? str : undefined
}

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'boolean') return value
  const normalized = String(value).toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(normalized)) return true
  if (['no', 'n', 'false', '0'].includes(normalized)) return false
  return undefined
}

const parseClockTime = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  const str = String(value).trim()
  if (!str) return undefined
  const segments = str.split(':')
  if (segments.length >= 2 && segments.length <= 3) {
    const numeric = segments.map((segment) => Number(segment))
    if (numeric.some((part) => Number.isNaN(part))) {
      return undefined
    }
    if (numeric.length === 3) {
      const [h, m, s] = numeric
      return h * 3600 + m * 60 + s
    }
    if (numeric.length === 2) {
      const [m, s] = numeric
      return m * 60 + s
    }
  }
  const fallback = Number(str)
  return Number.isFinite(fallback) ? fallback : undefined
}

const firstNonEmpty = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const str = toStringOrUndefined(value)
    if (str) return str
  }
  return undefined
}

const capitaliseWords = (value: string): string =>
  value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())

const toAbsoluteMediaUrl = (url?: string): string | undefined => {
  const candidate = toStringOrUndefined(url)
  if (!candidate) return undefined
  if (/^https?:\/\//i.test(candidate)) return candidate
  const base = getConfig().apiBaseUrl.replace(/\/$/, '')
  const path = candidate.startsWith('/') ? candidate : `/${candidate}`
  return `${base}${path}`
}

export const resolveLocationLabel = (clip: Clip): string => {
  const raw = firstNonEmpty(clip.locationDisplay, clip.gameLocation, clip.location)
  if (!raw) return '—'
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return '—'
  if (normalized === 'h' || normalized.includes('home')) return 'Home'
  if (normalized === 'a' || normalized.includes('away') || normalized.startsWith('at ')) return 'Away'
  if (normalized === 'n' || normalized.includes('neutral')) return 'Neutral'
  return capitaliseWords(raw)
}

export type LocationTag = 'home' | 'away' | 'neutral' | 'unknown'

const REMOTE_SHORTHANDS = ['@', ' at ', 'road', 'away', 'visitor', ' (a)', '[a]']
const HOME_SHORTHANDS = ['vs', 'home', '(h)', '[h]', 'host']

const classifyLocationTag = (value: string | undefined): LocationTag => {
  if (!value) return 'unknown'
  const normalized = value.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized.startsWith('n') || normalized.includes('neutral')) return 'neutral'
  if (normalized === 'h' || normalized === 'home' || normalized.includes('home')) return 'home'
  if (normalized === 'a' || normalized === 'away' || normalized.includes('away') || normalized.includes('road')) {
    return 'away'
  }
  if (normalized.startsWith('vs') || normalized.startsWith('v ')) return 'home'
  if (normalized.startsWith('at ') || normalized.startsWith('@')) return 'away'
  return 'unknown'
}

const inferFromOpponent = (opponent?: string | null): LocationTag => {
  if (!opponent) return 'unknown'
  const normalized = opponent.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized.includes('neutral')) return 'neutral'
  if (REMOTE_SHORTHANDS.some((snippet) => normalized.includes(snippet))) return 'away'
  if (HOME_SHORTHANDS.some((snippet) => normalized.includes(snippet))) return 'home'
  return 'unknown'
}

const inferFromScore = (score?: string | null): LocationTag => {
  if (!score) return 'unknown'
  const normalized = score.trim().toLowerCase()
  if (!normalized) return 'unknown'
  if (normalized.includes('neutral') || normalized.includes('(n)') || normalized.includes('[n]')) return 'neutral'
  if (normalized.includes('@') || normalized.includes(' at ')) return 'away'
  if (normalized.includes('vs') || normalized.includes('vs.')) return 'home'
  return 'unknown'
}

export const resolveLocationTag = (clip: Clip): LocationTag => {
  const raw = firstNonEmpty(clip.location, clip.locationDisplay, clip.gameLocation)
  const primary = classifyLocationTag(raw)
  if (primary !== 'unknown') {
    return primary
  }

  const opponentInferred = inferFromOpponent(clip.opponent)
  if (opponentInferred !== 'unknown') {
    return opponentInferred
  }

  const scoreInferred = inferFromScore(clip.gameScore)
  if (scoreInferred !== 'unknown') {
    return scoreInferred
  }

  const filenameInferred = inferFromOpponent(clip.filename)
  if (filenameInferred !== 'unknown') {
    return filenameInferred
  }

  return 'unknown'
}

export const resolveLocationMeta = (
  clip: Clip,
): {
  tag: LocationTag
  label: string
} => ({
  tag: resolveLocationTag(clip),
  label: resolveLocationLabel(clip),
})

const safeId = (raw: unknown): string => {
  const value = toStringOrUndefined(raw)
  if (value) return value
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `clip-${Date.now()}`
}

export const normalizeClip = (raw: any): Clip => {
  const gameNum = firstNonEmpty(raw?.game_num, raw?.gameId, raw?.game_id, raw?.gameNumber, raw?.gameNum)
  const createdAt = firstNonEmpty(raw?.created_at, raw?.createdAt, raw?.savedAt)
  const updatedAt = firstNonEmpty(raw?.updated_at, raw?.updatedAt)
  const savedAt = firstNonEmpty(raw?.savedAt, raw?.saved_at, createdAt, updatedAt)

  const locationCode = firstNonEmpty(
    raw?.location_code,
    raw?.locationCode,
    raw?.LocationCode,
    raw?.location,
    raw?.Location,
    raw?.game_location,
    raw?.gameLocation,
    raw?.['Game Location'],
  )

  const locationDisplay = firstNonEmpty(
    raw?.location_display,
    raw?.locationDisplay,
    raw?.LocationDisplay,
    raw?.Location,
    raw?.['Game Location'],
    raw?.game_location,
    raw?.gameLocation,
  )

  const clip: Clip = {
    id: safeId(raw?.id ?? raw?.clip_id ?? raw?.canonical_clip_id),
    gameId: gameNum ?? '',
    filename: toStringOrUndefined(raw?.filename),
    sourceVideo: toStringOrUndefined(raw?.source_video ?? raw?.sourceVideo),
    gameDate: toStringOrUndefined(raw?.game_date),
    gameNumber: gameNum,
    opponent: toStringOrUndefined(raw?.opponent),
    gameScore: toStringOrUndefined(raw?.score ?? raw?.game_score),
    quarter: toStringOrUndefined(raw?.quarter ?? raw?.q) ?? toNumberOrUndefined(raw?.quarter ?? raw?.q),
    possession: toStringOrUndefined(raw?.possession ?? raw?.p) ?? toNumberOrUndefined(raw?.possession ?? raw?.p),
    situation: toStringOrUndefined(raw?.situation),
    formation: toStringOrUndefined(raw?.formation ?? raw?.offensive_formation),
    playName: toStringOrUndefined(raw?.play_name ?? raw?.playName),
    scoutCoverage: toStringOrUndefined(raw?.scout_coverage ?? raw?.scoutCoverage),
    playTrigger: toStringOrUndefined(
      raw?.play_trigger ?? raw?.playTrigger ?? raw?.action_trigger ?? raw?.actionTrigger,
    ),
    actionTypes: toStringOrUndefined(raw?.action_types ?? raw?.actionTypes),
    actionSequence: toStringOrUndefined(raw?.action_sequence ?? raw?.actionSequence),
    coverage: toStringOrUndefined(raw?.coverage ?? raw?.defensive_coverage),
    ballScreen: toStringOrUndefined(raw?.ball_screen ?? raw?.ball_screen_coverage ?? raw?.ballScreen),
    offBallScreen: toStringOrUndefined(raw?.off_ball_screen ?? raw?.offball_screen_coverage ?? raw?.offBallScreen),
    helpRotation: toStringOrUndefined(raw?.help_rotation ?? raw?.helpRotation),
    disruption: toStringOrUndefined(raw?.disruption ?? raw?.defensive_disruption),
    playResult: toStringOrUndefined(raw?.play_result ?? raw?.result ?? raw?.playResult),
    playType: toStringOrUndefined(raw?.play_type ?? raw?.playType),
    possessionResult: toStringOrUndefined(raw?.possession_result ?? raw?.possessionResult),
    shooterDesignation: toStringOrUndefined(raw?.shooter_designation ?? raw?.shooterDesignation ?? raw?.shooter),
    defenderDesignation: toStringOrUndefined(raw?.defender_designation ?? raw?.defenderDesignation),
    tags: Array.isArray(raw?.tags) ? raw.tags : undefined,
    notes: toStringOrUndefined(raw?.notes),
    videoUrl: toAbsoluteMediaUrl(firstNonEmpty(raw?.video_url, raw?.videoUrl, raw?.video_path, raw?.path)),
    videoStart: parseClockTime(raw?.start_time ?? raw?.startTime),
    videoEnd: parseClockTime(raw?.end_time ?? raw?.endTime),
    hasShot: coerceBoolean(raw?.has_shot ?? raw?.hasShot),
    shotX: toNumberOrUndefined(raw?.shot_x ?? raw?.shotX),
    shotY: toNumberOrUndefined(raw?.shot_y ?? raw?.shotY),
    shotResult: toStringOrUndefined(raw?.shot_result ?? raw?.shotResult),
    shotLocation: toStringOrUndefined(raw?.shot_location ?? raw?.shotLocation),
    shotContest: toStringOrUndefined(raw?.shot_contest ?? raw?.shotContest ?? raw?.contest),
    shotQuality: toStringOrUndefined(raw?.shot_quality ?? raw?.shotQuality),
    paintTouches: toStringOrUndefined(raw?.paint_touches ?? raw?.paintTouches ?? raw?.paint_touch ?? raw?.paintTouch),
    rebound: toStringOrUndefined(raw?.rebound ?? raw?.rebound_outcome ?? raw?.reboundOutcome),
    points: toNumberOrUndefined(raw?.points),
    breakdown: toStringOrUndefined(raw?.breakdown ?? raw?.defensive_breakdown),
    location: toStringOrUndefined(locationCode ?? raw?.location),
    locationDisplay: toStringOrUndefined(locationDisplay),
    gameLocation: toStringOrUndefined(raw?.game_location ?? raw?.gameLocation ?? raw?.['Game Location']),
    savedAt,
    createdAt,
    updatedAt,
    actions: parseClipActions(raw?.actions ?? raw?.actions_json),
  }

  if (!clip.gameId) {
    clip.gameId = clip.gameNumber ? String(clip.gameNumber) : ''
  }

  return clip
}

export type ClipSummary = {
  id: string
  opponent: string
  game: string
  gameDateRaw: string | null
  gameDateDisplay: string
  gameScore: string
  locationLabel: string
  locationRaw: string
  playResult: string
  shooterDesignation: string
  shotResult: string
  hasShot: boolean
  notesPreview: string
  savedAtRaw: string | null
  savedAtDisplay: string
}

const formatDate = (value: string | undefined): { raw: string | null; formatted: string } => {
  if (!value) return { raw: null, formatted: '—' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { raw: value, formatted: value }
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return { raw: value, formatted: formatter.format(date) }
}

const formatDateOnly = (value: string | undefined): { raw: string | null; formatted: string } => {
  if (!value) return { raw: null, formatted: '—' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { raw: value, formatted: value }
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  })
  return { raw: value, formatted: formatter.format(date) }
}

const notesPreview = (notes?: string): string => {
  if (!notes) return '—'
  const trimmed = notes.trim()
  if (!trimmed) return '—'
  if (trimmed.length <= 120) return trimmed
  return `${trimmed.slice(0, 117)}…`
}

const parseClipActions = (raw: unknown): TagAction[] => {
  if (typeof raw === 'string') {
    try {
      return parseClipActions(JSON.parse(raw))
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => ({
    phase: typeof entry?.phase === 'string' ? entry.phase : '',
    type: typeof entry?.type === 'string' ? entry.type : '',
    coverage: typeof entry?.coverage === 'string' ? entry.coverage : '',
    help: typeof entry?.help === 'string' ? entry.help : '',
    breakdown: typeof entry?.breakdown === 'string' ? entry.breakdown : '',
    communication: typeof entry?.communication === 'string' ? entry.communication : '',
    outcome: typeof entry?.outcome === 'string' ? entry.outcome : '',
  }))
}

export const toClipSummary = (clip: Clip): ClipSummary => {
  const saved = formatDate(clip.savedAt ?? clip.createdAt ?? clip.updatedAt)
  const gameDateInfo = formatDateOnly(clip.gameDate)
  const locationRaw = clip.location ?? clip.locationDisplay ?? clip.gameLocation ?? ''
  const hasShot = Boolean(clip.hasShot)
  return {
    id: clip.id || '—',
    opponent: clip.opponent ?? '—',
    game: clip.gameId || '—',
    gameDateRaw: gameDateInfo.raw,
    gameDateDisplay: gameDateInfo.formatted,
    gameScore: clip.gameScore ?? '—',
    locationLabel: resolveLocationLabel(clip),
    locationRaw,
    playResult: clip.playResult ?? '—',
    shooterDesignation: clip.shooterDesignation ?? '—',
    shotResult: hasShot ? clip.shotResult ?? '—' : '—',
    hasShot,
    notesPreview: notesPreview(clip.notes),
    savedAtRaw: saved.raw,
    savedAtDisplay: saved.formatted,
  }
}

export const DASHBOARD_STORAGE_KEY = 'ou_wbb_selected_clips'
const LEGACY_CACHE_FALLBACK_KEY = 'ou_clips_v1'

export const loadCachedClips = (): Clip[] => {
  if (typeof window === 'undefined') return []

  const readKey = (key: string | null) => {
    if (!key) return null
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed.map((entry) => normalizeClip(entry))
    } catch (err) {
      console.warn('Could not parse cached clips from', key, err)
      return null
    }
  }

  return (
    readKey(DASHBOARD_STORAGE_KEY) ||
    readKey(LEGACY_CACHE_FALLBACK_KEY) ||
    []
  )
}

export const findCachedClip = (clipId: string | null | undefined): Clip | null => {
  if (!clipId) return null
  const cache = loadCachedClips()
  return cache.find((clip) => clip.id === clipId) ?? null
}

const serializeClip = (clip: Clip): Record<string, unknown> => ({
  ...clip,
  hasShot: clip.hasShot ?? undefined,
  actions: clip.actions ?? undefined,
})

export const syncClipToCache = (clip: Clip): void => {
  if (typeof window === 'undefined') return
  try {
    const current = loadCachedClips()
    const normalized = normalizeClip(clip)
    const index = current.findIndex((c) => c.id === normalized.id)
    if (index >= 0) {
      current[index] = normalized
    } else {
      current.unshift(normalized)
    }
    const payload = JSON.stringify(current.map((item) => serializeClip(item)))
    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, payload)
    window.localStorage.setItem(LEGACY_CACHE_FALLBACK_KEY, payload)
  } catch (err) {
    console.warn('Failed to sync clip cache', err)
  }
}
