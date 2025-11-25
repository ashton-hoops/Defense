import { useState, useRef, useEffect } from 'react'
import type { TagFields } from '../../lib/types'
import { FloatingPicker } from './FloatingPicker'

type TagsPaneProps = {
  fields: TagFields
  onChange: (field: keyof TagFields, value: string) => void
}

const DATALIST_OPTIONS = {
  gameLocation: ['Home', 'Away', 'Neutral'],
  situation: ['Half Court', 'SLOB', 'BLOB', 'Transition', 'Early Offense', 'Half Court (ATO)'],
  scoutTag: ['Yes – Practiced', 'Partial – Similar Action', 'No – Not Practiced'],
  offFormation: [
    '5-Out',
    '4-Out 1-In',
    '3-Out 2-In',
    '2-1-2',
    '1-4 High',
    '1-4 Low',
    'Horns',
    'Box (BLOB/SLOB)',
    'Diamond (BLOB/SLOB)',
    '4 Low (BLOB/SLOB)',
    '4 High (BLOB/SLOB)',
  ],
  coverage: [
    'Man',
    '2-3',
    '3-2',
    '1-3-1',
    '1-2-2',
    'Full Court Man',
    '2-2-1 Press',
    '1-2-1-1 Press (Diamond)',
  ],
  defDisruption: [
    'Denied Wing Entry',
    'Denied Post Entry',
    'Pressured Ball Handler to Prevent Pass',
    'Deflected Pass',
  ],
  playResult: [
    'Made FG',
    'Missed FG',
    'And-One',
    'Live-Ball Turnover',
    'Dead-Ball Turnover',
    'Turnover (Shot Clock Violation)',
    'Shooting Foul',
    'Off-Ball Foul',
    'Reach-In Foul',
    'Loose-Ball Foul',
    'Deflection (Out of Bounds)',
  ],
  paintTouches: [
    'No Paint Touch',
    'Drive Baseline',
    'Drive Middle',
    'Post Touch - Low Block',
    'Post Touch - High Post',
    'Cut to Paint (Received Pass)',
  ],
  shotLocation: [
    'At Rim (0–4 ft)',
    'Paint (5–10 ft)',
    'Short Midrange (11–14 ft)',
    'Long Midrange (15–20 ft)',
    'Corner 3 (21 ft 6 in)',
    'Wing/Top 3 (22–23 ft)',
    'Deep 3 (24–26 ft)',
    'Late Clock / Heave (27 ft +)',
  ],
  shotContest: [
    'Open (4+ ft)',
    'Light Contest / Late High-Hand (2–4 ft)',
    'Contested/On-Time High-Hand (1–2 ft)',
    'Heavy Contest / Early High-Hand (0–1 ft)',
    'Blocked',
  ],
  reboundOutcome: ['DREB', 'OREB', 'Other'],
  shooterDesignation: ['Blue (Perimeter)', 'Blue (Post)', 'Green', 'Black'],
}

