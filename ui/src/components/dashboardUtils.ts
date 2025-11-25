import type { Clip } from '../lib/types'
import { resolveLocationMeta, type LocationTag } from '../lib/data/transformers'
import { resolveCachedGameLocation } from '../lib/locationCache'

const STOP_KEYWORDS = ['turnover', 'miss', 'steal', 'charge', 'block', 'offensive foul']

export type GameAggregate = {
  id: string
  opponent: string
  locationLabel: string
  locationTag: LocationTag
  clipCount: number
  stopRate: number
  breakdownRate: number
  score: string
  resultLabel: string
}

export const detectStop = (clip: Clip): boolean => {
  if (typeof clip.points === 'number') {
    return clip.points <= 0
  }
  const text = (clip.playResult ?? '').toLowerCase()
  return STOP_KEYWORDS.some((keyword) => text.includes(keyword))
}

export const detectBreakdown = (clip: Clip): boolean => {
  const value = clip.breakdown ?? ''
  if (!value) return false
  return value.trim().toLowerCase().startsWith('y')
}

export const aggregateGames = (clips: Clip[]): GameAggregate[] => {
  const map = new Map<
    string,
    {
      id: string
      opponent: string
      clipCount: number
      stopCount: number
      breakdownCount: number
      locationCounts: Record<string, number>
      locationLabel?: string
      score?: string
      resultLabel?: string
    }
  >()

  clips.forEach((clip) => {
    const key = clip.gameId || clip.id
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        opponent: clip.opponent ?? '—',
        clipCount: 0,
        stopCount: 0,
        breakdownCount: 0,
        locationCounts: {},
        locationLabel: resolveLocationMeta(clip).label,
        locationTag: 'unknown',
        score: clip.gameScore ?? '—',
        resultLabel: '—',
      })
    }
    const entry = map.get(key)!
    entry.clipCount += 1
    if (detectStop(clip)) entry.stopCount += 1
    if (detectBreakdown(clip)) entry.breakdownCount += 1

    // Update score if this clip has a valid gameScore
    if (clip.gameScore && clip.gameScore !== '—' && clip.gameScore.trim() !== '') {
      const scoreStr = clip.gameScore.trim()
      // Try to parse format like "75-68 W" or "75-68 L"
      const match = scoreStr.match(/^(.+?)\s+([WLwl])$/)
      if (match) {
        entry.score = match[1].trim()
        entry.resultLabel = match[2].toUpperCase()
      } else {
        // If no W/L suffix, just use the score as-is
        entry.score = scoreStr
      }
    }

    const { label: locationDisplay, tag: locationTag } = resolveLocationMeta(clip)
    const normalized = locationDisplay.toLowerCase()
    // Always update location if we have a valid value (including when it's the first clip with location data)
    if (normalized && normalized !== '—') {
      entry.locationCounts[normalized] = (entry.locationCounts[normalized] ?? 0) + 1
      // Update the location label and tag whenever we encounter a non-empty location
      entry.locationLabel = locationDisplay
      // Update the tag if we have a better tag than 'unknown', or if current tag is 'unknown'
      if (locationTag !== 'unknown') {
        entry.locationTag = locationTag
      }
    }
  })

  const applyCachedLocation = (
    entry: {
      id: string
      opponent: string
      locationLabel?: string
      locationTag: LocationTag
      score?: string
    },
  ) => {
    const cached = resolveCachedGameLocation(entry.id, entry.opponent)
    if (!cached || (!cached.code && !cached.display)) {
      return
    }
    const synthetic = {
      id: entry.id,
      gameId: entry.id,
      opponent: entry.opponent,
      gameScore: entry.score,
      location: cached.code ?? '',
      locationDisplay: cached.display ?? '',
      gameLocation: cached.code ?? '',
    } as Clip
    const fallback = resolveLocationMeta(synthetic)
    if (!entry.locationLabel || entry.locationLabel === '—') {
      entry.locationLabel = fallback.label
    }
    if (entry.locationTag === 'unknown' && fallback.tag !== 'unknown') {
      entry.locationTag = fallback.tag
    }
  }

  return Array.from(map.values()).map((entry) => {
    applyCachedLocation(entry)
    const locationLabel = entry.locationLabel ?? '—'
    return {
      id: entry.id,
      opponent: entry.opponent,
      locationLabel,
      locationTag: entry.locationTag,
      clipCount: entry.clipCount,
      stopRate: entry.clipCount ? Math.round((entry.stopCount / entry.clipCount) * 100) : 0,
      breakdownRate: entry.clipCount ? Math.round((entry.breakdownCount / entry.clipCount) * 100) : 0,
      score: entry.score ?? '—',
      resultLabel: entry.resultLabel ?? '—',
    }
  })
}

export const summarizeStops = (clips: Clip[]) => {
  let stopCount = 0
  let breakdownCount = 0
  clips.forEach((clip) => {
    if (detectStop(clip)) stopCount += 1
    if (detectBreakdown(clip)) breakdownCount += 1
  })
  return { stopCount, breakdownCount }
}

export const formatPercent = (value: number): string => `${value.toFixed(0)}%`

export const computeGameStats = (clips: Clip[]) => {
  const total = clips.length
  if (!total) {
    return { stopRate: 0, breakdownRate: 0, pointsPerClip: 0 }
  }
  let stopCount = 0
  let breakdownCount = 0
  let pointsTotal = 0
  clips.forEach((clip) => {
    if (detectStop(clip)) stopCount += 1
    if (detectBreakdown(clip)) breakdownCount += 1
    if (typeof clip.points === 'number' && Number.isFinite(clip.points)) {
      pointsTotal += clip.points
    }
  })
  return {
    stopRate: Math.round((stopCount / total) * 100),
    breakdownRate: Math.round((breakdownCount / total) * 100),
    pointsPerClip: total ? pointsTotal / total : 0,
  }
}
