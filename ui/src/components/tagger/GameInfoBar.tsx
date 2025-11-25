import { useRef } from 'react'
import type { TagFields } from '../../lib/types'

type GameInfoBarProps = {
  fields: TagFields
  onChange: (field: keyof TagFields, value: string) => void
}

const LOCATION_OPTIONS = ['Home', 'Away', 'Neutral']

export const GameInfoBar = ({ fields, onChange }: GameInfoBarProps) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">Game Info</p>
        <div className="mt-2 flex w-full flex-nowrap items-center gap-[10px]">
          {/* Game # */}
          <div className="tag-field flex flex-1 flex-col gap-0">
            <span className="tag-label mb-0.5 text-[10px] text-[#e8e2d6]">Game #</span>
            <input
              ref={(el) => (inputRefs.current.gameNum = el)}
              type="number"
              min="1"
              value={fields.gameNum}
              onChange={(e) => onChange('gameNum', e.target.value)}
              className="tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
            />
          </div>

          {/* Location */}
          <div className="tag-field flex flex-1 flex-col gap-0">
            <span className="tag-label mb-0.5 text-[10px] text-[#e8e2d6]">Location</span>
            <input
              ref={(el) => (inputRefs.current.gameLocation = el)}
              value={fields.gameLocation}
              onChange={(e) => onChange('gameLocation', e.target.value)}
              placeholder="Home / Away / Neutral"
              list="location-options"
              className="tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
            />
            <datalist id="location-options">
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
          </div>

          {/* Opponent */}
          <div className="tag-field flex flex-1 flex-col gap-0">
            <span className="tag-label mb-0.5 text-[10px] text-[#e8e2d6]">Opponent</span>
            <input
              ref={(el) => (inputRefs.current.opponent = el)}
              value={fields.opponent}
              onChange={(e) => onChange('opponent', e.target.value)}
              className="tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
            />
          </div>

          {/* Game Score */}
          <div className="tag-field flex flex-1 flex-col gap-0">
            <span className="tag-label mb-0.5 text-[10px] text-[#e8e2d6]">Game Score</span>
            <input
              ref={(el) => (inputRefs.current.gameScore = el)}
              value={fields.gameScore}
              onChange={(e) => onChange('gameScore', e.target.value)}
              placeholder="e.g., 75-68 W"
              className="tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
            />
          </div>

          {/* Quarter */}
          <div className="tag-field flex flex-1 flex-col gap-0">
            <span className="tag-label mb-0.5 text-[10px] text-[#e8e2d6]">Quarter</span>
            <input
              ref={(el) => (inputRefs.current.quarter = el)}
              type="number"
              min="1"
              max="6"
              value={fields.quarter}
              onChange={(e) => onChange('quarter', e.target.value)}
              className="tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
