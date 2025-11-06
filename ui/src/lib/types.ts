export type Clip = {
  id: string
  gameId: string
  gameDate?: string
  gameNumber?: string | number
  opponent?: string
  filename?: string
  location?: string
  locationDisplay?: string
  gameLocation?: string
  gameScore?: string
  quarter?: string | number
  possession?: string | number
  situation?: string
  formation?: string
  playName?: string
  scoutCoverage?: string
  actionTrigger?: string
  actionTypes?: string
  actionSequence?: string
  coverage?: string
  ballScreen?: string
  offBallScreen?: string
  helpRotation?: string
  disruption?: string
  playResult?: string
  playType?: string
  possessionResult?: string
  shooterDesignation?: string
  defenderDesignation?: string
  tags?: string[]
  notes?: string
  videoUrl?: string
  videoStart?: number
  videoEnd?: number
  hasShot?: boolean
  shotX?: number
  shotY?: number
  shotResult?: string
  playerDesignation?: string
  shotLocation?: string
  shotContest?: string
  shotQuality?: string
  paintTouches?: string
  rebound?: string
  points?: number
  breakdown?: string
  savedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type Game = {
  id: string
  gameNumber?: number
  opponent?: string
  location?: string
  result?: string
  date?: string
  season?: string
}

export type ExtractionJob = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  clipId?: string
  message?: string
}

export type PaginatedResponse<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type TagFields = {
  gameNum: string
  gameLocation: string
  opponent: string
  gameScore: string
  quarter: string
  possession: string
  situation: string
  offFormation: string
  playName: string
  scoutTag: string
  actionTrigger: string
  actionTypes: string
  actionSeq: string
  coverage: string
  ballScreenCov: string
  offBallScreenCov: string
  helpRotation: string
  defDisruption: string
  defBreakdown: string
  playResult: string
  paintTouches: string
  shooterDesignation: string
  shotLocation: string
  shotContest: string
  reboundOutcome: string
  points: string
  notes: string
  hasShot: string
  shotX: string
  shotY: string
  shotResult: string
  playerDesignation: string
}

export type QueueEntry = {
  __clipId: string
  __gameId: string
  __opponent: string
  __selected: boolean
  'Game #': string
  Location: string
  Opponent: string
  Quarter: string
  'Possession #': string
  Situation: string
  'Offensive Formation': string
  'Play Name': string
  'Covered in Scout?': string
  'Action Trigger': string
  'Action Type(s)': string
  'Action Sequence': string
  'Defensive Coverage': string
  'Ball Screen Coverage': string
  'Off-Ball Screen Coverage': string
  'Help/Rotation': string
  'Defensive Disruption': string
  'Defensive Breakdown': string
  'Play Result': string
  'Paint Touches': string
  'Shooter Designation': string
  'Shot Location': string
  'Shot Contest': string
  'Rebound Outcome': string
  'Has Shot': string
  'Shot X': string
  'Shot Y': string
  'Shot Result': string
  Points: string
  Notes: string
  'Start Time': string
  'End Time': string
  q: string
  p: string
  start: string
  end: string
  play: string
  situation: string
  shooter: string
  res: string
}
