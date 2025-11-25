import { getConfig } from '../config'
import type { Clip, Game, ExtractionJob, PaginatedResponse } from '../types'
import type { ClipListParams, DataAdapter } from './index'
import { normalizeClip, syncClipToCache } from './transformers'

export class LocalAdapter implements DataAdapter {
  readonly mode = 'local' as const
  private readonly baseUrl: string

  constructor() {
    const { apiBaseUrl } = getConfig()
    this.baseUrl = apiBaseUrl.replace(/\/$/, '')
  }

  private formatTime(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed.length ? trimmed : null
    }
    if (typeof value !== 'number' || Number.isNaN(value)) return null
    const total = Math.max(0, value)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = Math.floor(total % 60)
    const parts = [minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')]
    if (hours > 0) {
      parts.unshift(hours.toString())
    }
    return parts.join(':')
  }

  private buildUrl(path: string): string {
    return `${this.baseUrl}${path}`
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(this.buildUrl('/health'))
      if (!response.ok) return false
      const payload = await response.json().catch(() => null)
      if (payload && typeof payload === 'object') {
        if ('status' in payload) {
          return payload.status === 'ok'
        }
        return true
      }
      return true
    } catch {
      return false
    }
  }

  async listGames(): Promise<Game[]> {
    // TODO: implement call to local Flask/SQLite service
    return []
  }

  async listClips(_params?: ClipListParams): Promise<PaginatedResponse<Clip>> {
    const response = await fetch(this.buildUrl('/api/clips'))
    if (!response.ok) {
      throw new Error(`Clip list failed with status ${response.status}`)
    }
    const data = await response.json()
    const rawItems = Array.isArray(data) ? data : []
    const items = rawItems.map(normalizeClip)
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length || (_params?.pageSize ?? 50),
    }
  }

  async getClip(id: string): Promise<Clip | null> {
    if (!id) return null
    const response = await fetch(this.buildUrl(`/api/clip/${encodeURIComponent(id)}`))
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to load clip ${id}`)
    }
    const payload = await response.json()
    return normalizeClip(payload)
  }

  async saveClip(clip: Clip): Promise<Clip> {
    const response = await fetch(this.buildUrl('/api/clips'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clip),
    })
    if (!response.ok) {
      throw new Error(`Failed to save clip: ${response.status}`)
    }
    return clip
  }

  async updateClip(clipId: string, payload: Record<string, any>): Promise<Clip> {
    if (!clipId) throw new Error('clipId is required')

    console.log('[DEBUG] local-adapter updateClip received payload:', payload)

    const response = await fetch(this.buildUrl(`/api/clip/${encodeURIComponent(clipId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Failed to update clip: ${response.status} ${detail}`)
    }

    const data = await response.json()
    const clipPayload = data?.clip ?? data
    const normalized = normalizeClip(clipPayload)
    syncClipToCache(normalized)
    return normalized
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
    if (!clipId) throw new Error('clipId is required')

    if (!payload.hasShot) {
      const response = await fetch(this.buildUrl(`/api/clip/${encodeURIComponent(clipId)}/shot`), {
        method: 'DELETE',
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Failed to clear shot data: ${response.status} ${detail}`)
      }
      const data = await response.json().catch(() => ({}))
      const clipPayload = data?.clip ?? data
      let normalized: Clip | null = null
      if (clipPayload && clipPayload.id) {
        normalized = normalizeClip(clipPayload)
      } else {
        normalized = await this.getClip(clipId)
      }
      if (!normalized) {
        throw new Error('Clip not found after clearing shot data')
      }
      syncClipToCache(normalized)
      return normalized
    }

    const body = {
      has_shot: payload.hasShot ? 'Yes' : 'No',
      shot_x: payload.shotX ?? '',
      shot_y: payload.shotY ?? '',
      shot_result: payload.shotResult ?? '',
      shooter_designation: payload.shooterDesignation ?? '',
    }

    const response = await fetch(this.buildUrl(`/api/clip/${encodeURIComponent(clipId)}/shot`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Failed to update shot data: ${response.status} ${detail}`)
    }

    const data = await response.json()
    const clipPayload = data?.clip ?? data
    if (!clipPayload || !clipPayload.id) {
      throw new Error('Clip payload missing after shot update')
    }
    const normalized = normalizeClip(clipPayload)
    syncClipToCache(normalized)
    return normalized
  }

  async deleteGame(gameId: string): Promise<void> {
    const trimmed = gameId?.toString().trim()
    if (!trimmed) {
      throw new Error('gameId is required')
    }
    const response = await fetch(this.buildUrl(`/api/games/${encodeURIComponent(trimmed)}`), {
      method: 'DELETE',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Failed to delete game ${trimmed}: ${response.status} ${detail}`)
    }
  }

  async deleteClip(id: string): Promise<void> {
    if (!id) throw new Error('Clip ID is required')

    const response = await fetch(this.buildUrl(`/api/clip/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Failed to delete clip: ${response.status} ${detail}`)
    }
  }

  async triggerExtraction(_payload: { clipId: string }): Promise<ExtractionJob> {
    // TODO: implement
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  }
}

export const createLocalAdapter = (): LocalAdapter => new LocalAdapter()
