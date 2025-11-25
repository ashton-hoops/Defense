import { useEffect, useState } from 'react'
import { createLocalAdapter } from '../lib/data/local-adapter'
import { createCloudAdapter } from '../lib/data/cloud-adapter'
import type { Game, Clip } from '../lib/types'
import './PublishPanel.css'

export default function PublishPanel() {
  const [localGames, setLocalGames] = useState<Game[]>([])
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')

  const localAdapter = createLocalAdapter()
  const cloudAdapter = createCloudAdapter()

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      const games = await localAdapter.listGames()
      setLocalGames(games)
    } catch (err: any) {
      console.error('Failed to load games:', err)
      setError(err.message)
    }
  }

  const syncAllToCloud = async () => {
    setSyncing(true)
    setError(null)
    setSuccess(null)
    setProgress('')

    try {
      // Fetch ALL clips from local database
      setProgress('Loading clips from local database...')
      const response = await localAdapter.listClips()
      const allClips = response.items

      if (allClips.length === 0) {
        throw new Error('No clips found in local database')
      }

      setProgress(`Syncing ${allClips.length} clips to cloud...`)

      // Upload each clip to cloud
      let synced = 0
      for (const clip of allClips) {
        await cloudAdapter.saveClip(clip)
        synced++
        if (synced % 5 === 0 || synced === allClips.length) {
          setProgress(`Synced ${synced} of ${allClips.length} clips...`)
        }
      }

      setSuccess(`✓ Successfully synced ${allClips.length} clips to cloud!`)
      setProgress('')
    } catch (err: any) {
      console.error('Failed to sync:', err)
      setError(err.message || 'Failed to sync to cloud')
      setProgress('')
    } finally {
      setSyncing(false)
    }
  }

  const totalClips = localGames.reduce((sum, game) => sum + game.clipCount, 0)

  return (
    <div className="publish-panel">
      <div className="publish-header">
        <h2>Sync to Cloud</h2>
        <p>Push your entire local database to the cloud. Coaches will see all your latest work.</p>
      </div>

      {error && (
        <div className="publish-alert publish-alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="publish-alert publish-alert-success">
          {success}
        </div>
      )}

      {progress && (
        <div className="publish-alert publish-alert-info">
          {progress}
        </div>
      )}

      <div className="sync-section">
        {localGames.length === 0 ? (
          <div className="empty-state">
            <p>No games found in local database.</p>
            <p>Tag some clips first, then come back here to sync them.</p>
          </div>
        ) : (
          <>
            <div className="local-summary">
              <h3>Local Database</h3>
              <div className="stats">
                <div className="stat">
                  <span className="stat-value">{localGames.length}</span>
                  <span className="stat-label">Games</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{totalClips}</span>
                  <span className="stat-label">Clips</span>
                </div>
              </div>
              <ul className="games-list">
                {localGames.map((game) => (
                  <li key={game.id}>
                    {game.opponent} - {game.clipCount} clips
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={syncAllToCloud}
              disabled={syncing}
              className="sync-button"
            >
              {syncing ? (
                <>
                  <span className="spinner" />
                  Syncing...
                </>
              ) : (
                <>☁️ Sync All to Cloud</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
