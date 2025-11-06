import { useEffect, useMemo, useState } from 'react'
import { HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ReactClipDetail from './components/ReactClipDetail'
import ReactClipsPanel from './components/ReactClipsPanel'
import ReactDashboard from './components/ReactDashboard'
import ReactGameDetail from './components/ReactGameDetail'
import ReactTaggerNative from './components/ReactTaggerNative'
import type { DataMode } from './lib/data'
import { toClipSummary, type ClipSummary } from './lib/data/transformers'
import type { Clip } from './lib/types'

// Re-defined TabKey to be more specific for routing
export type TabKey =
  | 'tagger'
  | 'react-clips'
  | 'react-tagger-native'
  | 'react-detail'
  | 'react-dashboard'
  | 'react-game'
  | 'dashboard'
  | 'detail'
  | 'extractor'

interface TabConfig {
  key: TabKey
  label: string
  path: string // Changed from 'hash' to 'path' for react-router
  description: string
  showInNav?: boolean
}

const TABS: TabConfig[] = [
  {
    key: 'react-tagger-native',
    label: 'Clip Tagger (React)',
    path: '/react-tagger-native',
    description: 'Native React clip tagging interface.',
    showInNav: true,
  },
  {
    key: 'react-clips',
    label: 'Clips (React)',
    path: '/react-clips',
    description: 'React-native clip list powered by the data adapters.',
    showInNav: true,
  },
  {
    key: 'react-dashboard',
    label: 'Dashboard (React)',
    path: '/react-dashboard',
    description: 'React-native defensive analytics dashboard.',
    showInNav: true,
  },
  {
    key: 'react-game',
    label: 'Game Detail (React)',
    path: '/react-game/:gameId',
    description: 'React-native per-game defensive summary.',
    showInNav: false,
  },
  {
    key: 'react-detail',
    label: 'Clip Detail (React)',
    path: '/react-detail/:clipId',
    description: 'React-native clip detail viewer.',
    showInNav: false,
  },
]

const NAV_TABS = TABS.filter((tab) => tab.showInNav !== false)

const LEGACY_IFRAME_MAP: Record<string, string> = {
  '/tagger': '/legacy/clip_tagger_copy.html',
  '/dashboard': '/legacy/clip_dashboard_refined.html',
  '/detail': '/legacy/clip_detail2.html',
  '/extractor': '/legacy/clip_extractor_placeholder.html',
}

const deriveEnvName = () => {
  const explicit = import.meta.env.VITE_ENV_NAME as string | undefined
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim()
  }
  const mode = import.meta.env.MODE
  return mode ? mode.toString() : 'development'
}

// A simple component to render the legacy iframes
const IframePage = ({ src }: { src: string }) => {
  const tab = TABS.find((t) => LEGACY_IFRAME_MAP[t.path] === src)
  return (
    <iframe
      key={src}
      title={tab?.description ?? 'Legacy Page'}
      src={src}
      className="absolute inset-0 h-full w-full border-0"
      allowFullScreen
    />
  )
}

