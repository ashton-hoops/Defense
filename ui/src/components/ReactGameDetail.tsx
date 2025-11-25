import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { DataMode } from '../lib/data'
import { createCloudAdapter, createLocalAdapter } from '../lib/data'
import type { Clip } from '../lib/types'
import { resolveLocationLabel } from '../lib/data/transformers'
import { computeGameStats, detectBreakdown, detectStop, formatPercent } from './dashboardUtils'
import './ReactGameDetail.css'

type ViewMode = 'grid' | 'table' | 'shotchart'
type FilterKey =
  | 'situation'
  | 'scout'
  | 'coverage'
  | 'ballScreen'
  | 'offBall'
  | 'help'
  | 'disruption'
  | 'breakdown'
  | 'shooter'
  | 'result'
  | 'paintTouches'
  | 'shotLocation'
  | 'shotContest'
  | 'rebound'

type FilterState = Record<FilterKey, Set<string>>
type SearchFilters = {
  formation: string
  playName: string
  playTrigger: string
  actionTypes: string
  actionSequence: string
  breakdownDetail: string
}

type FilterGroup = {
  key: FilterKey
  label: string
  icon: string
  options: Array<{ label: string; value: string }>
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    key: 'situation',
    label: 'SITUATION',
    icon: '🏃',
    options: [
      { label: 'Half Court', value: 'half court' },
      { label: 'Transition', value: 'transition' },
      { label: 'SLOB', value: 'slob' },
      { label: 'BLOB', value: 'blob' },
      { label: 'Early Offense', value: 'early offense' },
      { label: 'Half Court (ATO)', value: 'half court (ato)' },
    ],
  },
  {
    key: 'scout',
    label: 'COVERED IN SCOUT?',
    icon: '📋',
    options: [
      { label: 'Yes – Practiced', value: 'yes – practiced' },
      { label: 'Partial – Similar Action', value: 'partial – similar action' },
      { label: 'No – Not Practiced', value: 'no – not practiced' },
    ],
  },
  {
    key: 'coverage',
    label: 'DEFENSIVE COVERAGE',
    icon: '🛡️',
    options: [
      { label: 'Man', value: 'man' },
      { label: '2-3', value: '2-3' },
      { label: '3-2', value: '3-2' },
      { label: '1-3-1', value: '1-3-1' },
      { label: '1-2-2', value: '1-2-2' },
      { label: 'Full Court Man', value: 'full court man' },
      { label: '2-2-1 Press', value: '2-2-1 press' },
      { label: '1-2-1-1 Press (Diamond)', value: '1-2-1-1 press (diamond)' },
    ],
  },
  {
    key: 'ballScreen',
    label: 'BALL SCREEN COVERAGE',
    icon: '🎯',
    options: [
      { label: 'Under', value: 'under' },
      { label: 'Over', value: 'over' },
      { label: 'ICE', value: 'ice' },
      { label: 'Weak (Force Weak Hand)', value: 'weak (force weak hand)' },
      { label: 'Switch', value: 'switch' },
      { label: 'Hard Hedge', value: 'hard hedge' },
      { label: 'Soft Hedge/Show', value: 'soft hedge/show' },
      { label: 'Peel Switch', value: 'peel switch' },
      { label: 'Blitz (Trap)', value: 'blitz (trap)' },
    ],
  },
  {
    key: 'offBall',
    label: 'OFF-BALL SCREEN COVERAGE',
    icon: '🎯',
    options: [
      { label: 'Attach/Stay', value: 'attach/stay' },
      { label: 'Over', value: 'over' },
      { label: 'Under', value: 'under' },
      { label: 'Top-Lock', value: 'top-lock' },
      { label: 'Switch', value: 'switch' },
      { label: 'Show', value: 'show' },
    ],
  },
  {
    key: 'help',
    label: 'HELP / ROTATION',
    icon: '🌀',
    options: [
      { label: 'No Help / No Rotation', value: 'no help / no rotation' },
      { label: 'Low-Man Help', value: 'low-man help' },
      { label: 'X-Out Rotation', value: 'x-out rotation' },
      { label: 'Sink / Fill', value: 'sink / fill' },
      { label: 'Full Rotation', value: 'full rotation' },
      { label: 'Late Help', value: 'late help' },
      { label: 'No Rotation (Missed)', value: 'no rotation (missed)' },
      { label: 'Peel Help', value: 'peel help' },
    ],
  },
  {
    key: 'disruption',
    label: 'DEFENSIVE DISRUPTION',
    icon: '💥',
    options: [
      { label: 'Denied Wing Entry', value: 'denied wing entry' },
      { label: 'Denied Post Entry', value: 'denied post entry' },
      { label: 'Pressured Ball Handler to Prevent Pass', value: 'pressured ball handler to prevent pass' },
      { label: 'Deflected Pass', value: 'deflected pass' },
    ],
  },
  {
    key: 'breakdown',
    label: 'BREAKDOWN',
    icon: '⚠️',
    options: [
      { label: 'Yes', value: 'yes' },
      { label: 'No', value: 'no' },
    ],
  },
  {
    key: 'shooter',
    label: 'SHOOTER DESIGNATION',
    icon: '🎯',
    options: [
      { label: '🔵 Blue (Primary)', value: 'blue' },
      { label: '🟢 Green (Shooter)', value: 'green' },
      { label: '⚫ Black (Role)', value: 'black' },
    ],
  },
  {
    key: 'result',
    label: 'PLAY RESULT',
    icon: '📊',
    options: [
      { label: 'Made FG', value: 'made fg' },
      { label: 'Missed FG', value: 'missed fg' },
      { label: 'And-One', value: 'and-one' },
      { label: 'Live-Ball Turnover', value: 'live-ball turnover' },
      { label: 'Dead-Ball Turnover', value: 'dead-ball turnover' },
      { label: 'Turnover (Shot Clock Violation)', value: 'turnover (shot clock violation)' },
      { label: 'Shooting Foul', value: 'shooting foul' },
      { label: 'Off-Ball Foul', value: 'off-ball foul' },
      { label: 'Reach-In Foul', value: 'reach-in foul' },
      { label: 'Loose-Ball Foul', value: 'loose-ball foul' },
      { label: 'Deflection (Out of Bounds)', value: 'deflection (out of bounds)' },
    ],
  },
  {
    key: 'paintTouches',
    label: 'PAINT TOUCHES',
    icon: '🎯',
    options: [
      { label: 'No Paint Touch', value: 'no paint touch' },
      { label: 'Drive Baseline', value: 'drive baseline' },
      { label: 'Drive Middle', value: 'drive middle' },
      { label: 'Post Touch - Low Block', value: 'post touch - low block' },
      { label: 'Post Touch - High Post', value: 'post touch - high post' },
      { label: 'Cut to Paint (Received Pass)', value: 'cut to paint (received pass)' },
    ],
  },
  {
    key: 'shotLocation',
    label: 'SHOT LOCATION',
    icon: '🎯',
    options: [
      { label: 'At Rim (0–4 ft)', value: 'at rim (0–4 ft)' },
      { label: 'Paint (5–10 ft)', value: 'paint (5–10 ft)' },
      { label: 'Short Midrange (11–14 ft)', value: 'short midrange (11–14 ft)' },
      { label: 'Long Midrange (15–20 ft)', value: 'long midrange (15–20 ft)' },
      { label: 'Corner 3 (21 ft 6 in)', value: 'corner 3 (21 ft 6 in)' },
      { label: 'Wing/Top 3 (22–23 ft)', value: 'wing/top 3 (22–23 ft)' },
      { label: 'Deep 3 (24–26 ft)', value: 'deep 3 (24–26 ft)' },
      { label: 'Late Clock / Heave (27 ft +)', value: 'late clock / heave (27 ft +)' },
    ],
  },
  {
    key: 'shotContest',
    label: 'SHOT CONTEST',
    icon: '🛡️',
    options: [
      { label: 'Open (4+ ft)', value: 'open (4+ ft)' },
      { label: 'Light Contest / Late High-Hand (2–4 ft)', value: 'light contest / late high-hand (2–4 ft)' },
      { label: 'Contested/On-Time High-Hand (1–2 ft)', value: 'contested/on-time high-hand (1–2 ft)' },
      { label: 'Heavy Contest / Early High-Hand (0–1 ft)', value: 'heavy contest / early high-hand (0–1 ft)' },
      { label: 'Blocked', value: 'blocked' },
    ],
  },
  {
    key: 'rebound',
    label: 'REBOUND OUTCOME',
    icon: '🏀',
    options: [
      { label: 'DREB', value: 'dreb' },
      { label: 'OREB', value: 'oreb' },
      { label: 'Other', value: 'other' },
    ],
  },
]

