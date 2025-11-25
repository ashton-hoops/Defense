import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createCloudAdapter, createLocalAdapter } from '../lib/data'
import type { DataMode } from '../lib/data'
import type { Clip } from '../lib/types'
import { findCachedClip, normalizeClip, resolveLocationLabel, type ClipSummary } from '../lib/data/transformers'
import './ReactClipDetail.css'

type ReactClipDetailProps = {
  dataMode: DataMode
  onBack?: () => void
  onClipUpdated?: (clip: Clip) => void
  summary?: ClipSummary
}

const connectionLabel = {
  checking: 'Checking connection…',
  online: 'API connected',
  offline: 'Offline',
} as const

const POSTER_CACHE_PREFIX = 'clipPoster:'

const getSessionStorage = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const ReactClipDetail = ({ dataMode, onBack, summary }: ReactClipDetailProps) => {
  const { clipId } = useParams<{ clipId: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [clip, setClip] = useState<Clip | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [posterImage, setPosterImage] = useState<string | null>(null)
  const adapterFactory = useMemo(() => (dataMode === 'cloud' ? createCloudAdapter : createLocalAdapter), [dataMode])

  const handleEditClip = () => {
    if (activeClip) {
      navigate('/react-tagger-native', { state: { editClip: activeClip } })
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!clipId) {
        setClip(null)
        setLoading(false)
        setError('Select a clip to view detail.')
        return
      }
      setLoading(true)
      setError(null)
      setStatus('checking')
      const adapter = adapterFactory()
      const healthy = await adapter.health()
      if (!cancelled) setStatus(healthy ? 'online' : 'offline')
      try {
        const data = await adapter.getClip(clipId)
        if (cancelled) return
        if (data) {
          setClip(data) // Already normalized by adapter
          setLoading(false)
          return
        }
        setError('Clip not found in API; checking cache…')
      } catch (err) {
        if (!cancelled) {
          console.warn('React clip detail failed', err)
          setError(
            adapter.mode === 'cloud'
              ? 'Cloud adapter not reachable; checking cache.'
              : 'Local API offline; checking cache.',
          )
        }
      }

      if (cancelled) return
      const cached = findCachedClip(clipId)
      if (cached) {
        setClip(cached) // Already normalized by findCachedClip
        setLoading(false)
        return
      }

      setClip(null)
      setLoading(false)
      setError((prev) => prev ?? 'No clip data available yet. Save from the tagger first.')
    }
    load()
    return () => {
      cancelled = true
    }
  }, [adapterFactory, clipId])

  const activeClip = clip ?? (summary ? (normalizeClip(summary) as Clip) : null)
  const locationLabel = activeClip ? resolveLocationLabel(activeClip) : '—'
  const points = activeClip?.points ?? 0
  const breakdown = activeClip?.breakdown
  const stop = breakdown ? !breakdown.toLowerCase().startsWith('y') : true
  const actionsProvided = activeClip?.actions !== undefined
  const clipActions = activeClip?.actions ?? []
  const activeVideoUrl = activeClip?.videoUrl ?? null
  const posterCacheKey = activeVideoUrl ? `${POSTER_CACHE_PREFIX}${activeVideoUrl}` : null

  const actionTypesFromActions = (() => {
    if (!clipActions.length) return null
    const values = clipActions
      .map((action) => (typeof action.type === 'string' ? action.type.trim() : ''))
      .filter((value): value is string => Boolean(value))
    return values.length ? values.join(', ') : null
  })()

  const actionTypesValue = actionTypesFromActions ?? activeClip?.actionTypes ?? null
  const actionSequenceValue = actionTypesFromActions ?? activeClip?.actionSequence ?? null
  const actionCountValue = actionsProvided ? clipActions.length : activeClip?.actionCount ?? activeClip?.actionDensity

  useEffect(() => {
    if (!activeVideoUrl) {
      setPosterImage(null)
      return
    }
    if (posterCacheKey) {
      const storage = getSessionStorage()
      if (storage) {
        try {
          const cached = storage.getItem(posterCacheKey)
          if (cached) {
            setPosterImage(cached)
            return
          }
        } catch (err) {
          console.warn('Unable to read poster cache', err)
        }
      }
    }
    setPosterImage(null)
  }, [activeVideoUrl, posterCacheKey])

  const capturePosterFrame = useCallback(() => {
    if (posterImage) return
    const video = videoRef.current
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      setPosterImage(dataUrl)
      if (posterCacheKey) {
        const storage = getSessionStorage()
        if (storage) {
          try {
            storage.setItem(posterCacheKey, dataUrl)
          } catch (err) {
            console.warn('Unable to cache poster image', err)
          }
        }
      }
    } catch (err) {
      console.warn('Failed to capture poster frame', err)
    }
  }, [posterCacheKey, posterImage])

  const handleVideoLoaded = useCallback(() => {
    capturePosterFrame()
  }, [capturePosterFrame])

  const formatShotLocation = () => {
    if (activeClip?.shotX == null || activeClip?.shotY == null) return '—'
    return `${activeClip.shotX.toFixed(1)}, ${activeClip.shotY.toFixed(1)}`
  }

  const accordionSections = [
    {
      icon: '📋',
      title: 'Context & Identifiers',
      rows: [
        { label: 'Game #', value: activeClip?.gameId ?? activeClip?.gameNumber },
        { label: 'Location', value: activeClip?.location ?? activeClip?.locationDisplay ?? activeClip?.gameLocation },
        { label: 'Opponent', value: activeClip?.opponent },
        { label: 'Quarter', value: activeClip?.quarter },
        { label: 'Possession #', value: activeClip?.possession },
        { label: 'Situation', value: activeClip?.situation },
      ],
    },
    {
      icon: '🎯',
      title: 'Play & Actions',
      rows: [
        { label: 'Offensive Formation', value: activeClip?.formation },
        { label: 'Play Name', value: activeClip?.playName },
        { label: 'Covered in Scout?', value: activeClip?.scoutCoverage },
        { label: 'Play Trigger', value: activeClip?.playTrigger },
        { label: 'Action Type(s)', value: actionTypesValue },
        { label: 'Action Sequence', value: actionSequenceValue },
      ],
    },
    {
      icon: '🛡️',
      title: 'Defensive Coverage',
      rows: [
        { label: 'Defensive Coverage', value: activeClip?.coverage },
        { label: 'Defensive Disruption', value: activeClip?.disruption },
        { label: 'Defensive Breakdown', value: activeClip?.breakdown },
      ],
    },
    {
      icon: '🏀',
      title: 'Shot Data',
      rows: [
        { label: 'Play Result', value: activeClip?.playResult ?? activeClip?.possessionResult },
        { label: 'Paint Touches', value: activeClip?.paintTouches },
        { label: 'Shooter Designation', value: activeClip?.shooterDesignation },
        { label: 'Shot Location', value: activeClip?.shotLocation },
        { label: 'Shot Contest', value: activeClip?.shotContest },
        { label: 'Rebound Outcome', value: activeClip?.rebound },
        { label: 'Points', value: activeClip?.points },
      ],
    },
  ]

  return (
    <div className="clip-detail">
      <header className="clip-detail__header">
        <div>
          <p className="clip-detail__eyebrow">React clip detail</p>
          <h2>
            Game {activeClip?.gameId ?? '—'} vs {activeClip?.opponent ?? summary?.opponent ?? '—'}
          </h2>
          <p className="clip-detail__meta">
            {locationLabel} • {activeClip?.playResult ?? summary?.playResult ?? 'Play result pending'}
          </p>
        </div>
        <div className="clip-detail__actions">
          <span className={`status-pill status-pill--${status}`}>{connectionLabel[status]}</span>
          <button
            type="button"
            onClick={handleEditClip}
            className="clip-detail__back"
            style={{ marginRight: '8px', backgroundColor: '#841617', color: 'white' }}
          >
            Edit in Tagger
          </button>
          <button type="button" onClick={onBack} className="clip-detail__back">
            ← Back to clips
          </button>
        </div>
      </header>

      {error && <div className="clip-detail__error">{error}</div>}

      <div className="clip-detail__content">
        <div className="clip-detail__main-column">
          <section className="video-section">
            {activeClip?.videoUrl ? (
              <video
                ref={videoRef}
                controls
                src={activeClip.videoUrl}
                className="clip-video"
                preload="auto"
                playsInline
                crossOrigin="anonymous"
                poster={posterImage ?? undefined}
                onLoadedMetadata={handleVideoLoaded}
                onLoadedData={handleVideoLoaded}
              />
            ) : (
              <div className="video-placeholder">No video reference found for this clip.</div>
            )}
          </section>

          {/* Analytics & Insights */}
          <section className="comprehensive-analytics">
            <div className="analytics-header">
              <span className="analytics-icon">📊</span>
              <span>Analytics & Insights</span>
            </div>
            <div className="stats-summary stats-summary--two-rows">
              <div className="stat-card">
                <p className="stat-value">{activeClip?.points ?? 0}</p>
                <p className="stat-label">Points Allowed</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.playResult ?? activeClip?.possessionResult ?? '—'}</p>
                <p className="stat-label">Play Result</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.shooterDesignation ?? '—'}</p>
                <p className="stat-label">Shooter Designation</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.shotQuality ?? '—'}</p>
                <p className="stat-label">Shot Quality (0–100)</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.shotContest ?? '—'}</p>
                <p className="stat-label">Contest Level</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.defensiveScore ?? '—'}</p>
                <p className="stat-label">Defensive Score (0–100)</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{activeClip?.breakdown ?? 'None'}</p>
                <p className="stat-label">Breakdown Type</p>
              </div>
              <div className="stat-card">
                <p className="stat-value">{actionCountValue ?? '—'}</p>
                <p className="stat-label">Action Count / Density</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="analytics-sidebar">
          {/* Context & Identifiers */}
          <section className="sidebar-section">
            <div className="analytics-header">
              <span className="analytics-icon">📋</span>
              <span>Context & Identifiers</span>
            </div>
            <div className="detail-grid detail-grid--two-col">
              {accordionSections[0].rows.map((row) => (
                <div key={row.label} className="detail-card">
                  <p className="detail-value">{row.value ?? '—'}</p>
                  <p className="detail-label">{row.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Play & Actions */}
          <section className="sidebar-section">
            <div className="analytics-header">
              <span className="analytics-icon">🎯</span>
              <span>Play & Actions</span>
            </div>
            <div className="detail-grid">
              {accordionSections[1].rows.map((row) => (
                <div key={row.label} className="detail-card">
                  <p className="detail-value">{row.value ?? '—'}</p>
                  <p className="detail-label">{row.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Actions Detail */}
          {activeClip?.actions && activeClip.actions.length > 0 && (
            <section className="sidebar-section">
              <div className="analytics-header">
                <span className="analytics-icon">⚡</span>
                <span>Actions ({activeClip.actions.length})</span>
              </div>
              {activeClip.actions.map((action, index) => (
                <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < activeClip.actions!.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                  <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>
                    Action {index + 1}
                  </div>
                  <div className="detail-grid">
                    {action.phase && (
                      <div className="detail-card">
                        <p className="detail-value">{action.phase}</p>
                        <p className="detail-label">Phase</p>
                      </div>
                    )}
                    {action.type && (
                      <div className="detail-card">
                        <p className="detail-value">{action.type}</p>
                        <p className="detail-label">Type</p>
                      </div>
                    )}
                    {action.coverage && (
                      <div className="detail-card">
                        <p className="detail-value">{action.coverage}</p>
                        <p className="detail-label">Coverage</p>
                      </div>
                    )}
                    {action.help && (
                      <div className="detail-card">
                        <p className="detail-value">{action.help}</p>
                        <p className="detail-label">Help</p>
                      </div>
                    )}
                    {action.breakdown && (
                      <div className="detail-card">
                        <p className="detail-value">{action.breakdown}</p>
                        <p className="detail-label">Breakdown</p>
                      </div>
                    )}
                    {action.communication && (
                      <div className="detail-card">
                        <p className="detail-value">{action.communication}</p>
                        <p className="detail-label">Communication</p>
                      </div>
                    )}
                    {action.outcome && (
                      <div className="detail-card">
                        <p className="detail-value">{action.outcome}</p>
                        <p className="detail-label">Outcome</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Defensive Coverage */}
          <section className="sidebar-section">
            <div className="analytics-header">
              <span className="analytics-icon">🛡️</span>
              <span>Defensive Coverage</span>
            </div>
            <div className="detail-grid">
              {accordionSections[2].rows.map((row) => (
                <div key={row.label} className="detail-card">
                  <p className="detail-value">{row.value ?? '—'}</p>
                  <p className="detail-label">{row.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Shot Data */}
          <section className="sidebar-section">
            <div className="analytics-header">
              <span className="analytics-icon">🏀</span>
              <span>Shot Data</span>
            </div>
            <div className="detail-grid">
              {accordionSections[3].rows.map((row) => (
                <div key={row.label} className="detail-card">
                  <p className="detail-value">{row.value ?? '—'}</p>
                  <p className="detail-label">{row.label}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default ReactClipDetail
