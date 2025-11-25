import { useState } from 'react'

type ShotChartProps = {
  shotX?: string
  shotY?: string
  shotResult?: string
  playerDesignation?: string
  onShotClick: (x: number, y: number) => void
  onShotResultChange: (result: string) => void
  onPlayerDesignationChange: (designation: string) => void
  onClear: () => void
}

const mapDesignationToColorKey = (designation?: string | null) => {
  const normalized = (designation || '').toLowerCase()
  if (normalized.startsWith('blue') || normalized === 'primary') return 'primary'
  if (normalized.startsWith('green') || normalized === 'shooter') return 'shooter'
  if (normalized.startsWith('black') || normalized === 'role') return 'role'
  return normalized
}

export const ShotChart = ({
  shotX,
  shotY,
  shotResult,
  playerDesignation,
  onShotClick,
  onShotResultChange,
  onPlayerDesignationChange,
  onClear,
}: ShotChartProps) => {
  const [hovering, setHovering] = useState(false)

  const handleCourtClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Convert to percentage for responsive scaling
    const xPercent = (x / rect.width) * 100
    const yPercent = (y / rect.height) * 100

    onShotClick(xPercent, yPercent)
  }

  const parsedX = shotX ? parseFloat(shotX) : null
  const parsedY = shotY ? parseFloat(shotY) : null
  const hasShot = parsedX !== null && parsedY !== null
  const normalizedShotResult = (shotResult || '').toLowerCase()
  const isFgMake = normalizedShotResult === 'make' || normalizedShotResult === 'made fg'
  const isFgMiss = normalizedShotResult === 'miss' || normalizedShotResult === 'missed fg'
  const isFtMake = normalizedShotResult === 'made ft'
  const isFtMiss = normalizedShotResult === 'missed ft'
  const isMake = isFgMake || isFtMake
  const isMiss = isFgMiss || isFtMiss
  const playerColorKey = mapDesignationToColorKey(playerDesignation)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      {/* Header with buttons matching Play-by-Play Filter style */}
      <div className="flex flex-shrink-0 gap-3">
        <div className="rounded bg-neutral-800 px-3 py-2 text-xs">
          Shot Chart
        </div>
        <button
          onClick={onClear}
          className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
        >
          Clear
        </button>
      </div>

      {/* Court - larger */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-[#2a2a2a]">
        <div
          className="relative h-full w-full cursor-crosshair"
          onClick={handleCourtClick}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <img
            src="/shot-chart.png"
            alt="Basketball Court"
            className="h-full w-full object-contain object-center"
            draggable={false}
          />

          {/* Shot marker - Half-circle design */}
          {hasShot && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 transform"
              style={{
                left: `${parsedX}%`,
                top: `${parsedY}%`,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" className="drop-shadow-md">
                {/* White outline circle */}
                <circle cx="10" cy="10" r="9" fill="white" />

                {/* Left half - Player Designation */}
                <path
                  d="M 10,2 A 8,8 0 0,1 10,18 Z"
                  fill={
                    playerColorKey === 'primary'
                      ? '#3b82f6'
                      : playerColorKey === 'shooter'
                        ? '#22c55e'
                        : playerColorKey === 'role'
                          ? '#0a0a0a'
                          : '#6b7280'
                  }
                />

                {/* Right half - Shot Result */}
                <path
                  d="M 10,2 A 8,8 0 0,0 10,18 Z"
                  fill={
                    isMake
                      ? '#22c55e'
                      : isMiss
                        ? '#ef4444'
                        : '#6b7280'
                  }
                />
              </svg>
            </div>
          )}

          {/* Hover overlay */}
          {hovering && (
            <div className="pointer-events-none absolute inset-0 bg-white/5" />
          )}
        </div>
      </div>

      {/* Controls below court - enlarged */}
      <div className="flex flex-shrink-0 flex-col gap-4">
        {/* Shooter Designation Section */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Shooter Designation</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onPlayerDesignationChange('primary')}
              className={`flex items-center gap-2 text-sm font-medium transition hover:opacity-80 ${
                playerColorKey === 'primary' ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" className="flex-shrink-0">
                <circle cx="10" cy="10" r="9" fill="#1f1f1f" />
                <path d="M 10,1 A 9,9 0 0,1 10,19 Z" fill="#3b82f6" />
              </svg>
              Primary Player
            </button>
            <button
              onClick={() => onPlayerDesignationChange('shooter')}
              className={`flex items-center gap-2 text-sm font-medium transition hover:opacity-80 ${
                playerColorKey === 'shooter' ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" className="flex-shrink-0">
                <circle cx="10" cy="10" r="9" fill="#1f1f1f" />
                <path d="M 10,1 A 9,9 0 0,1 10,19 Z" fill="#22c55e" />
              </svg>
              Shooter
            </button>
            <button
              onClick={() => onPlayerDesignationChange('role')}
              className={`flex items-center gap-2 text-sm font-medium transition hover:opacity-80 ${
                playerColorKey === 'role' ? 'text-white' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" className="flex-shrink-0">
                <circle cx="10" cy="10" r="9" fill="#1f1f1f" />
                <path d="M 10,1 A 9,9 0 0,1 10,19 Z" fill="#0a0a0a" />
              </svg>
              Role Player
            </button>
          </div>
        </div>

        {/* Shot Result Section */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Shot Result</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onShotResultChange('Made FG')}
              className={`flex items-center gap-2 text-sm font-medium transition hover:opacity-80 ${
                isFgMake ? 'text-green-400' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" className="flex-shrink-0">
                <circle cx="10" cy="10" r="9" fill="#1f1f1f" />
                <path d="M 10,1 A 9,9 0 0,0 10,19 Z" fill="#22c55e" />
              </svg>
              Made FG
            </button>
            <button
              onClick={() => onShotResultChange('Missed FG')}
              className={`flex items-center gap-2 text-sm font-medium transition hover:opacity-80 ${
                isFgMiss ? 'text-red-400' : 'text-gray-400'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" className="flex-shrink-0">
                <circle cx="10" cy="10" r="9" fill="#1f1f1f" />
                <path d="M 10,1 A 9,9 0 0,0 10,19 Z" fill="#ef4444" />
              </svg>
              Missed FG
            </button>
          </div>
        </div>
      </div>

      {/* Info - fixed height to prevent layout shift */}
      <div className="flex-shrink-0 text-[12px] text-gray-300 h-[24px] leading-[24px] whitespace-nowrap overflow-hidden text-ellipsis">
        {hasShot && (
          <>
            Shot location: ({parsedX.toFixed(1)}, {parsedY.toFixed(1)})
            {playerDesignation && ` • ${
              playerDesignation === 'primary' ? 'Primary Player' :
              playerDesignation === 'shooter' ? 'Shooter' :
              playerDesignation === 'role' ? 'Role Player' :
              playerDesignation.charAt(0).toUpperCase() + playerDesignation.slice(1)
            }`}
            {shotResult && ` • ${shotResult.toUpperCase()}`}
          </>
        )}
      </div>
    </div>
  )
}