const FILTER_ACCESSORS: Record<FilterKey, (clip: Clip) => string | undefined | null> = {
  situation: (clip) => clip.situation ?? clip.playType,
  scout: (clip) => clip.scoutCoverage,
  coverage: (clip) => clip.coverage ?? clip.playResult,
  ballScreen: (clip) => clip.ballScreen ?? clip.playType,
  offBall: (clip) => clip.offBallScreen ?? clip.possessionResult,
  help: (clip) => clip.helpRotation,
  disruption: (clip) => clip.disruption,
  breakdown: (clip) => clip.breakdown,
  shooter: (clip) => clip.shooterDesignation,
  result: (clip) => clip.playResult,
  paintTouches: (clip) => clip.paintTouches,
  shotLocation: (clip) => clip.shotLocation,
  shotContest: (clip) => clip.shotContest,
  rebound: (clip) => clip.rebound,
}

const FILTER_CONFIG = FILTER_GROUPS.map((group) => ({
  key: group.key,
  label: group.label,
  icon: group.icon,
  accessor: FILTER_ACCESSORS[group.key],
}))

const normalizeSelectionValue = (value: string): string => value.trim().toLowerCase()

const createEmptyFilterState = (): FilterState =>
  FILTER_CONFIG.reduce((acc, conf) => {
    acc[conf.key] = new Set<string>()
    return acc
  }, {} as FilterState)

