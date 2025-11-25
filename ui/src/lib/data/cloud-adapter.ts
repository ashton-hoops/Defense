import type { Clip, Game, ExtractionJob, PaginatedResponse } from '../types'
import type { ClipListParams, DataAdapter } from './index'

export class CloudAdapter implements DataAdapter {
  readonly mode = 'cloud' as const

  async health(): Promise<boolean> {
    // Cloud adapter not yet implemented
    return false
  }

  async listGames(): Promise<Game[]> {
    // TODO: wire to future cloud API
    return []
  }

  async listClips(_params?: ClipListParams): Promise<PaginatedResponse<Clip>> {
    // TODO: wire to future cloud API
    return { items: [], total: 0, page: 1, pageSize: 50 }
  }

  async getClip(_id: string): Promise<Clip | null> {
    return null
  }

  async saveClip(clip: Clip): Promise<Clip> {
    return clip
  }

  async updateClip(
    _clipId: string,
    _payload: {
      playResult?: string | null
      notes?: string | null
      shooterDesignation?: string | null
    },
  ): Promise<Clip> {
    throw new Error('Cloud adapter not implemented yet')
  }

  async updateClipShot(
    _clipId: string,
    _payload: {
      hasShot: boolean
      shotX?: number | null
      shotY?: number | null
      shotResult?: string | null
      shooterDesignation?: string | null
    },
  ): Promise<Clip> {
    throw new Error('Cloud adapter not implemented yet')
  }

  async deleteClip(_id: string): Promise<void> {
    // TODO: wire to future cloud API
  }

  async deleteGame(_gameId: string): Promise<void> {
    throw new Error('Cloud adapter not implemented yet')
  }

  async triggerExtraction(_payload: { clipId: string }): Promise<ExtractionJob> {
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
  }
}

export const createCloudAdapter = (): CloudAdapter => new CloudAdapter()
