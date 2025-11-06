import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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

const ReactClipDetail = ({ dataMode, onBack, summary }: ReactClipDetailProps) => {
  const { clipId } = useParams<{ clipId: string }>()
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [clip, setClip] = useState<Clip | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adapterFactory = useMemo(() => (dataMode === 'cloud' ? createCloudAdapter : createLocalAdapter), [dataMode])

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
          setClip(normalizeClip(data))
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
        setClip(normalizeClip(cached))
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
        { label: 'Action Trigger', value: activeClip?.actionTrigger },
        { label: 'Action Type(s)', value: activeClip?.actionTypes },
        { label: 'Action Sequence', value: activeClip?.actionSequence },
      ],
    },
    {
      icon: '🛡️',
      title: 'Defensive Coverage',
      rows: [
        { label: 'Defensive Coverage', value: activeClip?.coverage },
        { label: 'Ball Screen Coverage', value: activeClip?.ballScreen },
        { label: 'Off-Ball Screen Coverage', value: activeClip?.offBallScreen },
        { label: 'Help/Rotation', value: activeClip?.helpRotation },
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
            onClick={() => {
              console.log('Raw Clip Data:', activeClip)
              alert('Check the browser console (F12) to see the raw clip data')
            }}
            className="clip-detail__back"
            style={{ marginRight: '8px' }}
          >
            🐛 Debug Data
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
              <video controls src={activeClip.videoUrl} className="clip-video" />
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
                <p className="stat-value">{activeClip?.actionCount ?? activeClip?.actionDensity ?? '—'}</p>
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