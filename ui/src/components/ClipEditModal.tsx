import { useState, useEffect, useRef } from 'react'
import type { Clip, TagAction } from '../lib/types'
import { FloatingPicker } from './tagger/FloatingPicker'
import './ClipEditModal.css'

type ClipEditModalProps = {
  clip: Clip
  isOpen: boolean
  onClose: () => void
  onSave: (clipId: string, updates: Partial<Clip>) => Promise<void>
  onDelete?: (clipId: string) => Promise<void>
}

const FIELD_OPTIONS: Record<string, string[]> = {
  situation: ['Half Court', 'Transition', 'SLOB', 'BLOB', 'Early Offense', 'Half Court (ATO)'],
  scoutCoverage: ['Yes – Practiced', 'Partial – Similar Action', 'No – Not Practiced'],
  formation: [
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
  disruption: [
    'Denied Wing Entry',
    'Denied Post Entry',
    'Pressured Ball Handler to Prevent Pass',
    'Deflected Pass',
  ],
  breakdown: [
    'None',
    'Stuck on Screen',
    'Late Chase / Slow Recovery',
    'Late Help',
    'No Help / Missed Rotation',
    'Missed Tag',
    'Poor Closeout',
    'Over Helped',
    'Beat Off Dribble',
    'Ball Watching / Backcut',
    'Wrong Coverage / Miscommunication',
    'Transition Mismatch / Not Matched',
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
  shooterDesignation: ['Blue (Perimeter)', 'Blue (Post)', 'Green', 'Black'],
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
  rebound: ['DREB', 'OREB', 'Other'],
}

// Action constants from ActionBar
const PHASE_OPTIONS = ['On-Ball', 'Off-Ball', 'DHO', 'CUT']
const ON_BALL_ACTIONS = [
  { label: 'ISO' },
  {
    label: 'Pick & Roll',
    secondary: ['Middle', 'Side'],
    tertiary: {
      Middle: ['Standard', 'Flat', 'Angle', 'Step-Up'],
      Side: ['Standard', 'Flat', 'Angle', 'Step-Up'],
    },
  },
  {
    label: 'Pick & Pop',
    secondary: ['Middle', 'Side'],
    tertiary: {
      Middle: ['Standard', 'Flat', 'Angle', 'Step-Up'],
      Side: ['Standard', 'Flat', 'Angle', 'Step-Up'],
    },
  },
  {
    label: 'Pick & Short Roll',
    secondary: ['Middle', 'Side'],
    tertiary: {
      Middle: ['Standard', 'Flat', 'Angle', 'Step-Up'],
      Side: ['Standard', 'Flat', 'Angle', 'Step-Up'],
    },
  },
  { label: 'Slip Screen', secondary: ['Middle', 'Side'] },
  { label: 'Ghost Screen', secondary: ['Middle', 'Side'] },
  { label: 'Gortat Screen', secondary: ['Seal', 'Cross'] },
  { label: 'Flip Ball Screen', secondary: ['Middle', 'Side'] },
  {
    label: 'Drag Screen',
    secondary: ['Drag', 'Double Drag'],
    tertiary: {
      Drag: ['Standard', 'Flat', 'Angle'],
      'Double Drag': ['Standard', 'Flat', 'Angle'],
    },
  },
  { label: 'Twist / Re-Screen', secondary: ['Standard', 'Angle'] },
]
const DHO_ACTIONS = ['DHO', 'Fake DHO', 'DHO into Ball Screen', 'Re-Screen DHO', 'Pistol Action', 'Get Action', 'Curl & Dump']
const OFF_BALL_ACTIONS = [
  'Away Screen',
  'Down Screen',
  'Pin-Down',
  'Cross Screen',
  'Back Screen',
  'Flare Screen',
  'Stagger',
  'Double Screen (Parallel)',
  'Elevator Screen',
]
const CUT_ACTIONS = ['Cut']
const COVERAGE_ACTIONS = [
  { label: 'Over', secondary: ['High Show', 'At Level', 'Drop'] },
  { label: 'Under', secondary: ['High Show', 'At Level', 'Drop'] },
  { label: 'Switch' },
  { label: 'Ice/Down' },
  { label: 'Blitz/Trap' },
  { label: 'Hedge' },
  { label: 'Peel Switch' },
  { label: 'Gap/Weak' },
]
const ISO_COVERAGE_OPTIONS = ['Drive Middle', 'Drive Baseline', 'No Drive']
const HELP_ACTIONS = [
  'Low-Man Help',
  'Tag the Roller',
  'Gap / Stunt & Recover',
  'Sink & Fill',
  'X-Out / Scramble',
  'Help the Helper',
  'Peel / Late Switch',
  'No Help / Stay Home',
]
const BREAKDOWN_ACTIONS = [
  'None',
  'Stuck on Screen',
  'Late Chase / Slow Recovery',
  'Late Help',
  'No Help / Missed Rotation',
  'Missed Tag',
  'Poor Closeout',
  'Over Helped',
  'Beat Off Dribble',
  'Ball Watching / Backcut',
  'Wrong Coverage / Miscommunication',
  'Transition Mismatch / Not Matched',
]
const COMMUNICATION_ACTIONS = [
  'Unknown',
  'Confirmed Verbal',
  'Visual / Hand Signal',
  'Late Communication',
  'Miscommunication',
  'No Communication',
]
const OUTCOME_ACTIONS = ['Contained', 'Advantage Created', 'Forced Help', 'Other']

const ClipEditModal = ({ clip, isOpen, onClose, onSave, onDelete }: ClipEditModalProps) => {
  const [formData, setFormData] = useState<Partial<Clip>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    context: true,
    playActions: false,
    defensive: false,
    shotData: false,
    actions: false,
    notes: false,
  })

  const [pickerState, setPickerState] = useState<{
    field: string | null
    inputRef: HTMLInputElement | null
    actionIndex?: number
  }>({ field: null, inputRef: null })

  const [actionTypePickerState, setActionTypePickerState] = useState<{
    index: number
    step: 'primary' | 'secondary' | 'tertiary' | 'dho' | 'offball' | 'cut'
    primary?: string
    secondary?: string
  } | null>(null)

  const [coveragePickerState, setCoveragePickerState] = useState<{
    index: number
    step: 'primary' | 'secondary'
    primary?: string
  } | null>(null)

  const [helpPickerState, setHelpPickerState] = useState<{ index: number } | null>(null)
  const [breakdownPickerState, setBreakdownPickerState] = useState<{ index: number } | null>(null)
  const [communicationPickerState, setCommunicationPickerState] = useState<{ index: number } | null>(null)
  const [outcomePickerState, setOutcomePickerState] = useState<{ index: number } | null>(null)

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    if (isOpen && clip) {
      setFormData({
        gameId: clip.gameId,
        gameScore: clip.gameScore,
        location: clip.location ?? clip.locationDisplay ?? clip.gameLocation,
        opponent: clip.opponent,
        quarter: clip.quarter,
        possession: clip.possession,
        situation: clip.situation,
        formation: clip.formation,
        playName: clip.playName,
        scoutCoverage: clip.scoutCoverage,
        playTrigger: clip.playTrigger,
        coverage: clip.coverage,
        disruption: clip.disruption,
        breakdown: clip.breakdown,
        playResult: clip.playResult,
        shooterDesignation: clip.shooterDesignation,
        paintTouches: clip.paintTouches,
        shotLocation: clip.shotLocation,
        shotContest: clip.shotContest,
        rebound: clip.rebound,
        points: clip.points,
        notes: clip.notes,
        actions: clip.actions ?? [],
      })
      setError(null)
    }
  }, [isOpen, clip])

  const handleChange = (field: keyof Clip, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleActionChange = (index: number, field: keyof TagAction, value: string) => {
    setFormData((prev) => {
      const actions = [...((prev.actions as TagAction[]) || [])]
      actions[index] = { ...actions[index], [field]: value }
      return { ...prev, actions }
    })
  }

  const handleAddAction = () => {
    setFormData((prev) => {
      const actions = [...((prev.actions as TagAction[]) || [])]
      actions.push({
        phase: '',
        type: '',
        coverage: '',
        help: '',
        breakdown: '',
        communication: '',
        outcome: '',
      })
      return { ...prev, actions }
    })
  }

  const handleRemoveAction = (index: number) => {
    setFormData((prev) => {
      const actions = [...((prev.actions as TagAction[]) || [])]
      actions.splice(index, 1)
      return { ...prev, actions }
    })
  }

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleInputFocus = (field: string, input: HTMLInputElement, actionIndex?: number) => {
    if (actionIndex === undefined) {
      // Regular field (not action)
      if (field in FIELD_OPTIONS) {
        setPickerState({ field, inputRef: input })
      }
      return
    }

    // Action field
    const actions = (formData.actions as TagAction[]) || []
    const action = actions[actionIndex]

    if (field === 'type') {
      const phaseValue = action?.phase?.toLowerCase() || ''
      if (phaseValue.includes('on-ball')) {
        setActionTypePickerState({ index: actionIndex, step: 'primary' })
        setPickerState({ field, inputRef: input, actionIndex })
      } else if (phaseValue.includes('dho')) {
        setActionTypePickerState({ index: actionIndex, step: 'dho' })
        setPickerState({ field, inputRef: input, actionIndex })
      } else if (phaseValue.includes('off-ball')) {
        setActionTypePickerState({ index: actionIndex, step: 'offball' })
        setPickerState({ field, inputRef: input, actionIndex })
      } else if (phaseValue.includes('cut')) {
        setActionTypePickerState({ index: actionIndex, step: 'cut' })
        setPickerState({ field, inputRef: input, actionIndex })
      }
    } else if (field === 'coverage') {
      const actionType = action?.type?.toLowerCase() || ''
      if (actionType.includes('iso')) {
        setCoveragePickerState({ index: actionIndex, step: 'primary' })
        setPickerState({ field, inputRef: input, actionIndex })
      } else {
        setCoveragePickerState({ index: actionIndex, step: 'primary' })
        setPickerState({ field, inputRef: input, actionIndex })
      }
    } else if (field === 'help') {
      setHelpPickerState({ index: actionIndex })
      setPickerState({ field, inputRef: input, actionIndex })
    } else if (field === 'breakdown') {
      setBreakdownPickerState({ index: actionIndex })
      setPickerState({ field, inputRef: input, actionIndex })
    } else if (field === 'communication') {
      setCommunicationPickerState({ index: actionIndex })
      setPickerState({ field, inputRef: input, actionIndex })
    } else if (field === 'outcome') {
      setOutcomePickerState({ index: actionIndex })
      setPickerState({ field, inputRef: input, actionIndex })
    } else if (field === 'phase') {
      setPickerState({ field, inputRef: input, actionIndex })
    }
  }

  const handlePickerSelect = (value: string) => {
    if (!pickerState.field || !pickerState.inputRef || pickerState.actionIndex === undefined) {
      // Regular field selection
      if (pickerState.field && pickerState.inputRef) {
        const currentValue = pickerState.inputRef.value
        const parts = currentValue.split(',').map((s) => s.trim()).filter(Boolean)
        parts.push(value)
        const newValue = parts.join(', ')
        handleChange(pickerState.field as keyof Clip, newValue)
        setTimeout(() => {
          if (pickerState.inputRef) {
            pickerState.inputRef.focus()
            pickerState.inputRef.selectionStart = pickerState.inputRef.selectionEnd = newValue.length
          }
        }, 0)
      }
      return
    }

    const index = pickerState.actionIndex

    // Action Type multi-level picker
    if (pickerState.field === 'type' && actionTypePickerState) {
      if (actionTypePickerState.step === 'primary') {
        const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === value)
        if (primaryNode?.secondary && primaryNode.secondary.length > 0) {
          setActionTypePickerState({ ...actionTypePickerState, step: 'secondary', primary: value })
        } else {
          handleActionChange(index, 'type', value)
          handlePickerClose()
        }
        return
      }
      if (actionTypePickerState.step === 'secondary') {
        const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === actionTypePickerState.primary)
        const tertiaryOptions = primaryNode?.tertiary?.[value]
        if (tertiaryOptions && tertiaryOptions.length > 0) {
          setActionTypePickerState({ ...actionTypePickerState, step: 'tertiary', secondary: value })
        } else {
          const formatted = `${actionTypePickerState.primary} / ${value}`
          handleActionChange(index, 'type', formatted)
          handlePickerClose()
        }
        return
      }
      if (actionTypePickerState.step === 'tertiary') {
        const formatted = `${actionTypePickerState.primary} / ${actionTypePickerState.secondary} / ${value}`
        handleActionChange(index, 'type', formatted)
        handlePickerClose()
        return
      }
      if (['dho', 'offball', 'cut'].includes(actionTypePickerState.step)) {
        handleActionChange(index, 'type', value)
        handlePickerClose()
        return
      }
    }

    // Coverage multi-level picker
    if (pickerState.field === 'coverage' && coveragePickerState) {
      const actions = (formData.actions as TagAction[]) || []
      const action = actions[coveragePickerState.index]
      const actionType = action?.type?.toLowerCase() || ''

      if (actionType.includes('iso')) {
        handleActionChange(index, 'coverage', value)
        handlePickerClose()
        return
      }

      if (coveragePickerState.step === 'primary') {
        const primaryNode = COVERAGE_ACTIONS.find((item) => item.label === value)
        if (primaryNode?.secondary && primaryNode.secondary.length > 0) {
          setCoveragePickerState({ ...coveragePickerState, step: 'secondary', primary: value })
        } else {
          handleActionChange(index, 'coverage', value)
          handlePickerClose()
        }
        return
      }
      if (coveragePickerState.step === 'secondary') {
        const formatted = `${coveragePickerState.primary} / ${value}`
        handleActionChange(index, 'coverage', formatted)
        handlePickerClose()
        return
      }
    }

    // Single-level pickers
    if (pickerState.field === 'help' || pickerState.field === 'breakdown' ||
        pickerState.field === 'communication' || pickerState.field === 'outcome' ||
        pickerState.field === 'phase') {
      const currentValue = pickerState.inputRef.value
      const parts = currentValue.split(',').map((s) => s.trim()).filter(Boolean)
      parts.push(value)
      const newValue = parts.join(', ')
      handleActionChange(index, pickerState.field as keyof TagAction, newValue)
      setTimeout(() => {
        if (pickerState.inputRef) {
          pickerState.inputRef.focus()
          pickerState.inputRef.selectionStart = pickerState.inputRef.selectionEnd = newValue.length
        }
      }, 0)
    }
  }

  const handlePickerClose = () => {
    setPickerState({ field: null, inputRef: null })
    setActionTypePickerState(null)
    setCoveragePickerState(null)
    setHelpPickerState(null)
    setBreakdownPickerState(null)
    setCommunicationPickerState(null)
    setOutcomePickerState(null)
  }

  const getInputProps = (field: string, actionIndex?: number) => {
    const actionFields = ['phase', 'type', 'coverage', 'help', 'breakdown', 'communication', 'outcome']
    const hasOptions = (field in FIELD_OPTIONS) || (actionIndex !== undefined && actionFields.includes(field))
    return hasOptions
      ? {
          onFocus: (e: React.FocusEvent<HTMLInputElement>) => handleInputFocus(field, e.target, actionIndex),
          onClick: (e: React.MouseEvent<HTMLInputElement>) =>
            handleInputFocus(field, e.target as HTMLInputElement, actionIndex),
          ref: (el: HTMLInputElement | null) => {
            const key = actionIndex !== undefined ? `${field}_${actionIndex}` : field
            inputRefs.current[key] = el
          },
        }
      : {
          ref: (el: HTMLInputElement | null) => {
            const key = actionIndex !== undefined ? `${field}_${actionIndex}` : field
            inputRefs.current[key] = el
          },
        }
  }

  const getPickerOptions = (): string[] => {
    if (!pickerState.field) return []

    // Regular fields
    if (pickerState.actionIndex === undefined) {
      return FIELD_OPTIONS[pickerState.field] || []
    }

    // Action fields
    const actions = (formData.actions as TagAction[]) || []
    const action = actions[pickerState.actionIndex]

    if (pickerState.field === 'phase') {
      return PHASE_OPTIONS
    }

    if (pickerState.field === 'type' && actionTypePickerState) {
      if (actionTypePickerState.step === 'primary') {
        return ON_BALL_ACTIONS.map((item) => item.label)
      }
      if (actionTypePickerState.step === 'secondary') {
        const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === actionTypePickerState.primary)
        return primaryNode?.secondary ?? []
      }
      if (actionTypePickerState.step === 'tertiary') {
        const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === actionTypePickerState.primary)
        return primaryNode?.tertiary?.[actionTypePickerState.secondary ?? ''] ?? []
      }
      if (actionTypePickerState.step === 'dho') {
        return DHO_ACTIONS
      }
      if (actionTypePickerState.step === 'offball') {
        return OFF_BALL_ACTIONS
      }
      if (actionTypePickerState.step === 'cut') {
        return CUT_ACTIONS
      }
    }

    if (pickerState.field === 'coverage' && coveragePickerState) {
      const actionType = action?.type?.toLowerCase() || ''
      if (actionType.includes('iso')) {
        return ISO_COVERAGE_OPTIONS
      }
      if (coveragePickerState.step === 'primary') {
        return COVERAGE_ACTIONS.map((item) => item.label)
      }
      if (coveragePickerState.step === 'secondary') {
        const primaryNode = COVERAGE_ACTIONS.find((item) => item.label === coveragePickerState.primary)
        return primaryNode?.secondary ?? []
      }
    }

    if (pickerState.field === 'help' && helpPickerState) {
      return HELP_ACTIONS
    }

    if (pickerState.field === 'breakdown' && breakdownPickerState) {
      return BREAKDOWN_ACTIONS
    }

    if (pickerState.field === 'communication' && communicationPickerState) {
      return COMMUNICATION_ACTIONS
    }

    if (pickerState.field === 'outcome' && outcomePickerState) {
      return OUTCOME_ACTIONS
    }

    return []
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      console.log('[DEBUG] ClipEditModal formData being saved:', formData)
      await onSave(clip.id, formData)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save clip')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="clip-edit-overlay" onClick={onClose} />
      <div className="clip-edit-modal">
        <div className="clip-edit-header">
          <div>
            <h3 className="clip-edit-title">Edit Clip</h3>
            <p className="clip-edit-subtitle">
              {clip.gameId} • {clip.opponent}
            </p>
          </div>
          <button type="button" onClick={onClose} className="clip-edit-close">
            ✕
          </button>
        </div>

        <div className="clip-edit-content">
          {error && <div className="clip-edit-error">{error}</div>}

          {/* 📋 Context & Identifiers */}
          <div className={`clip-edit-section ${expandedSections.context ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('context')}>
              <span>📋 Context & Identifiers</span>
              <span className="clip-edit-toggle">{expandedSections.context ? '−' : '+'}</span>
            </h4>
            {expandedSections.context && (
              <div className="clip-edit-grid">
                <div className="clip-edit-field">
                  <label>Game #</label>
                  <input
                    type="text"
                    value={formData.gameId ?? ''}
                    onChange={(e) => handleChange('gameId', e.target.value)}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location ?? ''}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="Home / Away / Neutral"
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Opponent</label>
                  <input
                    type="text"
                    value={formData.opponent ?? ''}
                    onChange={(e) => handleChange('opponent', e.target.value)}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Game Score</label>
                  <input
                    type="text"
                    value={formData.gameScore ?? ''}
                    onChange={(e) => handleChange('gameScore', e.target.value)}
                    placeholder="e.g., 75-68 W"
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Quarter</label>
                  <input
                    type="text"
                    value={formData.quarter ?? ''}
                    onChange={(e) => handleChange('quarter', e.target.value)}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Possession #</label>
                  <input
                    type="text"
                    value={formData.possession ?? ''}
                    onChange={(e) => handleChange('possession', e.target.value)}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Situation</label>
                  <input
                    type="text"
                    value={formData.situation ?? ''}
                    onChange={(e) => handleChange('situation', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('situation')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🎯 Play & Actions */}
          <div className={`clip-edit-section ${expandedSections.playActions ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('playActions')}>
              <span>🎯 Play & Actions</span>
              <span className="clip-edit-toggle">{expandedSections.playActions ? '−' : '+'}</span>
            </h4>
            {expandedSections.playActions && (
              <div className="clip-edit-grid">
                <div className="clip-edit-field clip-edit-field-full">
                  <label>Offensive Formation</label>
                  <input
                    type="text"
                    value={formData.formation ?? ''}
                    onChange={(e) => handleChange('formation', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('formation')}
                  />
                </div>
                <div className="clip-edit-field clip-edit-field-full">
                  <label>Play Name</label>
                  <input
                    type="text"
                    value={formData.playName ?? ''}
                    onChange={(e) => handleChange('playName', e.target.value)}
                    placeholder="e.g., Elbow, Stack, Zoom"
                  />
                </div>
                <div className="clip-edit-field clip-edit-field-full">
                  <label>Covered in Scout?</label>
                  <input
                    type="text"
                    value={formData.scoutCoverage ?? ''}
                    onChange={(e) => handleChange('scoutCoverage', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('scoutCoverage')}
                  />
                </div>
                <div className="clip-edit-field clip-edit-field-full">
                  <label>Play Trigger</label>
                  <input
                    type="text"
                    value={formData.playTrigger ?? ''}
                    onChange={(e) => handleChange('playTrigger', e.target.value)}
                    placeholder="e.g., Entry, DHO, Ball Screen"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🛡️ Defensive Coverage */}
          <div className={`clip-edit-section ${expandedSections.defensive ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('defensive')}>
              <span>🛡️ Defensive Coverage</span>
              <span className="clip-edit-toggle">{expandedSections.defensive ? '−' : '+'}</span>
            </h4>
            {expandedSections.defensive && (
              <div className="clip-edit-grid">
                <div className="clip-edit-field">
                  <label>Defensive Coverage</label>
                  <input
                    type="text"
                    value={formData.coverage ?? ''}
                    onChange={(e) => handleChange('coverage', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('coverage')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Defensive Disruption</label>
                  <input
                    type="text"
                    value={formData.disruption ?? ''}
                    onChange={(e) => handleChange('disruption', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('disruption')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Defensive Breakdown</label>
                  <input
                    type="text"
                    value={formData.breakdown ?? ''}
                    onChange={(e) => handleChange('breakdown', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('breakdown')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 🏀 Shot Data */}
          <div className={`clip-edit-section ${expandedSections.shotData ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('shotData')}>
              <span>🏀 Shot Data</span>
              <span className="clip-edit-toggle">{expandedSections.shotData ? '−' : '+'}</span>
            </h4>
            {expandedSections.shotData && (
              <div className="clip-edit-grid">
                <div className="clip-edit-field">
                  <label>Play Result</label>
                  <input
                    type="text"
                    value={formData.playResult ?? ''}
                    onChange={(e) => handleChange('playResult', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('playResult')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Paint Touches</label>
                  <input
                    type="text"
                    value={formData.paintTouches ?? ''}
                    onChange={(e) => handleChange('paintTouches', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('paintTouches')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Shooter Designation</label>
                  <input
                    type="text"
                    value={formData.shooterDesignation ?? ''}
                    onChange={(e) => handleChange('shooterDesignation', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('shooterDesignation')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Shot Location</label>
                  <input
                    type="text"
                    value={formData.shotLocation ?? ''}
                    onChange={(e) => handleChange('shotLocation', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('shotLocation')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Shot Contest</label>
                  <input
                    type="text"
                    value={formData.shotContest ?? ''}
                    onChange={(e) => handleChange('shotContest', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('shotContest')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Rebound Outcome</label>
                  <input
                    type="text"
                    value={formData.rebound ?? ''}
                    onChange={(e) => handleChange('rebound', e.target.value)}
                    placeholder="Click to select or type..."
                    {...getInputProps('rebound')}
                  />
                </div>
                <div className="clip-edit-field">
                  <label>Points</label>
                  <input
                    type="number"
                    value={formData.points ?? ''}
                    onChange={(e) => handleChange('points', e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ⚡ Actions */}
          <div className={`clip-edit-section ${expandedSections.actions ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('actions')}>
              <span>⚡ Actions ({((formData.actions as TagAction[]) || []).length})</span>
              <span className="clip-edit-toggle">{expandedSections.actions ? '−' : '+'}</span>
            </h4>
            {expandedSections.actions && (
              <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                {((formData.actions as TagAction[]) || []).map((action, index) => (
                  <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < ((formData.actions as TagAction[]) || []).length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none' }}>
                    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)' }}>
                        Action {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAction(index)}
                        style={{
                          background: '#dc2626',
                          border: 'none',
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="clip-edit-grid">
                      <div className="clip-edit-field">
                        <label>Phase</label>
                        <input
                          type="text"
                          value={action.phase || ''}
                          onChange={(e) => handleActionChange(index, 'phase', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('phase', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Type</label>
                        <input
                          type="text"
                          value={action.type || ''}
                          onChange={(e) => handleActionChange(index, 'type', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('type', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Coverage</label>
                        <input
                          type="text"
                          value={action.coverage || ''}
                          onChange={(e) => handleActionChange(index, 'coverage', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('coverage', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Help</label>
                        <input
                          type="text"
                          value={action.help || ''}
                          onChange={(e) => handleActionChange(index, 'help', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('help', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Breakdown</label>
                        <input
                          type="text"
                          value={action.breakdown || ''}
                          onChange={(e) => handleActionChange(index, 'breakdown', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('breakdown', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Communication</label>
                        <input
                          type="text"
                          value={action.communication || ''}
                          onChange={(e) => handleActionChange(index, 'communication', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('communication', index)}
                        />
                      </div>
                      <div className="clip-edit-field">
                        <label>Outcome</label>
                        <input
                          type="text"
                          value={action.outcome || ''}
                          onChange={(e) => handleActionChange(index, 'outcome', e.target.value)}
                          placeholder="Click to select..."
                          {...getInputProps('outcome', index)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddAction}
                  style={{
                    width: '100%',
                    background: 'rgba(132, 22, 23, 0.2)',
                    border: '1px dashed rgba(132, 22, 23, 0.5)',
                    color: 'rgba(255,255,255,0.9)',
                    padding: '12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  + Add Action
                </button>
              </div>
            )}
          </div>

          {/* 📝 Notes */}
          <div className={`clip-edit-section ${expandedSections.notes ? '' : 'collapsed'}`}>
            <h4 className="clip-edit-section-title" onClick={() => toggleSection('notes')}>
              <span>📝 Notes</span>
              <span className="clip-edit-toggle">{expandedSections.notes ? '−' : '+'}</span>
            </h4>
            {expandedSections.notes && (
              <div className="clip-edit-grid">
                <div className="clip-edit-field clip-edit-field-full">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes ?? ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    placeholder="Add any additional notes or observations..."
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="clip-edit-footer">
          <div className="flex gap-2">
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(clip.id)}
                className="clip-edit-btn clip-edit-btn-delete"
                disabled={saving}
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="clip-edit-btn clip-edit-btn-cancel" disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="clip-edit-btn clip-edit-btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {pickerState.field && pickerState.inputRef && (
        <FloatingPicker
          inputRef={pickerState.inputRef}
          options={getPickerOptions()}
          isOpen={true}
          onSelect={handlePickerSelect}
          onClose={handlePickerClose}
          highlightRule={
            pickerState.field === 'type' && actionTypePickerState
              ? (option) => {
                  if (actionTypePickerState.step === 'primary') {
                    const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === option)
                    return Boolean(primaryNode?.secondary && primaryNode.secondary.length > 0)
                  }
                  if (actionTypePickerState.step === 'secondary') {
                    const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === actionTypePickerState.primary)
                    return Boolean(primaryNode?.tertiary?.[option]?.length)
                  }
                  return false
                }
              : pickerState.field === 'coverage' && coveragePickerState
              ? (option) => {
                  const actions = (formData.actions as TagAction[]) || []
                  const action = actions[coveragePickerState.index]
                  const actionType = action?.type?.toLowerCase() || ''
                  if (actionType.includes('iso')) {
                    return false
                  }
                  if (coveragePickerState.step === 'primary') {
                    const primaryNode = COVERAGE_ACTIONS.find((item) => item.label === option)
                    return Boolean(primaryNode?.secondary && primaryNode.secondary.length > 0)
                  }
                  return false
                }
              : undefined
          }
        />
      )}
    </>
  )
}

export default ClipEditModal