const Layout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [dataMode, setDataMode] = useState<DataMode>('local')
  const [clipRefreshKey, setClipRefreshKey] = useState(0)
  const [selectedClipSummary, setSelectedClipSummary] = useState<ClipSummary | null>(null)

  const envName = useMemo(() => deriveEnvName(), [])

  const activeTabConfig = useMemo(() => {
    // Find the best match for the current path
    // This handles nested routes like /react-game/123 matching /react-game/:gameId
    const currentPath = location.pathname

    // Try exact match first
    const exactMatch = TABS.find((tab) => tab.path === currentPath)
    if (exactMatch) return exactMatch

    // For parameterized routes like /react-game/:gameId, match the base path
    const baseMatch = TABS.find((tab) => {
      const basePath = tab.path.split('/:')[0] // Get path before params
      return currentPath.startsWith(basePath + '/')
    })
    if (baseMatch) return baseMatch

    return TABS[0]
  }, [location.pathname])

  useEffect(() => {
    document.title = `OU WOMEN'S BASKETBALL — ${activeTabConfig.label}`
  }, [activeTabConfig.label])

  // Global video keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      const video = document.querySelector('video') as HTMLVideoElement | null
      if (!video) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          if (video.paused) video.play()
          else video.pause()
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.currentTime + 10, video.duration)
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(video.currentTime - 10, 0)
          break
      }
    }
    document.addEventListener('keydown', handleGlobalKeydown)
    return () => document.removeEventListener('keydown', handleGlobalKeydown)
  }, [])

  const handleOpenClip = (clipId: string, summary: ClipSummary) => {
    setSelectedClipSummary(summary)
    navigate(`/react-detail/${encodeURIComponent(clipId)}`)
  }

  const navigateBackToDashboard = () => {
    navigate('/react-dashboard')
  }

  const navigateToGameDetail = (gameId: string) => {
    navigate(`/react-game/${encodeURIComponent(gameId)}`)
  }

  const navigateBackToClipGame = () => {
    if (selectedClipSummary?.game) {
      navigateToGameDetail(selectedClipSummary.game)
    } else {
      navigateBackToDashboard()
    }
  }

  const toggleDataMode = () => {
    setDataMode((mode) => (mode === 'local' ? 'cloud' : 'local'))
  }

  const handleClipUpdated = (updatedClip: Clip) => {
    setClipRefreshKey((value) => value + 1)
    setSelectedClipSummary(toClipSummary(updatedClip))
  }

  const handleSelectGame = (gameId: string) => {
    if (!gameId) return
    navigate(`/react-game/${encodeURIComponent(gameId)}`)
  }

  const navActiveKey: TabKey | undefined = useMemo(() => {
    const currentPath = location.pathname
    if (currentPath.startsWith('/react-detail')) return 'react-clips'
    if (currentPath.startsWith('/react-game')) return 'react-dashboard'
    const tab = NAV_TABS.find((t) => t.path === currentPath)
    return tab?.key
  }, [location.pathname])

  return (
    <div className="flex min-h-screen flex-col bg-[#121212] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-black via-[#121212] to-[#1b1b1b]/90">
        <div className="flex w-full flex-col gap-6 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] uppercase tracking-[0.5em] text-white/45">
              OU Women&apos;s Basketball
            </span>
            <span className="text-xl font-semibold uppercase tracking-[0.18em] text-white">
              Defensive Analytics
            </span>
            <span className="text-xs uppercase tracking-[0.4em] text-white/55">
              2025–2026 Season
            </span>
          </div>

          <nav className="flex flex-wrap items-center gap-2">
            {NAV_TABS.map((tab) => {
              const isActive = tab.key === navActiveKey
              const baseClasses =
                'rounded-full px-4 py-2 text-sm font-medium transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40'
              const activeClasses = 'bg-[#841617] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)]'
              const inactiveClasses =
                'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'

              return (
                <Link
                  to={tab.path}
                  key={tab.key}
                  aria-label={`Open ${tab.label}`}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col bg-[#0a0a0a] min-h-0 overflow-hidden">
        <div className="flex flex-1 flex-col px-6 pb-0 min-h-0 overflow-hidden">
          <div className="relative flex-1 min-h-0">
            <Outlet
              context={{
                dataMode,
                clipRefreshKey,
                selectedClipSummary,
                handleOpenClip,
                navigateBackToDashboard,
                navigateBackToClipGame,
                handleClipUpdated,
                handleSelectGame,
              }}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-[#101010] text-[0.75rem] text-white/70">
        <div className="flex w-full flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.28em] text-white/45">
              Active tab
            </span>
            <span className="text-sm font-medium text-white">
              {activeTabConfig.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-white">
              <span className="relative flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/60" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400" />
              </span>
              Local hub running
            </span>

            <button
              type="button"
              onClick={toggleDataMode}
              className="flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white transition hover:bg-white/16"
              title="Toggle between local SQLite API and future cloud stack"
            >
              <span className="rounded-sm bg-white/20 px-1.5 py-0.5 text-[0.65rem] font-medium">
                Data
              </span>
              {dataMode === 'local' ? 'Local' : 'Cloud'}
            </button>

            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
              {envName}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Wrapper components that use hooks properly
type OutletContextType = {
  dataMode: DataMode
  clipRefreshKey: number
  selectedClipSummary: ClipSummary | null
  handleOpenClip: (clipId: string, summary: ClipSummary) => void
  navigateBackToDashboard: () => void
  navigateBackToClipGame: () => void
  handleClipUpdated: (clip: Clip) => void
  handleSelectGame: (gameId: string) => void
}

const ReactClipsPanelWrapper = () => {
  const context = useOutletContext<OutletContextType>()
  return (
    <ReactClipsPanel
      dataMode={context.dataMode}
      onOpenClip={context.handleOpenClip}
      refreshKey={context.clipRefreshKey}
    />
  )
}

const ReactDashboardWrapper = () => {
  const context = useOutletContext<OutletContextType>()
  return <ReactDashboard dataMode={context.dataMode} onSelectGame={context.handleSelectGame} />
}

const ReactGameDetailWrapper = () => {
  const context = useOutletContext<OutletContextType>()
  const { gameId } = useParams<{ gameId: string }>()
  return (
    <ReactGameDetail
      dataMode={context.dataMode}
      gameId={gameId}
      onBack={context.navigateBackToDashboard}
      onOpenClip={(clipId, clip) => context.handleOpenClip(clipId, toClipSummary(clip))}
    />
  )
}

const ReactClipDetailWrapper = () => {
  const context = useOutletContext<OutletContextType>()
  return (
    <ReactClipDetail
      dataMode={context.dataMode}
      onBack={context.navigateBackToClipGame}
      onClipUpdated={context.handleClipUpdated}
      summary={context.selectedClipSummary ?? undefined}
    />
  )
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Redirect root to the default page */}
          <Route index element={<Navigate to="/react-tagger-native" replace />} />

          {/* React Pages */}
          <Route path="/react-clips" element={<ReactClipsPanelWrapper />} />
          <Route path="/react-dashboard" element={<ReactDashboardWrapper />} />
          <Route path="/react-game/:gameId" element={<ReactGameDetailWrapper />} />
          <Route path="/react-detail/:clipId" element={<ReactClipDetailWrapper />} />
          <Route path="/react-tagger-native" element={<ReactTaggerNative />} />

          {/* Fallback for any other route */}
          <Route path="*" element={<Navigate to="/react-tagger-native" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App