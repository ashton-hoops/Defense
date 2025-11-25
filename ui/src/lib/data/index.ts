import type { Clip, ExtractionJob, Game, PaginatedResponse } from '../types'

export type ClipListParams = {
  gameId?: string
  search?: string
  page?: number
  pageSize?: number
}

export type DataProvider = {
  health(): Promise<boolean>
  listGames(): Promise<Game[]>
  listClips(params?: ClipListParams): Promise<PaginatedResponse<Clip>>
  getClip(id: string): Promise<Clip | null>
  saveClip(clip: Clip): Promise<Clip>
  updateClip(
    clipId: string,
    payload: {
      playResult?: string | null
      notes?: string | null
      shooterDesignation?: string | null
      startTime?: number | string | null
      endTime?: number | string | null
      videoStart?: number | null
      videoEnd?: number | null
    },
  ): Promise<Clip>
  updateClipShot(
    clipId: string,
    payload: {
      hasShot: boolean
      shotX?: number | null
      shotY?: number | null
      shotResult?: string | null
      shooterDesignation?: string | null
    },
  ): Promise<Clip>
  deleteGame(gameId: string): Promise<void>
  deleteClip(id: string): Promise<void>
  triggerExtraction(payload: { clipId: string }): Promise<ExtractionJob>
}

export type DataMode = 'local' | 'cloud'

export interface DataAdapter extends DataProvider {
  readonly mode: DataMode
}

export type AdapterFactory = () => DataAdapter

export { LocalAdapter, createLocalAdapter } from './local-adapter'
export { CloudAdapter, createCloudAdapter } from './cloud-adapter'
