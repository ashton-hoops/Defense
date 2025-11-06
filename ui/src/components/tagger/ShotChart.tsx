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

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {/* Controls */}
      <div className="flex flex-shrink-0 flex-col gap-2">
        {/* Player Designation Row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Player Designation (Left Half):</span>
          <div className="flex gap-2">
            <button
              onClick={() => onPlayerDesignationChange('primary')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                playerDesignation === 'primary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
              }`}
            >
              🔵 Primary
            </button>
            <button
              onClick={() => onPlayerDesignationChange('shooter')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                playerDesignation === 'shooter'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
              }`}
            >
              🟢 Shooter
            </button>
            <button
              onClick={() => onPlayerDesignationChange('role')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                playerDesignation === 'role'
                  ? 'bg-gray-600 text-white'
                  : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
              }`}
            >
              ⚫ Role
            </button>
          </div>
        </div>

        {/* Shot Result Row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-400">Shot Result (Right Half):</span>
          <div className="flex gap-2">
            <button
              onClick={() => onShotResultChange('make')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                shotResult === 'make'
                  ? 'bg-green-600 text-white'
                  : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
              }`}
            >
              🟩 Make
            </button>
            <button
              onClick={() => onShotResultChange('miss')}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                shotResult === 'miss'
                  ? 'bg-red-600 text-white'
                  : 'bg-neutral-800 text-gray-300 hover:bg-neutral-700'
              }`}
            >
              🟥 Miss
            </button>
            <button
              onClick={onClear}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
            >
              Clear Shot
            </button>
          </div>
        </div>
      </div>

      {/* Court */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-[#2a2a2a]">
        <div
          className="relative h-full w-full cursor-crosshair"
          onClick={handleCourtClick}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <img
            src="/shot-chart.png"
            alt="Basketball Court"
            className="h-full w-full object-contain"
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
                    playerDesignation === 'primary'
                      ? '#3b82f6'
                      : playerDesignation === 'shooter'
                        ? '#22c55e'
                        : playerDesignation === 'role'
                          ? '#1f2937'
                          : '#6b7280'
                  }
                />

                {/* Right half - Shot Result */}
                <path
                  d="M 10,2 A 8,8 0 0,0 10,18 Z"
                  fill={
                    shotResult === 'make'
                      ? '#22c55e'
                      : shotResult === 'miss'
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

      {/* Info */}
      {hasShot && (
        <div className="flex-shrink-0 text-xs text-gray-400">
          Shot location: ({parsedX.toFixed(1)}%, {parsedY.toFixed(1)}%)
          {playerDesignation && ` • ${playerDesignation.charAt(0).toUpperCase() + playerDesignation.slice(1)}`}
          {shotResult && ` • ${shotResult.toUpperCase()}`}
        </div>
      )}
    </div>
  )
}
