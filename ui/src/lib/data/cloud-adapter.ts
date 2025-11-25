import type { Clip, Game, ExtractionJob, PaginatedResponse } from '../types'
import type { ClipListParams, DataAdapter } from './index'

const API_BASE = 'https://ou-basketball-defense.onrender.com'

export class CloudAdapter implements DataAdapter {
  readonly mode = 'cloud' as const

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token')
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    }
  }

  private async fetchAPI(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    })

    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('auth_token')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
      window.location.reload()
      throw new Error('Authentication required')
    }

    return response
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`)
      return response.ok
    } catch {
      return false
    }
  }

  async listGames(): Promise<Game[]> {
    const response = await this.fetchAPI('/api/clips')
    if (!response.ok) throw new Error('Failed to fetch games')

    const clips: Clip[] = await response.json()

    // Group clips by game
    const gamesMap = new Map<string, Game>()

    for (const clip of clips) {
      const gameId = clip.canonicalGameId || clip.gameId?.toString() || 'unknown'

      if (!gamesMap.has(gameId)) {
        gamesMap.set(gameId, {
          id: gameId,
          opponent: clip.opponent || 'Unknown',
          opponentSlug: clip.opponentSlug || '',
          location: clip.location || clip.gameLocation || '',
          clipCount: 0,
        })
      }

      const game = gamesMap.get(gameId)!
      game.clipCount++
    }

    return Array.from(gamesMap.values())
  }

  async listClips(params?: ClipListParams): Promise<PaginatedResponse<Clip>> {
    const response = await this.fetchAPI('/api/clips')
    if (!response.ok) throw new Error('Failed to fetch clips')

    let clips: Clip[] = await response.json()

    // Filter by gameId if provided
    if (params?.gameId) {
      clips = clips.filter(c =>
        c.canonicalGameId === params.gameId ||
        c.gameId?.toString() === params.gameId
      )
    }

    // Pagination
    const page = params?.page || 1
    const pageSize = params?.pageSize || 50
    const start = (page - 1) * pageSize
    const paginatedClips = clips.slice(start, start + pageSize)

    return {
      items: paginatedClips,
      total: clips.length,
      page,
      pageSize,
    }
  }

  async getClip(id: string): Promise<Clip | null> {
    const response = await this.fetchAPI(`/api/clip/${id}`)
    if (!response.ok) return null
    return await response.json()
  }

  async saveClip(clip: Clip): Promise<Clip> {
    const response = await this.fetchAPI('/api/clips', {
      method: 'POST',
      body: JSON.stringify(clip),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save clip')
    }

    const data = await response.json()
    return data.clip || clip
  }

  async updateClip(
    clipId: string,
    payload: {
      playResult?: string | null
      notes?: string | null
      shooterDesignation?: string | null
    },
  ): Promise<Clip> {
    const response = await this.fetchAPI(`/api/clip/${clipId}`, {
      method: 'PUT',
      body: JSON.stringify({
        result: payload.playResult,
        notes: payload.notes,
        shooter: payload.shooterDesignation,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update clip')
    }

    const data = await response.json()
    return data.clip
  }

  async updateClipShot(
    clipId: string,
    payload: {
      hasShot: boolean
      shotX?: number | null
      shotY?: number | null
      shotResult?: string | null
      shooterDesignation?: string | null
    },
  ): Promise<Clip> {
    const response = await this.fetchAPI(`/api/clip/${clipId}/shot`, {
      method: 'PUT',
      body: JSON.stringify({
        has_shot: payload.hasShot ? 'Yes' : 'No',
        shot_x: payload.shotX?.toString() || '',
        shot_y: payload.shotY?.toString() || '',
        shot_result: payload.shotResult || '',
        shooter_designation: payload.shooterDesignation || '',
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update shot')
    }

    const data = await response.json()
    return data.clip
  }

  async deleteClip(id: string): Promise<void> {
    const role = localStorage.getItem('role')

    if (role !== 'admin') {
      throw new Error('Only admin can delete clips. Coaches should use delete requests.')
    }

    const response = await this.fetchAPI(`/api/clip/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete clip')
    }
  }

  async deleteGame(gameId: string): Promise<void> {
    const role = localStorage.getItem('role')

    if (role !== 'admin') {
      throw new Error('Only admin can delete games. Coaches should use delete requests.')
    }

    const response = await this.fetchAPI(`/api/games/${gameId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete game')
    }
  }

  async triggerExtraction(payload: { clipId: string }): Promise<ExtractionJob> {
    // Not implemented for cloud yet
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  }
}

export const createCloudAdapter = (): CloudAdapter => new CloudAdapter()