export const TagsPane = ({ fields, onChange }: TagsPaneProps) => {
  const [pickerState, setPickerState] = useState<{
    field: keyof TagFields | null
    inputRef: HTMLInputElement | null
  }>({ field: null, inputRef: null })

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleInputFocus = (field: keyof TagFields, input: HTMLInputElement) => {
    if (field in DATALIST_OPTIONS) {
      console.log('Opening picker for field:', field, 'Options:', DATALIST_OPTIONS[field as keyof typeof DATALIST_OPTIONS])
      setPickerState({ field, inputRef: input })
    }
  }

  const handlePickerSelect = (value: string) => {
    if (!pickerState.field || !pickerState.inputRef) return

    const currentValue = pickerState.inputRef.value
    const parts = currentValue.split(',').map((s) => s.trim()).filter(Boolean)
    parts.push(value)
    const newValue = parts.join(', ')

    console.log(`🐛 Picker selected for field "${pickerState.field}":`, newValue)
    onChange(pickerState.field, newValue)

    setTimeout(() => {
      if (pickerState.inputRef) {
        pickerState.inputRef.focus()
        pickerState.inputRef.selectionStart = pickerState.inputRef.selectionEnd = newValue.length
      }
    }, 0)
  }

  const handlePickerClose = () => {
    setPickerState({ field: null, inputRef: null })
  }

  const getOptions = (field: keyof TagFields): string[] => {
    return DATALIST_OPTIONS[field as keyof typeof DATALIST_OPTIONS] || []
  }

  const getInputProps = (field: keyof TagFields) => {
    const hasOptions = field in DATALIST_OPTIONS
    return hasOptions
      ? {
          onFocus: (e: React.FocusEvent<HTMLInputElement>) => handleInputFocus(field, e.target),
          onClick: (e: React.MouseEvent<HTMLInputElement>) => handleInputFocus(field, e.target as HTMLInputElement),
        }
      : {}
  }

  return (
    <div style={{ height: '100%' }}>
      <div className="flex h-full flex-col rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">Possession</p>
        <div className="mt-2">
          <div className="overflow-x-auto overflow-y-hidden pb-1">
            <div className="flex min-w-full w-max flex-nowrap items-center gap-[10px]">
        {/* Possession # */}
        <div className="tag-field flex min-w-[140px] flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Possession #</span>
          <input
            ref={(el) => (inputRefs.current.possession = el)}
            type="number"
            min="1"
            value={fields.possession}
            onChange={(e) => onChange('possession', e.target.value)}
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Situation */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Situation</span>
          <input
            ref={(el) => (inputRefs.current.situation = el)}
            value={fields.situation}
            onChange={(e) => onChange('situation', e.target.value)}
            {...getInputProps('situation')}
            placeholder="Half Court / SLOB / Transition"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Offensive Formation */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Offensive Formation</span>
          <input
            ref={(el) => (inputRefs.current.offFormation = el)}
            value={fields.offFormation}
            onChange={(e) => onChange('offFormation', e.target.value)}
            {...getInputProps('offFormation')}
            placeholder="Horns / 5-Out / 1-4 High"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Play Name */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Play Name</span>
          <input
            ref={(el) => (inputRefs.current.playName = el)}
            value={fields.playName}
            onChange={(e) => onChange('playName', e.target.value)}
            placeholder="Horns Flare"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Covered in Scout? */}
        <div className="tag-field flex min-w-[140px] flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Covered in Scout?</span>
          <input
            ref={(el) => (inputRefs.current.scoutTag = el)}
            value={fields.scoutTag}
            onChange={(e) => onChange('scoutTag', e.target.value)}
            {...getInputProps('scoutTag')}
            placeholder="Yes – Practiced / Partial / No"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Play Trigger */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Play Trigger</span>
          <input
            ref={(el) => (inputRefs.current.playTrigger = el)}
            value={fields.playTrigger}
            onChange={(e) => onChange('playTrigger', e.target.value)}
            placeholder="Entry to wing"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Defensive Coverage */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Defensive Coverage</span>
          <input
            ref={(el) => (inputRefs.current.coverage = el)}
            value={fields.coverage}
            onChange={(e) => onChange('coverage', e.target.value)}
            {...getInputProps('coverage')}
            placeholder="Man / 2-3 / 3-2 / 1-3-1 / 1-2-2 / Press"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Defensive Disruption */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Defensive Disruption</span>
          <input
            ref={(el) => (inputRefs.current.defDisruption = el)}
            value={fields.defDisruption}
            onChange={(e) => onChange('defDisruption', e.target.value)}
            {...getInputProps('defDisruption')}
            placeholder="Denied Wing Entry, Deflected Pass"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Defensive Breakdown */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Defensive Breakdown</span>
          <input
            ref={(el) => (inputRefs.current.defBreakdown = el)}
            value={fields.defBreakdown}
            onChange={(e) => onChange('defBreakdown', e.target.value)}
            placeholder="Yes(Late Switch/Stuck/Etc.)"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Play Result */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Play Result</span>
          <input
            ref={(el) => (inputRefs.current.playResult = el)}
            value={fields.playResult}
            onChange={(e) => onChange('playResult', e.target.value)}
            {...getInputProps('playResult')}
            placeholder="Missed FG / Live-Ball Turnover / ..."
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Paint Touches */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Paint Touches</span>
          <input
            ref={(el) => (inputRefs.current.paintTouches = el)}
            value={fields.paintTouches}
            onChange={(e) => onChange('paintTouches', e.target.value)}
            {...getInputProps('paintTouches')}
            placeholder="No Paint Touch / Drive / Post Touch / Cut"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Shooter Designation */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Shooter Designation</span>
          <input
            ref={(el) => (inputRefs.current.shooterDesignation = el)}
            value={fields.shooterDesignation}
            onChange={(e) => onChange('shooterDesignation', e.target.value)}
            {...getInputProps('shooterDesignation')}
            placeholder="Blue / Green / Black"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Shot Location */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Shot Location</span>
          <input
            ref={(el) => (inputRefs.current.shotLocation = el)}
            value={fields.shotLocation}
            onChange={(e) => onChange('shotLocation', e.target.value)}
            {...getInputProps('shotLocation')}
            placeholder="At Rim / Corner 3 / ..."
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Shot Contest */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Shot Contest</span>
          <input
            ref={(el) => (inputRefs.current.shotContest = el)}
            value={fields.shotContest}
            onChange={(e) => onChange('shotContest', e.target.value)}
            {...getInputProps('shotContest')}
            placeholder="Open / Contested / Blocked"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Rebound Outcome */}
        <div className="tag-field flex min-w-[140px] flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Rebound Outcome</span>
          <input
            ref={(el) => (inputRefs.current.reboundOutcome = el)}
            value={fields.reboundOutcome}
            onChange={(e) => onChange('reboundOutcome', e.target.value)}
            {...getInputProps('reboundOutcome')}
            placeholder="DREB / OREB / Other"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Points */}
        <div className="tag-field flex min-w-[140px] flex-shrink-0 flex-col gap-0">
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Points</span>
          <input
            ref={(el) => (inputRefs.current.points = el)}
            type="number"
            min="0"
            max="3"
            value={fields.points}
            onChange={(e) => onChange('points', e.target.value)}
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>

        {/* Notes */}
        <div className="tag-field flex flex-shrink-0 flex-col gap-1" style={{ minWidth: '260px' }}>
          <span className="tag-label text-[10px] text-[#e8e2d6] mb-0.5">Notes</span>
          <input
            ref={(el) => (inputRefs.current.notes = el)}
            value={fields.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            placeholder="Any quick notes"
            className="tag-input w-fit min-w-[190px] max-w-[560px] rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-sm text-[#faf9f6] focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none"
          />
        </div>
            </div>
          </div>
        </div>
      </div>

      {pickerState.field && (
        <FloatingPicker
          inputRef={pickerState.inputRef}
          options={getOptions(pickerState.field)}
          isOpen={true}
          onSelect={handlePickerSelect}
          onClose={handlePickerClose}
        />
      )}
    </div>
  )
}