type ReactGameDetailProps = {
  dataMode: DataMode
  onBack?: () => void
  onOpenClip?: (clipId: string, clip: Clip) => void
}

const hasShotCoordinates = (clip: Clip): clip is Clip & { shotX: number; shotY: number } =>
  Boolean(
    clip.hasShot &&
      clip.shotX != null &&
      clip.shotY != null &&
      Number.isFinite(clip.shotX) &&
      Number.isFinite(clip.shotY),
  )

const ReactGameDetail = ({ dataMode, onBack, onOpenClip }: ReactGameDetailProps) => {
  const { gameId } = useParams<{ gameId: string }>()
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { 'game-scope': true, 'tag-search': true }
    FILTER_CONFIG.forEach((conf) => {
      initial[conf.key] = true
    })
    return initial
  })
  const [shotCollapsed, setShotCollapsed] = useState(false)
  const [selectedGames, setSelectedGames] = useState<Set<string>>(
    () => new Set(gameId ? [normalizeSelectionValue(gameId)] : []),
  )
  const [filters, setFilters] = useState<FilterState>(() => createEmptyFilterState())
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    formation: '',
    playName: '',
    playTrigger: '',
    actionTypes: '',
    actionSequence: '',
    breakdownDetail: '',
  })
  const adapterFactory = useMemo(
    () => (dataMode === 'cloud' ? createCloudAdapter : createLocalAdapter),
    [dataMode],
  )
  const gameScopeOptions = useMemo(() => {
    const map = new Map<string, string>()
    clips.forEach((clip) => {
      const rawValue = clip.gameId ?? clip.gameNumber ?? clip.id
      if (!rawValue) return
      const normalized = normalizeSelectionValue(rawValue.toString())
      const label = `Game ${clip.gameNumber ?? clip.gameId ?? gameId ?? '—'} - ${clip.opponent ?? '—'}`
      map.set(normalized, label)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [clips, gameId])

  useEffect(() => {
    if (!gameId) {
      setSelectedGames(new Set())
      return
    }
    setSelectedGames(new Set(gameScopeOptions.map((option) => option.value)))
  }, [gameId, gameScopeOptions])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!gameId) {
        setClips([])
        setLoading(false)
        setError('Select a game from the dashboard to open the React view.')
        return
      }
      setLoading(true)
      setError(null)
      try {
        const adapter = adapterFactory()
        const response = await adapter.listClips()
        if (cancelled) return
        const normalizedId = normalizeSelectionValue(gameId ?? '')
        const filtered = response.items.filter((clip) => {
          const candidates = [
            clip.gameId?.toString(),
            clip.gameNumber != null ? String(clip.gameNumber) : undefined,
            clip.id?.toString(),
          ]
          return candidates.some(
            (value) => value && normalizeSelectionValue(value) === normalizedId,
          )
        })
        setClips(filtered)
        if (!filtered.length) {
          setError('No clips match this game in the local database.')
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('React game detail failed to load clips', err)
          setError(
            dataMode === 'cloud'
              ? 'Cloud API not available. Start the service or switch to Local.'
              : 'Local API unavailable. Is media_server.py running?',
          )
          setClips([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [adapterFactory, dataMode, gameId])

  const primaryClip = clips[0]
  const opponent = primaryClip?.opponent ?? '—'
  const locationLabel = primaryClip ? resolveLocationLabel(primaryClip) : '—'
  const filteredClips = useMemo(() => {
    const hasFilters = FILTER_CONFIG.some((conf) => filters[conf.key].size > 0)
    const hasGameFilters = selectedGames.size > 0
    const hasSearch = Object.values(searchFilters).some((value) => value.trim())

    return clips.filter((clip) => {
      if (hasGameFilters) {
        const candidates = [
          clip.gameId != null ? String(clip.gameId).toLowerCase() : null,
          clip.gameNumber != null ? String(clip.gameNumber).toLowerCase() : null,
          clip.id ? clip.id.toLowerCase() : null,
        ].filter(Boolean) as string[]
        const match = Array.from(selectedGames).some((value) =>
          candidates.includes(value.toLowerCase()),
        )
        if (!match) return false
      }

      if (
        hasFilters &&
        !FILTER_CONFIG.every((conf) => {
          const selections = filters[conf.key]
          if (!selections.size) return true
          const value = conf.accessor(clip)
          const normalized = value?.toString().trim().toLowerCase()
          return normalized ? selections.has(normalized) : false
        })
      ) {
        return false
      }

      if (hasSearch) {
        const matchField = (value: string | undefined | null, search: string) => {
          if (!search.trim()) return true
          const normalizedValue = value?.toString().toLowerCase() ?? ''
          return normalizedValue.includes(search.trim().toLowerCase())
        }
        if (!matchField(clip.formation, searchFilters.formation)) return false
        if (!matchField(clip.playName, searchFilters.playName)) return false
        if (!matchField(clip.playTrigger, searchFilters.playTrigger)) return false
        if (!matchField(clip.actionTypes, searchFilters.actionTypes)) return false
        if (!matchField(clip.actionSequence, searchFilters.actionSequence)) return false
        if (!matchField(clip.breakdown, searchFilters.breakdownDetail)) return false
      }

      return true
    })
  }, [clips, filters, searchFilters, selectedGames])

  const stats = useMemo(() => computeGameStats(filteredClips), [filteredClips])
  const shots = useMemo(() => filteredClips.filter(hasShotCoordinates), [filteredClips])

  const filterOptions = useMemo(
    () =>
      FILTER_GROUPS.reduce((acc, group) => {
        acc[group.key] = group.options
        return acc
      }, {} as Record<FilterKey, Array<{ label: string; value: string }>>),
    [],
  )

  const toggleFilterValue = (key: FilterKey, value: string) => {
    const normalized = normalizeSelectionValue(value)
    setFilters((prev) => {
      const next = new Set(prev[key])
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return { ...prev, [key]: next }
    })
  }

  const clearFilters = () => {
    setFilters(createEmptyFilterState())
    setSelectedGames(new Set<string>())
    setSearchFilters({
      formation: '',
      playName: '',
      playTrigger: '',
      actionTypes: '',
      actionSequence: '',
      breakdownDetail: '',
    })
  }

  const handleSearchChange = (key: keyof SearchFilters, value: string) => {
    setSearchFilters((prev) => ({ ...prev, [key]: value }))
  }

  const activeFilterCount = useMemo(() => {
    const checkboxCount = Object.values(filters).reduce((total, set) => total + set.size, 0)
    const searchCount = Object.values(searchFilters).reduce((total, value) => total + (value.trim() ? 1 : 0), 0)
    return checkboxCount + searchCount + selectedGames.size
  }, [filters, searchFilters, selectedGames])

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleGameFilter = (value: string) => {
    const normalized = normalizeSelectionValue(value)
    if (!normalized) return
    setSelectedGames((prev) => {
      const next = new Set(prev)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else {
        next.add(normalized)
      }
      return next
    })
  }

  const handleExport = () => {
    if (!filteredClips.length) return
    const columns: Array<{ label: string; accessor: (clip: Clip) => string | number | undefined | null }> = [
      { label: 'Clip ID', accessor: (clip) => clip.id },
      { label: 'Game', accessor: (clip) => clip.gameId },
      { label: 'Opponent', accessor: (clip) => clip.opponent },
      { label: 'Result', accessor: (clip) => clip.playResult },
      { label: 'Shooter', accessor: (clip) => clip.shooterDesignation },
      { label: 'Coverage', accessor: (clip) => clip.playType },
      { label: 'Notes', accessor: (clip) => clip.notes },
    ]
    const header = columns.map((col) => `"${col.label}"`).join(',')
    const rows = filteredClips.map((clip) =>
      columns
        .map((col) => {
          const value = col.accessor(clip)
          return `"${(value ?? '').toString().replace(/"/g, '""')}"`
        })
        .join(','),
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `game_${gameId ?? 'clips'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleClipClick = (clip: Clip) => {
    if (onOpenClip) {
      onOpenClip(clip.id, clip)
    }
  }

  return (
    <div className="game-detail">
      <header className="game-detail__header">
        <div>
          <p className="game-detail__eyebrow">React dashboard • Game detail</p>
          <h2>
            Game {gameId ?? '—'} vs {opponent}
          </h2>
          <p className="game-detail__meta">Location · {locationLabel}</p>
        </div>
        <div className="game-detail__actions">
          <button type="button" onClick={onBack} className="game-detail__back">
            ← Back to dashboard
          </button>
        </div>
      </header>

      {error && <div className="game-detail__error">{error}</div>}

      <section className="game-detail__stats">
        <div>
          <p className="stat-label">Clips Logged</p>
          <p className="stat-value">{filteredClips.length}</p>
        </div>
        <div>
          <p className="stat-label">Stop Rate</p>
          <p className="stat-value">{formatPercent(stats.stopRate)}</p>
        </div>
        <div>
          <p className="stat-label">Breakdown Rate</p>
          <p className="stat-value">{formatPercent(stats.breakdownRate)}</p>
        </div>
        <div>
          <p className="stat-label">Points / Clip</p>
          <p className="stat-value">{stats.pointsPerClip.toFixed(2)}</p>
        </div>
      </section>

      <section className="game-detail__toolbar">
        <div className="view-toggle">
          <button
            type="button"
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            Clip Grid
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            Spreadsheet
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === 'shotchart' ? 'active' : ''}`}
            onClick={() => setViewMode('shotchart')}
          >
            Shot Chart
          </button>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="filter-btn" onClick={handleExport}>
            Export
          </button>
          <button type="button" className="filter-btn" onClick={() => setFilterPanelOpen(true)}>
            Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
        </div>
      </section>


      {loading ? (
        <div className="game-detail__loading">Loading clips…</div>
      ) : filteredClips.length === 0 ? (
        <div className="game-detail__empty">No clips captured for this game.</div>
      ) : viewMode === 'shotchart' ? (
        <section className="shot-chart-view">
          <div className="shot-chart-container">
            <img
              src="/shot-chart.png"
              alt="Basketball Court"
              className="shot-chart-court"
            />
            <svg className="shot-chart-overlay" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {shots.map((shot, index) => {
                const cx = Math.max(0, Math.min(100, shot.shotX ?? 0))
                const cy = Math.max(0, Math.min(100, shot.shotY ?? 0))
                const playerDesignation = shot.playerDesignation || ''
                const shotResult = (shot.shotResult || '').toLowerCase()
                const isShotMake = shotResult === 'make' || shotResult === 'made fg' || shotResult === 'made ft'
                const isShotMiss = shotResult === 'miss' || shotResult === 'missed fg' || shotResult === 'missed ft'
                const designationKey = playerDesignation.toLowerCase().startsWith('blue')
                  ? 'primary'
                  : playerDesignation.toLowerCase().startsWith('green')
                    ? 'shooter'
                    : playerDesignation.toLowerCase().startsWith('black')
                      ? 'role'
                      : playerDesignation.toLowerCase()

                const playerColor =
                  designationKey === 'primary'
                    ? '#3b82f6'
                    : designationKey === 'shooter'
                      ? '#22c55e'
                      : designationKey === 'role'
                        ? '#1f2937'
                        : '#6b7280'

                const resultColor = isShotMake ? '#22c55e' : isShotMiss ? '#ef4444' : '#6b7280'
                const shotDisplay = isShotMake ? 'MAKE' : isShotMiss ? 'MISS' : (shot.shotResult || 'SHOT').toUpperCase()

                return (
                  <g
                    key={`shot-${index}`}
                    className="shot-marker-group"
                    onClick={() => handleClipClick(shot)}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>
                      Q{shot.quarter} P{shot.possession} • {shot.playName || 'No play'} • {shot.coverage || 'No coverage'}
{shot.shotContest ? ` • ${shot.shotContest}` : ''} • {shotDisplay} • {shot.points || 0} pts
                    </title>
                    {/* White outline */}
                    <circle cx={cx} cy={cy} r="1.2" fill="white" />
                    {/* Left half - Player Designation */}
                    <path
                      d={`M ${cx},${cy - 1} A 1,1 0 0,1 ${cx},${cy + 1} Z`}
                      fill={playerColor}
                    />
                    {/* Right half - Shot Result */}
                    <path
                      d={`M ${cx},${cy - 1} A 1,1 0 0,0 ${cx},${cy + 1} Z`}
                      fill={resultColor}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="shot-chart-legend">
            <div className="legend-section">
              <h4>Player Designation (Left Half)</h4>
              <div className="legend-items">
                <span className="legend-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M 8,1 A 7,7 0 0,0 8,15 L 8,1 Z" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                  </svg>
                  Primary
                </span>
                <span className="legend-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M 8,1 A 7,7 0 0,0 8,15 L 8,1 Z" fill="#22c55e" stroke="white" strokeWidth="1.5" />
                  </svg>
                  Shooter
                </span>
                <span className="legend-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M 8,1 A 7,7 0 0,0 8,15 L 8,1 Z" fill="#1f2937" stroke="white" strokeWidth="1.5" />
                  </svg>
                  Role
                </span>
              </div>
            </div>
            <div className="legend-section">
              <h4>Shot Result (Right Half)</h4>
              <div className="legend-items">
                <span className="legend-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M 8,1 A 7,7 0 0,1 8,15 L 8,1 Z" fill="#22c55e" stroke="white" strokeWidth="1.5" />
                  </svg>
                  Make
                </span>
                <span className="legend-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
                    <path d="M 8,1 A 7,7 0 0,1 8,15 L 8,1 Z" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                  </svg>
                  Miss
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : viewMode === 'grid' ? (
        <section className="clips-grid">
          {filteredClips.map((clip) => (
            <article key={clip.id} className="clip-card" onClick={() => handleClipClick(clip)}>
              <div className="clip-thumbnail">
                {clip.videoUrl ? (
                  <video src={`${clip.videoUrl}#t=0.5`} preload="metadata" muted playsInline />
                ) : (
                  <div className="clip-placeholder">No preview</div>
                )}
                <div className="play-overlay">
                  <div className="play-icon">
                    <img src="/ou-logo.png" alt="OU" className="play-logo" />
                  </div>
                </div>
                <div className="clip-badges">
                  <span className="badge badge-quarter">
                    Q{clip.quarter ?? '—'} P{clip.possession ?? '—'}
                  </span>
                </div>
              </div>
              <div className="clip-info">
                <div className="clip-game">
                  G{clip.gameId} · {clip.playResult ?? clip.playType ?? 'Defensive Possession'}
                </div>
                <div className="clip-tags">
                  {detectBreakdown(clip) ? (
                    <span className="tag tag-breakdown">🔴 Breakdown</span>
                  ) : (
                    <span className="tag tag-stop">🟢 Stop</span>
                  )}
                  <span className="tag tag-points">{clip.points ?? 0} pts</span>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="game-detail__table">
          <table>
            <thead>
              <tr>
                <th>Clip</th>
                <th>Result</th>
                <th>Shooter</th>
                <th>Notes</th>
                <th>Stop</th>
              </tr>
            </thead>
            <tbody>
              {filteredClips.map((clip) => (
                <tr key={clip.id} onClick={() => handleClipClick(clip)}>
                  <td>{clip.id}</td>
                  <td>{clip.playResult ?? '—'}</td>
                  <td>{clip.shooterDesignation ?? '—'}</td>
                  <td>{clip.notes ?? '—'}</td>
                  <td>{detectStop(clip) ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <aside className={`filter-panel ${filterPanelOpen ? 'open' : ''}`}>
        <div className="filter-panel-header">
          <div>
            <h3>Filters</h3>
            <p>{filteredClips.length} clips match</p>
          </div>
          <div className="filter-panel-actions">
            <button type="button" onClick={clearFilters}>
              Clear
            </button>
            <button type="button" onClick={() => setFilterPanelOpen(false)}>
              ✕
            </button>
          </div>
        </div>
        <div className="filter-panel-content">
          <div className={`filter-group ${collapsedSections['game-scope'] ? 'collapsed' : ''}`}>
            <p className="filter-group-title" onClick={() => toggleSection('game-scope')}>
              <span>🎯 GAME SCOPE</span>
              <span>{collapsedSections['game-scope'] ? '+' : '−'}</span>
            </p>
            <div className="checkbox-group">
              {gameScopeOptions.length === 0 && <p className="filter-empty">No games yet</p>}
              {gameScopeOptions.map((option) => (
                <label key={option.value} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedGames.has(option.value)}
                    onChange={() => toggleGameFilter(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {FILTER_CONFIG.map((config) => (
            <div
              key={config.key}
              className={`filter-group ${collapsedSections[config.key] ? 'collapsed' : ''}`}
            >
              <p className="filter-group-title" onClick={() => toggleSection(config.key)}>
                <span>
                  {config.icon} {config.label}
                </span>
                <span>{collapsedSections[config.key] ? '+' : '−'}</span>
              </p>
              <div className="checkbox-group">
                {filterOptions[config.key]?.map((option) => (
                  <label key={option.value} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={filters[config.key].has(normalizeSelectionValue(option.value))}
                      onChange={() => toggleFilterValue(config.key, option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
                {(!filterOptions[config.key] || filterOptions[config.key].length === 0) && (
                  <p className="filter-empty">No values yet</p>
                )}
              </div>
            </div>
          ))}

          <div className={`filter-group ${collapsedSections['tag-search'] ? 'collapsed' : ''}`}>
            <p className="filter-group-title" onClick={() => toggleSection('tag-search')}>
              <span>🔍 TAG SEARCH</span>
              <span>{collapsedSections['tag-search'] ? '+' : '−'}</span>
            </p>
            <div className="filter-search-group">
              <div className="filter-search-field">
                <label>Offensive Formation</label>
                <input
                  type="search"
                  placeholder="e.g. Horns, 5-Out"
                  value={searchFilters.formation}
                  onChange={(event) => handleSearchChange('formation', event.target.value)}
                />
              </div>
              <div className="filter-search-field">
                <label>Play Name</label>
                <input
                  type="search"
                  placeholder="Type play name"
                  value={searchFilters.playName}
                  onChange={(event) => handleSearchChange('playName', event.target.value)}
                />
              </div>
              <div className="filter-search-field">
                <label>Play Trigger</label>
                <input
                  type="search"
                  placeholder="e.g. Entry, DHO"
                  value={searchFilters.playTrigger}
                  onChange={(event) => handleSearchChange('playTrigger', event.target.value)}
                />
              </div>
              <div className="filter-search-field">
                <label>Action Type(s)</label>
                <input
                  type="search"
                  placeholder="Comma-separated actions"
                  value={searchFilters.actionTypes}
                  onChange={(event) => handleSearchChange('actionTypes', event.target.value)}
                />
              </div>
              <div className="filter-search-field">
                <label>Action Sequence</label>
                <input
                  type="search"
                  placeholder="Describe the sequence"
                  value={searchFilters.actionSequence}
                  onChange={(event) => handleSearchChange('actionSequence', event.target.value)}
                />
              </div>
              <div className="filter-search-field">
                <label>Defensive Breakdown Detail</label>
                <input
                  type="search"
                  placeholder="e.g. Late closeout"
                  value={searchFilters.breakdownDetail}
                  onChange={(event) => handleSearchChange('breakdownDetail', event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="filter-panel-footer">
            <button type="button" className="btn btn-clear" onClick={clearFilters}>
              Clear Filters
            </button>
            <button type="button" className="btn btn-apply" onClick={() => setFilterPanelOpen(false)}>
              Apply
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default ReactGameDetail
