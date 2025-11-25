import { useEffect, useMemo, useState } from 'react'
import type { DataMode } from '../lib/data'
import { createCloudAdapter, createLocalAdapter } from '../lib/data'
import type { Clip } from '../lib/types'
import { aggregateGames, formatPercent, summarizeStops } from './dashboardUtils'
import type { LocationTag } from '../lib/data/transformers'
import './ReactDashboard.css'

type ViewMode = 'grid' | 'table' | 'shotchart'
type LocationFilter = 'all' | 'home' | 'away' | 'neutral'
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

const FILTER_ACCESSORS: Record<FilterKey, (clip: Clip) => string | undefined | null> = {
  situation: (clip) => clip.situation,
  scout: (clip) => clip.scoutCoverage,
  coverage: (clip) => clip.coverage,
  ballScreen: (clip) => clip.ballScreen,
  offBall: (clip) => clip.offBallScreen,
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

const DASHBOARD_FILTER_GROUPS: Array<{
  key: FilterKey
  label: string
  icon: string
  options: Array<{ label: string; value: string }>
}> = [
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

const normalizeSelectionValue = (value: string): string => value.trim().toLowerCase()

const createEmptyFilterState = (): FilterState =>
  DASHBOARD_FILTER_GROUPS.reduce((acc, group) => {
    acc[group.key] = new Set<string>()
    return acc
  }, {} as FilterState)

const LOCATION_TAG_LABELS: Record<LocationTag, string> = {
  home: 'Home',
  away: 'Away',
  neutral: 'Neutral',
  unknown: 'Location',
}

const getLocationTagLabel = (tag?: LocationTag): string => LOCATION_TAG_LABELS[tag ?? 'unknown']

const getLocationDetailText = (label?: string | null, tag?: LocationTag): string | null => {
  if (!label) return null
  const trimmed = label.trim()
  if (!trimmed || trimmed === '—') return null
  const tagLabel = getLocationTagLabel(tag)
  if (tagLabel && trimmed.toLowerCase() === tagLabel.toLowerCase()) return null
  return trimmed
}
type ReactDashboardProps = {
  dataMode: DataMode
  onSelectGame?: (gameId: string) => void
  refreshKey?: number
}

const ReactDashboard = ({ dataMode, onSelectGame, refreshKey }: ReactDashboardProps) => {
  const [clips, setClips] = useState<Clip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all')
  const [semanticSearchEnabled, setSemanticSearchEnabled] = useState(false)
  const [semanticSearching, setSemanticSearching] = useState(false)
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { 'game-scope': true, 'tag-search': true }
    DASHBOARD_FILTER_GROUPS.forEach((group) => {
      initial[group.key] = true
    })
    return initial
  })
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set())
  const [selectedForExport, setSelectedForExport] = useState<Set<string>>(new Set())
  const [exportMode, setExportMode] = useState(false)
  const [filters, setFilters] = useState<FilterState>(() => createEmptyFilterState())
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    formation: '',
    playName: '',
    playTrigger: '',
    actionTypes: '',
    actionSequence: '',
    breakdownDetail: '',
  })
  const activeFilterCount = useMemo(() => {
    const checkboxCount = Object.values(filters).reduce((total, set) => total + set.size, 0)
    const searchCount = Object.values(searchFilters).reduce((total, value) => total + (value.trim() ? 1 : 0), 0)
    return checkboxCount + searchCount + selectedGames.size
  }, [filters, searchFilters, selectedGames])

  const adapterFactory = useMemo(
    () => (dataMode === 'cloud' ? createCloudAdapter : createLocalAdapter),
    [dataMode],
  )

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const adapter = adapterFactory()
        const response = await adapter.listClips()
        if (cancelled) return
        setClips(response.items)
      } catch (err) {
        if (!cancelled) {
          console.warn('React dashboard failed to load clips', err)
          setClips([])
          setError(
            dataMode === 'cloud'
              ? 'Cloud API not available. Start the service or switch to Local.'
              : 'Local API unavailable. Is media_server.py running?',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [adapterFactory, dataMode, refreshKey])

  const handleSemanticSearch = async () => {
    if (!searchTerm.trim()) return

    setSemanticSearching(true)
    setError(null)

    try {
      const response = await fetch('http://127.0.0.1:8000/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm, top_k: 100 }),
      })

      const data = await response.json()

      if (data.ok && data.results) {
        setClips(data.results)
        setSemanticSearchEnabled(true)
      } else {
        setError(data.error || 'Semantic search failed')
      }
    } catch (err) {
      console.error('Semantic search error:', err)
      setError('AI Search unavailable. Make sure API key is configured.')
    } finally {
      setSemanticSearching(false)
    }
  }

  const filteredClips = useMemo(() => {
    const hasFilters = DASHBOARD_FILTER_GROUPS.some((group) => filters[group.key].size > 0)
    const hasGameFilters = selectedGames.size > 0
    const hasSearch = Object.values(searchFilters).some((value) => value.trim())

    return clips.filter((clip) => {
      if (hasGameFilters) {
        const candidates = [
          clip.gameId != null ? String(clip.gameId).toLowerCase() : null,
          clip.gameNumber != null ? String(clip.gameNumber).toLowerCase() : null,
          clip.id ? clip.id.toLowerCase() : null,
        ].filter(Boolean) as string[]
        const match = Array.from(selectedGames).some((value) => candidates.includes(value))
        if (!match) return false
      }

      if (
        hasFilters &&
        !DASHBOARD_FILTER_GROUPS.every((group) => {
          const selections = filters[group.key]
          if (!selections.size) return true
          const value = FILTER_ACCESSORS[group.key](clip)
          const normalized = value?.toString().trim().toLowerCase()
          return normalized ? selections.has(normalized) : false
        })
      ) {
        return false
      }

      if (hasSearch) {
        const matchField = (value: string | undefined | null, term: string) => {
          if (!term.trim()) return true
          return (value ?? '').toString().toLowerCase().includes(term.trim().toLowerCase())
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

  const { stopCount, breakdownCount } = useMemo(
    () => summarizeStops(filteredClips),
    [filteredClips],
  )

  const gameSummaries = useMemo(() => aggregateGames(filteredClips), [filteredClips])
  const gameScopeOptions = useMemo(
    () =>
      gameSummaries.map((game) => {
        const opponent = game.opponent || 'Opponent'
        const detail = getLocationDetailText(game.locationLabel, game.locationTag)
        const tagLabel = getLocationTagLabel(game.locationTag)
        const locationSummary = detail ? `${tagLabel} • ${detail}` : tagLabel
        return {
          value: normalizeSelectionValue(game.id),
          label: `${opponent} • ${locationSummary} (${game.clipCount} clips)`,
        }
      }),
    [gameSummaries],
  )

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleFilterValue = (key: FilterKey, value: string) => {
    const normalized = normalizeSelectionValue(value)
    setFilters((prev) => {
      const current = prev[key] ?? new Set<string>()
      const next = new Set(current)
      if (next.has(normalized)) {
        next.delete(normalized)
      } else if (normalized) {
        next.add(normalized)
      }
      return { ...prev, [key]: next }
    })
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

  const handleSearchChange = (field: keyof SearchFilters, value: string) => {
    setSearchFilters((prev) => ({ ...prev, [field]: value }))
  }

  const clearFilters = () => {
    setSelectedGames(new Set<string>())
    setFilters(createEmptyFilterState())
    setSearchFilters({
      formation: '',
      playName: '',
      playTrigger: '',
      actionTypes: '',
      actionSequence: '',
      breakdownDetail: '',
    })
  }

  const filteredGames = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const filtered = gameSummaries.filter((game) => {
      if (locationFilter !== 'all' && game.locationTag !== locationFilter) {
        return false
      }
      if (!term) return true
      return (
        game.id.toLowerCase().includes(term) ||
        game.opponent.toLowerCase().includes(term) ||
        game.locationLabel.toLowerCase().includes(term)
      )
    })

    // Sort by game number (extract number from ID like "G5_fgcu" -> 5)
    return filtered.sort((a, b) => {
      const numA = parseInt(a.id.replace(/\D/g, '')) || 0
      const numB = parseInt(b.id.replace(/\D/g, '')) || 0
      return numA - numB
    })
  }, [gameSummaries, locationFilter, searchTerm])

  const totalClips = filteredClips.length
  const totalGames = gameSummaries.length
  const stopRateOverall = totalClips ? Math.round((stopCount / totalClips) * 100) : 0
  const breakdownRateOverall = totalClips ? Math.round((breakdownCount / totalClips) * 100) : 0

  const exportToCSV = (clips: Clip[], filename: string) => {
    if (!clips.length) {
      alert('No clips to export')
      return
    }

    // CSV Headers
    const headers = [
      'Game #',
      'Opponent',
      'Location',
      'Quarter',
      'Possession #',
      'Situation',
      'Offensive Formation',
      'Play Name',
      'Covered in Scout?',
      'Play Trigger',
      'Action Type(s)',
      'Action Sequence',
      'Defensive Coverage',
      'Ball Screen Coverage',
      'Off-Ball Screen Coverage',
      'Help/Rotation',
      'Defensive Disruption',
      'Defensive Breakdown',
      'Play Result',
      'Paint Touches',
      'Shooter Designation',
      'Shot Location',
      'Shot Contest',
      'Rebound Outcome',
      'Points',
      'Notes',
      'Start Time',
      'End Time',
    ]

    // Build CSV rows
    const rows = clips.map((clip) => [
      clip.gameId || '',
      clip.opponent || '',
      clip.location || clip.gameLocation || '',
      clip.quarter || '',
      clip.possession || '',
      clip.situation || '',
      clip.formation || '',
      clip.playName || '',
      clip.scoutCoverage || '',
      clip.playTrigger || '',
      clip.actionTypes || '',
      clip.actionSequence || '',
      clip.coverage || '',
      clip.ballScreen || '',
      clip.offBallScreen || '',
      clip.helpRotation || '',
      clip.disruption || '',
      clip.breakdown || '',
      clip.playResult || '',
      clip.paintTouches || '',
      clip.shooterDesignation || '',
      clip.shotLocation || '',
      clip.shotContest || '',
      clip.rebound || '',
      clip.points ?? '',
      clip.notes || '',
      clip.startTime || '',
      clip.endTime || '',
    ])

    // Escape CSV values
    const escapeCSV = (value: string | number) => {
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(',')),
    ].join('\n')

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportSelected = () => {
    if (selectedForExport.size === 0) {
      alert('Please select at least one game to export')
      return
    }

    const selectedClips = filteredClips.filter((clip) => selectedForExport.has(clip.gameId || ''))
    const gameIds = Array.from(selectedForExport).join('_')
    exportToCSV(selectedClips, `OU_Defense_Selected_${new Date().toISOString().split('T')[0]}.csv`)

    // Exit export mode and clear selections
    setExportMode(false)
    setSelectedForExport(new Set())
  }

  const handleCancelExport = () => {
    setExportMode(false)
    setSelectedForExport(new Set())
  }

  const handleToggleExportGame = (gameId: string) => {
    setSelectedForExport((prev) => {
      const next = new Set(prev)
      if (next.has(gameId)) {
        next.delete(gameId)
      } else {
        next.add(gameId)
      }
      return next
    })
  }

  const handleToggleSelectAll = () => {
    if (selectedForExport.size === filteredGames.length) {
      setSelectedForExport(new Set())
    } else {
      setSelectedForExport(new Set(filteredGames.map((g) => g.id)))
    }
  }

  const handleExportGame = (gameId: string) => {
    const gameClips = filteredClips.filter((clip) => clip.gameId === gameId)
    const game = gameSummaries.find((g) => g.id === gameId)
    const opponent = game?.opponent || 'Unknown'
    exportToCSV(gameClips, `OU_Defense_${gameId}_${opponent}_${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="react-dashboard">
      <div className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">2025-26 season</p>
          <h2>Defensive Clip Dashboard</h2>
        </div>
        <div className="dashboard-status">
          <span className="status-dot" />
          {loading ? 'Loading clips…' : error ? 'Offline' : 'Live'}
          <button type="button" className="filter-btn" onClick={() => setFilterPanelOpen(true)}>
            Clip Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
          {!exportMode ? (
            <button
              type="button"
              onClick={() => setExportMode(true)}
              className="filter-btn ml-2"
              title="Enter export mode to select games"
            >
              Export
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="filter-btn ml-2"
                title={selectedForExport.size === filteredGames.length ? 'Deselect all games' : 'Select all games'}
              >
                {selectedForExport.size === filteredGames.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={handleExportSelected}
                className="filter-btn ml-2"
                title="Export selected games to CSV"
                disabled={selectedForExport.size === 0}
                style={{ opacity: selectedForExport.size === 0 ? 0.5 : 1 }}
              >
                Export Selected ({selectedForExport.size})
              </button>
              <button
                type="button"
                onClick={handleCancelExport}
                className="filter-btn ml-2"
                title="Cancel export mode"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-section">
          <span className="filter-label">View</span>
          <div className="radio-group">
            <button
              type="button"
              className={`radio-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={`radio-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table
            </button>
            <button
              type="button"
              className={`radio-btn ${viewMode === 'shotchart' ? 'active' : ''}`}
              onClick={() => setViewMode('shotchart')}
            >
              Shot Chart
            </button>
          </div>
        </div>

        <div className="filter-section">
          <span className="filter-label">Location</span>
          <div className="radio-group">
            {(['all', 'home', 'away', 'neutral'] as LocationFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`radio-btn ${locationFilter === value ? 'active' : ''}`}
                onClick={() => setLocationFilter(value)}
              >
                {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-search-box">
          <div className="ai-search-input-wrapper">
            <input
              type="search"
              placeholder="AI Search: 'Horns actions with drop coverage that led to made 3s'"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchTerm.trim()) {
                  // Trigger AI search
                  handleSemanticSearch()
                }
              }}
              className="ai-search-input"
            />
            <button
              type="button"
              onClick={handleSemanticSearch}
              disabled={!searchTerm.trim() || semanticSearching}
              className="ai-search-button"
            >
              {semanticSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {semanticSearchEnabled && (
            <span className="ai-search-badge">
              <span className="ai-badge-dot" />
              AI Results Active
            </span>
          )}
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat">
          <span className="stat-label">Total Clips</span>
          <span className="stat-value">{totalClips}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Games Logged</span>
          <span className="stat-value">{totalGames}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Stop Rate</span>
          <span className="stat-value">{formatPercent(stopRateOverall)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Breakdown Rate</span>
          <span className="stat-value">{formatPercent(breakdownRateOverall)}</span>
        </div>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      {loading ? (
        <div className="dashboard-loading">Loading games…</div>
      ) : filteredGames.length === 0 ? (
        <div className="dashboard-empty">No games match the current filters.</div>
      ) : viewMode === 'shotchart' ? (
        <section className="shot-chart-view">
          <div className="shot-chart-container">
            <img
              src="/shot-chart.png"
              alt="Basketball Court"
              className="shot-chart-court"
            />
            <svg className="shot-chart-overlay" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {filteredClips
                .filter((clip) => clip.shotX != null && clip.shotY != null)
                .map((clip, index) => {
                  const cx = Math.max(0, Math.min(100, clip.shotX ?? 0))
                  const cy = Math.max(0, Math.min(100, clip.shotY ?? 0))
                  const playerDesignation = (clip.playerDesignation || '').toLowerCase()
                  const shotResult = (clip.shotResult || '').toLowerCase()
                  const isShotMake = shotResult === 'make' || shotResult === 'made fg' || shotResult === 'made ft'
                  const isShotMiss = shotResult === 'miss' || shotResult === 'missed fg' || shotResult === 'missed ft'
                  const designationKey = playerDesignation.startsWith('blue')
                    ? 'primary'
                    : playerDesignation.startsWith('green')
                      ? 'shooter'
                      : playerDesignation.startsWith('black')
                        ? 'role'
                        : playerDesignation

                  const playerColor =
                    designationKey === 'primary'
                      ? '#3b82f6'
                      : designationKey === 'shooter'
                        ? '#22c55e'
                        : designationKey === 'role'
                          ? '#1f2937'
                          : '#6b7280'

                  const resultColor = isShotMake ? '#22c55e' : isShotMiss ? '#ef4444' : '#6b7280'

                  return (
                    <g
                      key={`shot-${clip.id}-${index}`}
                      className="shot-marker-group"
                      onClick={() => {
                        if (clip.gameId) {
                          onSelectGame?.(clip.gameId)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <title>
                        {clip.opponent || 'Unknown'} • Q{clip.quarter || '?'} • {clip.playName || 'No play'} • {clip.shotContest || 'No contest'}{clip.breakdown ? ' • BREAKDOWN' : ' • No breakdown'}
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
            <div className="legend-section">
              <h4>Total Shots</h4>
              <div className="legend-items">
                <span className="legend-item" style={{ fontSize: '1.2rem', fontWeight: 600 }}>
                  {filteredClips.filter((clip) => clip.shotX != null && clip.shotY != null).length}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : viewMode === 'grid' ? (
        <div className="games-grid">
          {filteredGames.map((game) => {
            const locationDetail = getLocationDetailText(game.locationLabel, game.locationTag)
            return (
              <article
              key={game.id}
              className="game-card relative"
              onClick={() => onSelectGame?.(game.id)}
              tabIndex={0}
              role="button"
            >
              {exportMode && (
                <input
                  type="checkbox"
                  checked={selectedForExport.has(game.id)}
                  onChange={(e) => {
                    e.stopPropagation()
                    handleToggleExportGame(game.id)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-3 right-3 w-5 h-5 cursor-pointer z-10"
                  title="Select for export"
                />
              )}
              <header className="game-header">
                <p className="game-number">Game {game.id}</p>
                <div className="game-opponent">
                  <span className="opponent-name">vs {game.opponent}</span>
                  <div className="location-meta">
                    <span className={`location-badge location-${game.locationTag ?? 'unknown'}`}>
                      {getLocationTagLabel(game.locationTag)}
                    </span>
                    {locationDetail && <span className="location-detail">{locationDetail}</span>}
                  </div>
                </div>
                <div className={`game-score ${game.resultLabel === 'W' ? 'score-win' : 'score-loss'}`}>
                  {game.score} {game.resultLabel}
                </div>
              </header>
              <div className="game-stats">
                <div className="game-stat">
                  <div className="game-stat-value">{game.clipCount}</div>
                  <div className="game-stat-label">Clips</div>
                </div>
                <div className="game-stat">
                  <div className="game-stat-value">{formatPercent(game.stopRate)}</div>
                  <div className="game-stat-label">Stop Rate</div>
                </div>
                <div className="game-stat">
                  <div className="game-stat-value">{formatPercent(game.breakdownRate)}</div>
                  <div className="game-stat-label">Breakdown</div>
                </div>
              </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="games-table-wrapper">
          <table className="games-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Opponent</th>
                <th>Location</th>
                <th>Clips</th>
                <th>Stop Rate</th>
                <th>Breakdown</th>
              </tr>
            </thead>
            <tbody>
              {filteredGames.map((game) => {
                const locationDetail = getLocationDetailText(game.locationLabel, game.locationTag)
                return (
                  <tr key={game.id} onClick={() => onSelectGame?.(game.id)}>
                  <td>{game.id}</td>
                  <td className="table-opponent">{game.opponent}</td>
                  <td>
                    <div className="table-location">
                      <span className={`location-badge location-${game.locationTag ?? 'unknown'}`}>
                        {getLocationTagLabel(game.locationTag)}
                      </span>
                      {locationDetail && <span className="location-detail">{locationDetail}</span>}
                    </div>
                  </td>
                  <td className="table-stat">{game.clipCount}</td>
                  <td className="table-stat">{formatPercent(game.stopRate)}</td>
                  <td className="table-stat">{formatPercent(game.breakdownRate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={`filter-overlay ${filterPanelOpen ? 'active' : ''}`}
        onClick={() => setFilterPanelOpen(false)}
      />
      <aside className={`filter-panel ${filterPanelOpen ? 'open' : ''}`}>
        <div className="filter-panel-header">
          <div>
            <h3 className="filter-panel-title">Clip Filters</h3>
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

          {DASHBOARD_FILTER_GROUPS.map((group) => (
            <div
              key={group.key}
              className={`filter-group ${collapsedSections[group.key] ? 'collapsed' : ''}`}
            >
              <p className="filter-group-title" onClick={() => toggleSection(group.key)}>
                <span>
                  {group.icon} {group.label}
                </span>
                <span>{collapsedSections[group.key] ? '+' : '−'}</span>
              </p>
              <div className="checkbox-group">
                {group.options.map((option) => (
                  <label key={option.value} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={filters[group.key].has(normalizeSelectionValue(option.value))}
                      onChange={() => toggleFilterValue(group.key, option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
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

export default ReactDashboard
