import { useEffect, useState } from 'react'
import { createLocalAdapter } from '../lib/data/local-adapter'
import { createCloudAdapter } from '../lib/data/cloud-adapter'
import type { Game, Clip } from '../lib/types'
import './PublishPanel.css'

export default function PublishPanel() {
  const [localGames, setLocalGames] = useState<Game[]>([])
  const [publishing, setPublishing] = useState<string | null>(null)
  const [publishedGames, setPublishedGames] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const publishGame = async (gameId: string) => {
    setPublishing(gameId)
    setError(null)
    setSuccess(null)

    try {
      // Fetch all clips for this game from local database
      const response = await localAdapter.listClips({ gameId })
      const clips = response.items

      if (clips.length === 0) {
        throw new Error('No clips found for this game')
      }

      // Upload each clip to cloud
      for (const clip of clips) {
        await cloudAdapter.saveClip(clip)
      }

      setPublishedGames(prev => new Set([...prev, gameId]))
      setSuccess(`Successfully published ${clips.length} clips for this game!`)
    } catch (err: any) {
      console.error('Failed to publish game:', err)
      setError(err.message || 'Failed to publish game')
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="publish-panel">
      <div className="publish-header">
        <h2>Publish Games to Cloud</h2>
        <p>Select games to share with coaches. Your local data remains unchanged.</p>
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

      <div className="games-grid">
        {localGames.length === 0 ? (
          <div className="empty-state">
            <p>No games found in local database.</p>
            <p>Tag some clips first, then come back here to publish them.</p>
          </div>
        ) : (
          localGames.map((game) => {
            const isPublished = publishedGames.has(game.id)
            const isPublishing = publishing === game.id

            return (
              <div key={game.id} className="game-card">
                <div className="game-info">
                  <h3>{game.opponent || 'Unknown Opponent'}</h3>
                  <div className="game-details">
                    <span>{game.location}</span>
                    <span>•</span>
                    <span>{game.clipCount} clips</span>
                  </div>
                </div>

                <button
                  onClick={() => publishGame(game.id)}
                  disabled={isPublishing}
                  className={`publish-button ${isPublished ? 'published' : ''}`}
                >
                  {isPublishing ? (
                    <>
                      <span className="spinner" />
                      Publishing...
                    </>
                  ) : isPublished ? (
                    <>✓ Published</>
                  ) : (
                    <>☁️ Publish to Cloud</>
                  )}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
