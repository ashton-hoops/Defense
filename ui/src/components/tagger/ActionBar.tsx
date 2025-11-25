import { useRef, useState } from 'react'
import type { TagAction } from '../../lib/types'
import { FloatingPicker } from './FloatingPicker'

type ActionBarProps = {
  actions: TagAction[]
  onActionChange: (index: number, key: keyof TagAction, value: string) => void
  onAddAction: () => void
  onRemoveAction: (index: number) => void
}

const PHASE_OPTIONS = ['On-Ball', 'Off-Ball', 'DHO', 'CUT']
const ON_BALL_ACTIONS = [
  {
    label: 'ISO',
  },
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
  {
    label: 'Slip Screen',
    secondary: ['Middle', 'Side'],
  },
  {
    label: 'Ghost Screen',
    secondary: ['Middle', 'Side'],
  },
  {
    label: 'Gortat Screen',
    secondary: ['Seal', 'Cross'],
  },
  {
    label: 'Flip Ball Screen',
    secondary: ['Middle', 'Side'],
  },
  {
    label: 'Drag Screen',
    secondary: ['Drag', 'Double Drag'],
    tertiary: {
      Drag: ['Standard', 'Flat', 'Angle'],
      'Double Drag': ['Standard', 'Flat', 'Angle'],
    },
  },
  {
    label: 'Twist / Re-Screen',
    secondary: ['Standard', 'Angle'],
  },
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
const OUTCOME_ACTIONS = [
  'Contained',
  'Advantage Created',
  'Forced Help',
  'Other',
]

const ACTION_PICKER_FIELDS: Partial<Record<keyof TagAction, string[]>> = {
  phase: PHASE_OPTIONS,
}

const tokenizeValue = (value: string) =>
  value
    .split(/[,+]/)
    .map((part) => part.trim())
    .filter(Boolean)

const appendSelection = (current: string, addition: string) => {
  const additionTrimmed = addition.trim()
  if (!additionTrimmed) {
    const existing = tokenizeValue(current)
    return existing.join(', ')
  }

  const tokens = tokenizeValue(current)
  if (!tokens.includes(additionTrimmed)) {
    tokens.push(additionTrimmed)
  }
  return tokens.join(', ')
}

const ActionField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-0.5 text-[9px] uppercase tracking-[0.18em] text-white/60">
    <span>{label}</span>
    {children}
  </label>
)

const baseInputClasses =
  'tag-input w-full rounded-lg border border-[#363636] bg-[#252525] px-2 py-1 text-[0.78rem] text-[#faf9f6] placeholder:text-[0.72rem] placeholder:text-white/35 focus:border-[#841617] focus:shadow-[0_0_0_2px_rgba(132,22,23,0.24)] focus:outline-none'

