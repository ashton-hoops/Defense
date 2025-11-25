import { useEffect, useMemo, useState } from 'react'
import { HashRouter, Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import ReactClipDetail from './components/ReactClipDetail'
import ReactClipsPanel from './components/ReactClipsPanel'
import ReactDashboard from './components/ReactDashboard'
import ReactGameDetail from './components/ReactGameDetail'
import ReactTaggerNative from './components/ReactTaggerNative'
import Login from './components/Login'
import PublishPanel from './components/PublishPanel'
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
  | 'publish'

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
    key: 'publish',
    label: 'Publish to Cloud',
    path: '/publish',
    description: 'Publish local games to cloud for coaches.',
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
  // Default to 'cloud' in production, 'local' in development
  const defaultMode: DataMode = import.meta.env.DEV ? 'local' : 'cloud'
  const [dataMode, setDataMode] = useState<DataMode>(defaultMode)
  const [clipRefreshKey, setClipRefreshKey] = useState(0)
  const [selectedClipSummary, setSelectedClipSummary] = useState<ClipSummary | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')

  const envName = useMemo(() => deriveEnvName(), [])

  // Check authentication on mount and when switching to cloud mode
  useEffect(() => {
    if (dataMode === 'cloud') {
      const token = localStorage.getItem('auth_token')
      const storedUsername = localStorage.getItem('username')
      const storedRole = localStorage.getItem('role')

      if (token && storedUsername && storedRole) {
        setIsAuthenticated(true)
        setUsername(storedUsername)
        setRole(storedRole)
      } else {
        setIsAuthenticated(false)
      }
    }
  }, [dataMode])

  // Listen for clip saved events from the Tagger
  useEffect(() => {
    const handleClipSaved = () => {
      setClipRefreshKey((value) => value + 1)
    }
    window.addEventListener('clip-saved', handleClipSaved)
    return () => {
      window.removeEventListener('clip-saved', handleClipSaved)
    }
  }, [])

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
    const interestedKeys = new Set([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
    const SPEED_STEPS = [0.5, 1, 2]

    const handleMediaKey = (e: KeyboardEvent) => {
      if (!interestedKeys.has(e.key)) return

      const video = document.querySelector('video') as HTMLVideoElement | null
      if (!video) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return

      e.preventDefault()
      e.stopImmediatePropagation()

      if (e.type === 'keydown' && !e.repeat) {
        const key = e.key

        const findNearestSpeedIndex = (rate: number) => {
          let idx = SPEED_STEPS.findIndex((step) => Math.abs(step - rate) < 0.01)
          if (idx === -1) {
            let closest = 0
            let minDiff = Infinity
            SPEED_STEPS.forEach((step, index) => {
              const diff = Math.abs(step - rate)
              if (diff < minDiff) {
                minDiff = diff
                closest = index
              }
            })
            idx = closest
          }
          return idx
        }

        if (key === ' ') {
          if (video.paused) video.play()
          else video.pause()
        } else if (key === 'ArrowRight') {
          video.currentTime = Math.min(video.currentTime + 5, video.duration)
        } else if (key === 'ArrowLeft') {
          video.currentTime = Math.max(video.currentTime - 5, 0)
        } else if (key === 'ArrowUp') {
          const currentIndex = findNearestSpeedIndex(video.playbackRate)
          const nextIndex = Math.min(currentIndex + 1, SPEED_STEPS.length - 1)
          video.playbackRate = SPEED_STEPS[nextIndex]
        } else if (key === 'ArrowDown') {
          const currentIndex = findNearestSpeedIndex(video.playbackRate)
          const nextIndex = Math.max(currentIndex - 1, 0)
          video.playbackRate = SPEED_STEPS[nextIndex]
        }
      }
    }

    document.addEventListener('keydown', handleMediaKey, true)
    document.addEventListener('keypress', handleMediaKey, true)
    document.addEventListener('keyup', handleMediaKey, true)
    return () => {
      document.removeEventListener('keydown', handleMediaKey, true)
      document.removeEventListener('keypress', handleMediaKey, true)
      document.removeEventListener('keyup', handleMediaKey, true)
    }
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

  const handleLoginSuccess = (token: string, user: string, userRole: string) => {
    setIsAuthenticated(true)
    setUsername(user)
    setRole(userRole)
  }

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    setIsAuthenticated(false)
    setUsername('')
    setRole('')
    // Switch back to local mode on logout
    setDataMode('local')
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
        <div className="flex w-full flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[0.62rem] uppercase tracking-[0.45em] text-white/45">
              OU Women&apos;s Basketball
            </span>
            <span className="text-lg font-semibold uppercase tracking-[0.18em] text-white">
              Defensive Analytics
            </span>
            <span className="text-[0.68rem] uppercase tracking-[0.35em] text-white/55">
              2025–2026 Season
            </span>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <nav className="flex flex-wrap items-center gap-1.5">
              {NAV_TABS.filter(tab => {
                // Hide "Publish to Cloud" tab when in cloud mode
                if (tab.key === 'publish' && dataMode === 'cloud') return false
                return true
              }).map((tab) => {
                const isActive = tab.key === navActiveKey
                const baseClasses =
                  'rounded-full px-3 py-1.5 text-[0.8rem] font-medium transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40'
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

            <div className="flex items-center gap-3">
              {/* Database Mode Toggle - Only show in dev mode */}
              {import.meta.env.DEV && (
                <button
                  onClick={toggleDataMode}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[0.75rem] font-medium transition hover:bg-white/20 flex items-center gap-2"
                  title={`Switch to ${dataMode === 'local' ? 'cloud' : 'local'} mode`}
                >
                  <span className={`w-2 h-2 rounded-full ${dataMode === 'cloud' ? 'bg-green-400' : 'bg-gray-400'}`} />
                  {dataMode === 'local' ? '💻 Local' : '☁️ Cloud'}
                </button>
              )}

              {/* User Info / Logout */}
              {dataMode === 'cloud' && isAuthenticated && (
                <div className="flex items-center gap-2">
                  <span className="text-[0.75rem] text-white/60">
                    {username} ({role})
                  </span>
                  <button
                    onClick={handleLogout}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-[0.75rem] font-medium transition hover:bg-red-500/20 hover:text-red-300"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col bg-[#0a0a0a] min-h-0 overflow-hidden">
        {dataMode === 'cloud' && !isAuthenticated ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : (
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
        )}
      </main>
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
  return <ReactDashboard dataMode={context.dataMode} onSelectGame={context.handleSelectGame} refreshKey={context.clipRefreshKey} />
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
          <Route path="/publish" element={<PublishPanel />} />
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