export const ActionBar = ({ actions, onActionChange, onAddAction, onRemoveAction }: ActionBarProps) => {
  const handleChange =
    (index: number, key: keyof TagAction) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      onActionChange(index, key, event.target.value)
    }

  const pickerInputRef = useRef<HTMLInputElement | null>(null)
  const [pickerState, setPickerState] = useState<{ index: number; field: keyof TagAction | null }>({ index: -1, field: null })
  const [actionTypePickerState, setActionTypePickerState] = useState<{
    index: number
    step: 'primary' | 'secondary' | 'tertiary' | 'dho' | 'offball'
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

  const openPicker = (field: keyof TagAction, index: number, input: HTMLInputElement | null) => {
    if (field === 'type') {
      const phaseValue = actions[index]?.phase?.toLowerCase() || ''
      if (phaseValue.includes('on-ball')) {
        pickerInputRef.current = input
        setActionTypePickerState({ index, step: 'primary' })
        setPickerState({ field, index })
        return
      } else if (phaseValue.includes('dho')) {
        pickerInputRef.current = input
        setActionTypePickerState({ index, step: 'dho' })
        setPickerState({ field, index })
        return
      } else if (phaseValue.includes('off-ball')) {
        pickerInputRef.current = input
        setActionTypePickerState({ index, step: 'offball' })
        setPickerState({ field, index })
        return
      }
      pickerInputRef.current = input
      setPickerState({ field, index })
      return
    } else if (field === 'coverage') {
      const actionType = actions[index]?.type?.toLowerCase() || ''
      if (actionType.includes('iso')) {
        // ISO uses simplified coverage options
        pickerInputRef.current = input
        setCoveragePickerState({ index, step: 'primary' })
        setPickerState({ field, index })
        return
      }
      pickerInputRef.current = input
      setCoveragePickerState({ index, step: 'primary' })
      setPickerState({ field, index })
      return
    } else if (field === 'help') {
      pickerInputRef.current = input
      setHelpPickerState({ index })
      setPickerState({ field, index })
      return
    } else if (field === 'breakdown') {
      pickerInputRef.current = input
      setBreakdownPickerState({ index })
      setPickerState({ field, index })
      return
    } else if (field === 'communication') {
      pickerInputRef.current = input
      setCommunicationPickerState({ index })
      setPickerState({ field, index })
      return
    } else if (field === 'outcome') {
      pickerInputRef.current = input
      setOutcomePickerState({ index })
      setPickerState({ field, index })
      return
    }

    if (!ACTION_PICKER_FIELDS[field]) return
    pickerInputRef.current = input
    setPickerState({ field, index })
  }

  const closePicker = () => {
    pickerInputRef.current = null
    setPickerState({ field: null, index: -1 })
    setActionTypePickerState(null)
    setCoveragePickerState(null)
    setHelpPickerState(null)
    setBreakdownPickerState(null)
    setCommunicationPickerState(null)
    setOutcomePickerState(null)
  }

  const getLiveFieldValue = (field: keyof TagAction, index: number) => {
    if (pickerInputRef.current && pickerState.field === field && pickerState.index === index) {
      return pickerInputRef.current.value
    }
    return actions[index]?.[field] ?? ''
  }

  const handleSeparatorKey =
    (field: keyof TagAction, index: number) =>
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== ',' && event.key !== '+') return
      event.preventDefault()
      const input = event.currentTarget
      const current = input.value
      let nextValue = current
      if (!current) {
        nextValue = ''
      } else if (current.endsWith(', ') || current.endsWith('+ ')) {
        nextValue = current
      } else if (/[,+]\s*$/.test(current)) {
        nextValue = current.replace(/[,+]\s*$/, ', ')
      } else {
        nextValue = current + ', '
      }
      onActionChange(index, field, nextValue)
      setTimeout(() => openPicker(field, index, input), 0)
    }
  
  const getActionTypeOptions = () => {
    if (!actionTypePickerState) return []
    const { step, primary, secondary } = actionTypePickerState

    if (step === 'primary') {
      return ON_BALL_ACTIONS.map((item) => item.label)
    }

    if (step === 'dho') {
      return DHO_ACTIONS
    }

    if (step === 'offball') {
      return OFF_BALL_ACTIONS
    }

    const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === primary)
    if (!primaryNode) return []

    if (step === 'secondary') {
      return primaryNode.secondary ?? []
    }

    if (step === 'tertiary' && secondary && primaryNode.tertiary) {
      return primaryNode.tertiary[secondary] ?? []
    }

    return []
  }

  const pickerOptions = () => {
    if (!pickerState.field) return []
    if (pickerState.field === 'type' && actionTypePickerState) {
      return getActionTypeOptions()
    }
    if (pickerState.field === 'coverage' && coveragePickerState) {
      // Check if this action is an ISO
      const actionType = actions[coveragePickerState.index]?.type?.toLowerCase() || ''
      if (actionType.includes('iso')) {
        return ISO_COVERAGE_OPTIONS
      }

      if (coveragePickerState.step === 'primary') {
        return COVERAGE_ACTIONS.map((item) => item.label)
      }
      const primaryNode = COVERAGE_ACTIONS.find((item) => item.label === coveragePickerState.primary)
      return primaryNode?.secondary ?? []
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
    return ACTION_PICKER_FIELDS[pickerState.field] ?? []
  }

  const commitActionTypeSelection = (index: number, selections: string[]) => {
    const formatted = selections.filter(Boolean).join(' / ')
    const currentValue = getLiveFieldValue('type', index)
    const nextValue = appendSelection(currentValue, formatted)
    onActionChange(index, 'type', nextValue)
    closePicker()
  }

  const commitCoverageSelection = (index: number, selections: string[]) => {
    const formatted = selections.filter(Boolean).join(' / ')
    const current = getLiveFieldValue('coverage', index)
    const nextValue = appendSelection(current, formatted)
    onActionChange(index, 'coverage', nextValue)
    closePicker()
  }

  const commitHelpSelection = (index: number, value: string) => {
    const current = getLiveFieldValue('help', index)
    const nextValue = appendSelection(current, value)
    onActionChange(index, 'help', nextValue)
    closePicker()
  }

  const commitBreakdownSelection = (index: number, value: string) => {
    const current = getLiveFieldValue('breakdown', index)
    const nextValue = appendSelection(current, value)
    onActionChange(index, 'breakdown', nextValue)
    closePicker()
  }

  const commitCommunicationSelection = (index: number, value: string) => {
    const current = getLiveFieldValue('communication', index)
    const nextValue = appendSelection(current, value)
    onActionChange(index, 'communication', nextValue)
    closePicker()
  }

  const commitOutcomeSelection = (index: number, value: string) => {
    const current = getLiveFieldValue('outcome', index)
    const nextValue = appendSelection(current, value)
    onActionChange(index, 'outcome', nextValue)
    closePicker()
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-3 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/60">Actions</p>
        <button
          type="button"
          onClick={onAddAction}
          className="rounded-md border border-[#2d2d2d] bg-[#1f1f1f] px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white transition hover:border-[#841617]"
        >
          + Add Action
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/20 px-3 py-1.5 text-center text-[10px] text-white/60">
          No actions yet. Click “+ Add Action” to document on/off-ball phases within this possession.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {actions.map((action, index) => (
            <div
              key={`action-${index}`}
              className="flex flex-col gap-2 rounded-lg border border-[#2a2a2a] bg-[#191919]/85 p-2"
              style={{ maxWidth: '420px' }}
            >
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/55">Action {index + 1}</div>

              <ActionField label="Phase">
                <input
                  value={action.phase}
                  onChange={handleChange(index, 'phase')}
                  placeholder="On-Ball / Off-Ball"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('phase', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('phase', index)}
                />
              </ActionField>

              <ActionField label="Action Type">
                <input
                  value={action.type}
                  onChange={handleChange(index, 'type')}
                  placeholder="Flare / Stagger / Post"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('type', index, e.currentTarget)}
                  onClick={(e) => openPicker('type', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('type', index)}
                />
              </ActionField>

              <ActionField label="Coverage">
                <input
                  value={action.coverage}
                  onChange={handleChange(index, 'coverage')}
                  placeholder="Over+Drop / Switch"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('coverage', index, e.currentTarget)}
                  onClick={(e) => openPicker('coverage', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('coverage', index)}
                />
              </ActionField>

              <ActionField label="Help">
                <input
                  value={action.help}
                  onChange={handleChange(index, 'help')}
                  placeholder="Low-Man / X-Out"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('help', index, e.currentTarget)}
                  onClick={(e) => openPicker('help', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('help', index)}
                />
              </ActionField>

              <ActionField label="Breakdown">
                <input
                  value={action.breakdown}
                  onChange={handleChange(index, 'breakdown')}
                  placeholder="None / Late Help"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('breakdown', index, e.currentTarget)}
                  onClick={(e) => openPicker('breakdown', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('breakdown', index)}
                />
              </ActionField>

              <ActionField label="Communication">
                <input
                  value={action.communication}
                  onChange={handleChange(index, 'communication')}
                  placeholder="Call / Hand Signal"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('communication', index, e.currentTarget)}
                  onClick={(e) => openPicker('communication', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('communication', index)}
                />
              </ActionField>

              <ActionField label="Action Outcome">
                <input
                  value={action.outcome}
                  onChange={handleChange(index, 'outcome')}
                  placeholder="Contained / Advantage Created / Forced Help"
                  className={baseInputClasses}
                  onFocus={(e) => openPicker('outcome', index, e.currentTarget)}
                  onClick={(e) => openPicker('outcome', index, e.currentTarget)}
                  onKeyDown={handleSeparatorKey('outcome', index)}
                />
              </ActionField>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => onRemoveAction(index)}
                  disabled={actions.length === 1}
                  className="rounded-md border border-transparent px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-[#ff4d4f] hover:text-[#ff4d4f] disabled:cursor-not-allowed disabled:text-white/20"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FloatingPicker
        inputRef={pickerInputRef.current}
        options={pickerOptions()}
        isOpen={Boolean(pickerState.field)}
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
                // Check if this is an ISO action - no highlights needed for ISO coverage
                const actionType = actions[coveragePickerState.index]?.type?.toLowerCase() || ''
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
        onSelect={(value) => {
          if (!pickerState.field) return

          if (pickerState.field === 'type' && actionTypePickerState) {
            if (actionTypePickerState.step === 'primary') {
              const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === value)
              if (primaryNode?.secondary && primaryNode.secondary.length > 0) {
                setActionTypePickerState({ index: pickerState.index, step: 'secondary', primary: value })
              } else {
                commitActionTypeSelection(pickerState.index, [value])
              }
              return
            }

            if (actionTypePickerState.step === 'secondary') {
              const primaryNode = ON_BALL_ACTIONS.find((item) => item.label === actionTypePickerState.primary)
              const tertiaryOptions = primaryNode?.tertiary?.[value]
              if (tertiaryOptions && tertiaryOptions.length > 0) {
                setActionTypePickerState({
                  index: pickerState.index,
                  step: 'tertiary',
                  primary: actionTypePickerState.primary,
                  secondary: value,
                })
              } else {
                commitActionTypeSelection(pickerState.index, [actionTypePickerState.primary ?? '', value])
              }
              return
            }

            if (actionTypePickerState.step === 'tertiary') {
              commitActionTypeSelection(pickerState.index, [
                actionTypePickerState.primary ?? '',
                actionTypePickerState.secondary ?? '',
                value,
              ])
              return
            }

            if (actionTypePickerState.step === 'dho') {
              commitActionTypeSelection(pickerState.index, [value])
              return
            }
            if (actionTypePickerState.step === 'offball') {
              commitActionTypeSelection(pickerState.index, [value])
              return
            }
          } else {
            if (pickerState.field === 'coverage' && coveragePickerState) {
              // Check if this is an ISO action
              const actionType = actions[coveragePickerState.index]?.type?.toLowerCase() || ''
              if (actionType.includes('iso')) {
                // For ISO, just commit the single selection
                commitCoverageSelection(pickerState.index, [value])
                return
              }

              if (coveragePickerState.step === 'primary') {
                const primaryNode = COVERAGE_ACTIONS.find((item) => item.label === value)
                if (primaryNode?.secondary && primaryNode.secondary.length > 0) {
                  setCoveragePickerState({ index: pickerState.index, step: 'secondary', primary: value })
                } else {
                  commitCoverageSelection(pickerState.index, [value])
                }
                return
              }
              if (coveragePickerState.step === 'secondary') {
                commitCoverageSelection(pickerState.index, [coveragePickerState.primary ?? '', value])
                return
              }
            }

            if (pickerState.field === 'help' && helpPickerState) {
              commitHelpSelection(pickerState.index, value)
              return
            }
            if (pickerState.field === 'breakdown' && breakdownPickerState) {
              commitBreakdownSelection(pickerState.index, value)
              return
            }
            if (pickerState.field === 'communication' && communicationPickerState) {
              commitCommunicationSelection(pickerState.index, value)
              return
            }
            if (pickerState.field === 'outcome' && outcomePickerState) {
              commitOutcomeSelection(pickerState.index, value)
              return
            }

            const currentValue = getLiveFieldValue(pickerState.field, pickerState.index)
            const nextValue = appendSelection(currentValue, value)
            onActionChange(pickerState.index, pickerState.field, nextValue)

            setTimeout(() => {
              if (pickerInputRef.current) {
                pickerInputRef.current.focus()
                pickerInputRef.current.selectionStart = pickerInputRef.current.selectionEnd = nextValue.length
              }
            }, 0)
          }
        }}
        onClose={closePicker}
      />
    </div>
  )
}
