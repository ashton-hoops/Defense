import { useRef, useState, useEffect } from 'react'
import { ShotChart } from './ShotChart'
import { ActionBar } from './ActionBar'
import type { ParsedPossession, ShooterDesignationLists, TagAction } from '../../lib/types'

type RawPossession = {
  num: number
  start: string
  end: string
  action: string
  result: string
  endDesc: string
  shotDesc?: string | null
}

type ShooterDesignationSets = {
  bluePerimeter: Set<string>
  bluePost: Set<string>
  green: Set<string>
}

const normalizeNameKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseNameList = (raw: string): string[] => {
  if (!raw) return []
  return raw
    .split(/[\n,]+/)
    .map((name) => normalizeNameKey(name))
    .filter(Boolean)
}

const addNameVariants = (set: Set<string>, name: string) => {
  if (!name) return
  set.add(name)
  const parts = name.split(' ')
  if (parts.length > 1) {
    set.add(parts[parts.length - 1])
  }
}

const buildDesignationSets = (lists: ShooterDesignationLists): ShooterDesignationSets => {
  const bluePerimeter = new Set<string>()
  const bluePost = new Set<string>()
  const green = new Set<string>()

  parseNameList(lists.bluePerimeter).forEach((name) => addNameVariants(bluePerimeter, name))
  parseNameList(lists.bluePost).forEach((name) => addNameVariants(bluePost, name))
  parseNameList(lists.green).forEach((name) => addNameVariants(green, name))

  return { bluePerimeter, bluePost, green }
}

const ACTION_TOKEN = /(made|missed|turnover|steal|stole|blocked|block|foul|jumper|layup|dunk|hook|tip-in|tip in|runner|floater|driving|banked|putback|shot|three|3-point|3pt)/i

const extractPlayerName = (desc?: string | null): string | null => {
  if (!desc) return null
  const cleaned = desc.replace(/\([^)]*\)/g, '').trim()
  const match = cleaned.match(ACTION_TOKEN)
  if (!match || match.index === undefined) return null
  const candidate = cleaned.slice(0, match.index).trim()
  if (!candidate) return null
  return candidate
}

const extractNameFromResultLabel = (label: string): string | null => {
  if (!label) return null
  const tokens = label.trim().split(/\s+/)
  if (tokens.length < 2) return null
  const last = tokens[tokens.length - 1]
  if (/^(?:\d+|ft|to\??)$/i.test(last)) {
    return tokens.slice(0, -1).join(' ')
  }
  return null
}

const summarizeShotDesc = (desc?: string | null): string | null => {
  if (!desc) return null
  const name = extractPlayerName(desc)
  const trimmed = desc.replace(/\s+/g, ' ').trim().replace(/[.]+$/, '')
  if (!name) return trimmed
  let action = trimmed.slice(trimmed.indexOf(name) + name.length).trim()
  action = action.replace(/\bthree point\b/gi, '3pt')
  action = action.replace(/\s+assisted by.+$/i, '').trim()
  if (!action) return name
  return `${name} ${action.charAt(0).toUpperCase()}${action.slice(1)}`
}

const shortenName = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] || name
}

const abbreviateLabel = (label: string) => {
  if (!label) return label
  let formatted = label
    .replace(/Opponent/gi, 'OPP')
    .replace(/Defensive/gi, 'D')
    .replace(/Dead[-\s]?ball/gi, 'Dead')
    .replace(/Turnover/gi, 'TO')
    .replace(/Jump Ball/gi, 'Jump')
    .replace(/\?/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const name = extractNameFromResultLabel(formatted)
  if (name) {
    formatted = formatted.replace(name, shortenName(name))
  }

  return formatted
}

const formatShotSummaryShort = (summary?: string | null, shooterName?: string) => {
  if (!summary) return null
  const name = shooterName ? shortenName(shooterName) : shortenName(summary.split(' ')[0])
  let rest = summary
  if (shooterName) {
    const escaped = shooterName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    rest = rest.replace(new RegExp(`^${escaped}\\s+`, 'i'), '')
  }
  rest = rest
    .replace(/\bmissed\b/gi, 'Miss')
    .replace(/\bmade\b/gi, 'Make')
    .replace(/\bthree point\b/gi, '3pt')
    .replace(/\b3 point\b/gi, '3pt')
    .replace(/\bjumper\b/gi, '')
    .replace(/\blayup\b/gi, '')
    .replace(/\bdunk\b/gi, '')
    .replace(/\bfree throw\b/gi, 'FT')
    .replace(/\bturnover\b/gi, 'TO')
    .replace(/\s+assisted.+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return `${name} ${rest}`.trim()
}

const determineShooterDesignation = (name: string | null, sets: ShooterDesignationSets): string | undefined => {
  if (!name) return undefined
  const normalized = normalizeNameKey(name)
  if (normalized && sets.bluePerimeter.has(normalized)) return 'Blue (Perimeter)'
  if (normalized && sets.bluePost.has(normalized)) return 'Blue (Post)'
  if (normalized && sets.green.has(normalized)) return 'Green'
  return undefined
}

const mapShooterDesignationToPlayer = (designation?: string): string | undefined => {
  if (!designation) return undefined
  const lower = designation.toLowerCase()
  if (lower.startsWith('blue')) return 'primary'
  if (lower.startsWith('green')) return 'shooter'
  return 'role'
}

const parseClockSeconds = (clock: string): number | null => {
  if (!clock) return null
  const parts = clock.split(':').map((part) => Number(part))
  if (parts.some((value) => Number.isNaN(value))) return null
  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }
  return null
}

const formatQuarterLabel = (breakIndex: number): string => {
  const quarterNumber = breakIndex + 1
  const suffix = (value: number) => {
    if (value % 100 >= 11 && value % 100 <= 13) return 'th'
    switch (value % 10) {
      case 1:
        return 'st'
      case 2:
        return 'nd'
      case 3:
        return 'rd'
      default:
        return 'th'
    }
  }
  if (quarterNumber <= 4) {
    return `${quarterNumber}${suffix(quarterNumber)} Quarter`
  }
  const overtimeIndex = quarterNumber - 4
  return overtimeIndex === 1 ? 'Overtime' : `OT ${overtimeIndex}`
}


type PbpPaneProps = {
  opponent: string
  pbpText?: string
  onPbpTextChange?: (text: string) => void
  designationLists: ShooterDesignationLists
  onDesignationListsChange?: (lists: ShooterDesignationLists) => void
  onPossessionsChange?: (possessions: ParsedPossession[]) => void
  shotX?: string
  shotY?: string
  shotResult?: string
  playerDesignation?: string
  onShotDataChange?: (data: {
    shotX: string
    shotY: string
    shotResult: string
    playerDesignation: string
  }) => void
  actions: TagAction[]
  onActionChange: (index: number, key: keyof TagAction, value: string) => void
  onAddAction: () => void
  onRemoveAction: (index: number) => void
}

export const PbpPane = ({
  opponent,
  pbpText = '',
  onPbpTextChange,
  designationLists,
  onDesignationListsChange,
  onPossessionsChange,
  shotX = '',
  shotY = '',
  shotResult = '',
  playerDesignation = '',
  onShotDataChange,
  actions,
  onActionChange,
  onAddAction,
  onRemoveAction,
}: PbpPaneProps) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'actions' | 'shot'>('filter')
  const rawPossessionsRef = useRef<RawPossession[]>([])
  const sourcePbpRef = useRef<string>('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMessage) return
    const timeout = setTimeout(() => setStatusMessage(null), 2500)
    return () => clearTimeout(timeout)
  }, [statusMessage])

  const handlePbpTextChange = (text: string) => {
    if (onPbpTextChange) {
      onPbpTextChange(text)
    }
  }

  const handleDesignationInputChange = (field: keyof ShooterDesignationLists, value: string) => {
    if (onDesignationListsChange) {
      onDesignationListsChange({
        ...designationLists,
        [field]: value,
      })
    }
  }

  const derivePossessionTags = (
    resultLabel: string,
    endDesc: string,
    shotDesc: string | null | undefined,
    designationSets: ShooterDesignationSets,
  ) => {
    const lowerResult = resultLabel.toLowerCase()
    const lowerDesc = endDesc.toLowerCase()

    let playResult: string | undefined
    let points: number | undefined
    let reboundOutcome: string | undefined
    let shotResultValue: string | undefined
    let hasShot: 'Yes' | 'No' | undefined
    let shooterName: string | undefined
    let shooterDesignation: string | undefined
    let playerDesignation: string | undefined

    const isMake = /\b3\b/.test(resultLabel) || /\b2\b/.test(resultLabel)
    const isDReb = lowerResult.includes('dreb')
    const isOReb = lowerResult.includes('oreb')
    const isSteal = lowerResult.includes('steal') || lowerDesc.includes('steal')
    const isTurnover = lowerResult.includes('to') || lowerDesc.includes('turnover')
    const isShotClock = lowerDesc.includes('shot clock')
    const isDeflection = lowerDesc.includes('deflection')
    const isReachIn = lowerDesc.includes('reach-in') || lowerDesc.includes('reach in')
    const isLooseBall = lowerDesc.includes('loose-ball') || lowerDesc.includes('loose ball')
    const isOffBallFoul = lowerDesc.includes('offensive foul') || lowerDesc.includes('illegal screen')
    const isGeneralFoul = lowerDesc.includes('foul')
    const isFreeThrow = lowerDesc.includes('free throw') || lowerResult.includes('ft')

    if (isDReb) {
      playResult = 'Missed FG'
      reboundOutcome = 'DREB'
      shotResultValue = 'Missed FG'
      hasShot = 'Yes'
      points = 0
    } else if (isOReb) {
      reboundOutcome = 'OREB'
      playResult = 'Missed FG'
      shotResultValue = 'Missed FG'
      hasShot = 'Yes'
      points = 0
    } else if (isMake) {
      playResult = 'Made FG'
      shotResultValue = 'Made FG'
      hasShot = 'Yes'
      points = /\b3\b/.test(resultLabel) ? 3 : 2
    } else if (isFreeThrow) {
      playResult = 'Shooting Foul'
      shotResultValue = 'Made FT'
      hasShot = 'Yes'
      points = 1
    } else if (isSteal) {
      playResult = 'Live-Ball Turnover'
      hasShot = 'No'
      points = 0
    } else if (isTurnover) {
      if (isShotClock) {
        playResult = 'Turnover (Shot Clock Violation)'
      } else if (isDeflection) {
        playResult = 'Deflection (Out of Bounds)'
      } else {
        playResult = 'Dead-Ball Turnover'
      }
      hasShot = 'No'
      points = 0
    } else if (isDeflection) {
      playResult = 'Deflection (Out of Bounds)'
      hasShot = 'No'
      points = 0
    } else if (isReachIn) {
      playResult = 'Reach-In Foul'
      hasShot = 'No'
      points = 0
    } else if (isLooseBall) {
      playResult = 'Loose-Ball Foul'
      hasShot = 'No'
      points = 0
    } else if (isOffBallFoul) {
      playResult = 'Off-Ball Foul'
      hasShot = 'No'
      points = 0
    } else if (isGeneralFoul) {
      playResult = 'Off-Ball Foul'
      hasShot = 'No'
      points = 0
    }

    if (shotDesc) {
      const extractedName = extractPlayerName(shotDesc)
      if (extractedName) {
        shooterName = extractedName
        shooterDesignation = determineShooterDesignation(extractedName, designationSets)
        playerDesignation = mapShooterDesignationToPlayer(shooterDesignation)
      }
    }

    const hasShotAttempt = hasShot === 'Yes'
    const finalShooterDesignation = hasShotAttempt ? shooterDesignation ?? 'Black' : undefined
    let finalPlayerDesignation: string | undefined
    if (hasShotAttempt) {
      finalPlayerDesignation = playerDesignation ?? (finalShooterDesignation ? mapShooterDesignationToPlayer(finalShooterDesignation) : 'role')
      if (!finalPlayerDesignation) {
        finalPlayerDesignation = 'role'
      }
    }

    return {
      playResult,
      points,
      reboundOutcome,
      shotResult: shotResultValue,
      hasShot,
      shooterDesignation: finalShooterDesignation,
      shooterName,
      playerDesignation: finalPlayerDesignation,
      shotDescription: shotDesc ?? undefined,
      shotSummary: summarizeShotDesc(shotDesc),
    }
  }

  const processPlayByPlay = () => {
    const currentText = pbpText || ''
    const trimmed = currentText.trim()
    const usingStoredSource = trimmed.startsWith('#') && sourcePbpRef.current.trim().length > 0
    const raw = usingStoredSource ? sourcePbpRef.current : currentText

    if (!raw.trim()) {
      alert('Paste ESPN play-by-play first')
      return
    }
    if (!usingStoredSource) {
      sourcePbpRef.current = raw
    }
    const designationSets = buildDesignationSets(designationLists)
    const OU_FULL_NAMES = [
      'Raegan Beers',
      'Aaliyah Chavez',
      'Daffa Cissoko',
      'Beatrice Culliton',
      'Keziah Lofton',
      'Caya Smith',
      'Brooklyn Stewart',
      'Emma Tolan',
      'Zya Vann',
      'Payton Verhulst',
      'Sahara Williams',
      'Lexi Keys',
      'Lexy Keys',
      'Liz Scott',
      'Skylar Vann',
      'Jalynn Bristow',
      'Aubrey Joens',
      'KK Rodriguez',
      'Kennedy Tucker',
      'Nevaeh Tot',
      'Maya Nealy',
      'Reyna Scott',
    ]
    const OU_TEAM_WORDS = ['Oklahoma', 'OU', 'Sooners']

    const hasFullOUName = (d: string) =>
      OU_FULL_NAMES.some((n) => new RegExp(`\\b${n}\\b`, 'i').test(d))
    const hasOUTeamWord = (d: string) =>
      OU_TEAM_WORDS.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(d))

    const ACTION_RE = /\b(made|missed|free throw|turnover|steal|defensive rebound|offensive rebound|rebound|jump ball)\b/i
    const isMade = (d: string) => /\bmade\b/i.test(d) && !/\bmade free throw\b/i.test(d)
    const isThree = (d: string) => /\bthree point\b/i.test(d)
    const isFT = (d: string) => /\bfree throw\b/i.test(d)
    const isMiss = (d: string) => /\bmissed\b/i.test(d)
    const isTO = (d: string) => /\bturnover\b/i.test(d) || /\bshot clock turnover\b/i.test(d)
    const isSteal = (d: string) => /\bsteal\b/i.test(d)
    const isDReb = (d: string) => /\bdefensive rebound\b/i.test(d)
    const isOReb = (d: string) => /\boffensive rebound\b/i.test(d)

    const classify = (d: string) =>
      hasFullOUName(d) || hasOUTeamWord(d) ? 'OU' : ACTION_RE.test(d) ? 'OPP' : 'NEUTRAL'

    const isJumpBallToOpp = (d: string) =>
      /jump ball/i.test(d) && /(won by|to)/i.test(d) && !hasFullOUName(d) && !hasOUTeamWord(d)

    const lines = raw
      .split('\n')
      .map((l) => l.replace(/\u00A0/g, ' ').trim())
      .filter(Boolean)
    const timeRe = /(^|\s)(\d{1,2}:\d{2})(?=\s|$)|(^|\s)(\d:\d{2}:\d{2})(?=\s|$)/
    const plays: Array<{ clock: string; desc: string }> = []

    for (const line of lines) {
      const m = line.match(timeRe)
      if (!m) continue
      const clock = (m[2] || m[4] || '').trim()
      let desc = line
        .replace(timeRe, '')
        .trim()
        .replace(/\s+\d+\s+\d+\s*$/, '')
        .trim()
      if (!desc) continue
      plays.push({ clock, desc })
    }

    if (!plays.length) {
      alert('No valid play lines found.')
      return
    }

    const inferOpponentLabel = (plays: Array<{ clock: string; desc: string }>) => {
      for (const p of plays) {
        const d = p.desc
        const m = d.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+Timeout\b/)
        if (m && !hasFullOUName(d) && !hasOUTeamWord(m[1])) return m[1]
      }
      for (const p of plays) {
        const d = p.desc
        if (hasFullOUName(d) || hasOUTeamWord(d)) continue
        const capsPhrase = d.match(/\b([A-Z]{3,}(?:\s+[A-Z]{3,})+)\b/)
        if (capsPhrase && !hasOUTeamWord(capsPhrase[1])) return capsPhrase[1]
        const capsWord = d.match(/\b[A-Z]{3,}\b/)
        if (capsWord && !hasOUTeamWord(capsWord[0])) return capsWord[0]
      }
      return 'Opponent'
    }

    const manual = (opponent || '').trim()
    const OPP_LABEL = manual || inferOpponentLabel(plays)

    const startLabel = (d: string) => {
      if (isJumpBallToOpp(d)) return 'Jump Ball'
      if (isTO(d) && (hasFullOUName(d) || hasOUTeamWord(d))) return 'OU TO'
      if (isDReb(d) && classify(d) === 'OPP') return `${OPP_LABEL} DReb`
      if ((isMade(d) || isFT(d)) && (hasFullOUName(d) || hasOUTeamWord(d))) return 'OU Score'
      return null
    }

    const endLabel = (d: string) => {
      const who = classify(d)
      if (isDReb(d) && who === 'OU') return 'OU DReb'
      if (isSteal(d) && who === 'OU') return 'OU Steal'
      if (who === 'OPP') {
        const actor = extractPlayerName(d) || OPP_LABEL
        if (isFT(d) && !/missed/i.test(d)) return `${actor} FT`
        if (isMade(d)) return isThree(d) ? `${actor} 3` : `${actor} 2`
        if (isTO(d)) return `${actor} TO`
      }
      return null
    }

    const possessions: RawPossession[] = []
    let inDef = false
    let startClock: string | null = null
    let startNote = ''
    let n = 1
    let lastOppShotDesc: string | null = null

    const endPoss = (endClock: string, result: string, endDesc: string) => {
      possessions.push({ num: n++, start: startClock!, end: endClock, action: startNote, result, endDesc, shotDesc: lastOppShotDesc })
      inDef = false
      startClock = null
      startNote = ''
      lastOppShotDesc = null
    }

    for (let i = 0; i < plays.length; i++) {
      const { clock, desc } = plays[i]

      if (!inDef) {
        if (
          isJumpBallToOpp(desc) ||
          (isTO(desc) && (hasFullOUName(desc) || hasOUTeamWord(desc))) ||
          (isDReb(desc) && classify(desc) === 'OPP') ||
          ((isMade(desc) || isFT(desc)) && (hasFullOUName(desc) || hasOUTeamWord(desc)))
        ) {
          startClock = clock
          startNote = startLabel(desc) || 'Start'
          inDef = true
          lastOppShotDesc = null
        }
        continue
      }

      const owner = classify(desc)
      if (owner === 'OPP' && (isMade(desc) || isMiss(desc) || isFT(desc))) {
        lastOppShotDesc = desc
      }

      let label = endLabel(desc)
      if (label === `${OPP_LABEL} FT` && isFT(desc) && isMiss(desc)) label = null

      if (label === `${OPP_LABEL} TO?`) {
        let ouBall = false
        for (let j = i + 1; j < Math.min(i + 7, plays.length); j++) {
          const nx = plays[j].desc
          if (
            (hasFullOUName(nx) || hasOUTeamWord(nx)) &&
            /made|missed/i.test(nx) &&
            !/rebound/i.test(nx)
          ) {
            ouBall = true
            break
          }
          if ((hasFullOUName(nx) || hasOUTeamWord(nx)) && isSteal(nx)) {
            ouBall = true
            break
          }
          if (classify(nx) === 'OPP' && (isMade(nx) || (isFT(nx) && !/missed/i.test(nx)) || isDReb(nx)))
            break
        }
        label = ouBall ? `${OPP_LABEL} TO` : null
      }

      if (label) {
        endPoss(clock, label, desc)
        continue
      }
      if (isOReb(desc) && owner === 'OPP') continue
    }

    if (!possessions.length) {
      setStatusMessage('No defensive possessions found.')
      return
    }

    const clockHeader = 'Clock Range'
    const headerLine = `#  | ${clockHeader} | Action → Result`
    const dividerLine = '—'.repeat(headerLine.length)
    let out = `${headerLine}\n`
    const QUARTER_BREAK_THRESHOLD = 60
    let lastClockSeconds: number | null = null
    let quarterBreakIndex = 0
    for (const p of possessions) {
      const detail = `${abbreviateLabel(p.action)} → ${abbreviateLabel(p.result)}`
      const clockRange = `${p.start} → ${p.end}`
      const label = `${p.num.toString().padEnd(2, ' ')} | ${clockRange}`
      const startSeconds = parseClockSeconds(p.start)
      if (
        lastClockSeconds !== null &&
        startSeconds !== null &&
        startSeconds - lastClockSeconds > QUARTER_BREAK_THRESHOLD
      ) {
        out += `End of ${formatQuarterLabel(quarterBreakIndex)}\n`
        out += `${dividerLine}\n`
        quarterBreakIndex += 1
      }
      out += `${label} | ${detail}\n`
      if (startSeconds !== null) {
        lastClockSeconds = startSeconds
      }
    }

    handlePbpTextChange(out)
    rawPossessionsRef.current = possessions

    const parsedPossessions: ParsedPossession[] = possessions.map((p) => ({
      number: p.num,
      startClock: p.start,
      endClock: p.end,
      startLabel: p.action,
      resultLabel: p.result,
      endDescription: p.endDesc,
      ...derivePossessionTags(p.result, p.endDesc, p.shotDesc, designationSets),
      shotSummary: summarizeShotDesc(p.shotDesc),
    }))

    if (onPossessionsChange) {
      onPossessionsChange(parsedPossessions)
    }

    const matchMap = new Map<string, number[]>()
    for (const possession of parsedPossessions) {
      if (!possession.shooterDesignation || possession.shooterDesignation === 'Black') continue
      const key = possession.shooterName ? shortenName(possession.shooterName) : possession.shooterDesignation
      if (!matchMap.has(key)) {
        matchMap.set(key, [])
      }
      matchMap.get(key)!.push(possession.number)
    }

    if (!matchMap.size) {
      setStatusMessage(`✅ Processed ${possessions.length} OU defensive possessions · No shooter matches for current lists`)
    } else {
      const summary = Array.from(matchMap.entries())
        .map(([name, nums]) => `${name} (#${nums.join(', #')})`)
        .join('; ')
      setStatusMessage(`✅ Processed ${possessions.length} OU defensive possessions · Shooter matches: ${summary}`)
    }

  }

  const handleClear = () => {
    if (confirm('Clear play-by-play text?')) {
      handlePbpTextChange('')
      rawPossessionsRef.current = []
      sourcePbpRef.current = ''
      if (onPossessionsChange) {
        onPossessionsChange([])
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-[2] flex flex-col gap-2 rounded-lg border-b border-[#333] bg-[#191919] px-0 py-[0.4rem]">
        <h2 className="pl-2 text-sm font-semibold uppercase tracking-[0.4em] text-white/70">Tagging Tools</h2>
        <div className="inline-flex gap-[8px] rounded-lg border border-[#2e2e2e] bg-[#161616] p-[4px] pl-1">
          <button
            className={`tab-btn cursor-pointer rounded-md border-0 px-3.5 py-2 text-[12px] font-semibold tracking-[0.06em] transition-all duration-[180ms] ${
              activeTab === 'filter'
                ? 'bg-[#841617] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'bg-[rgba(255,255,255,0.06)] text-gray-200 hover:bg-[rgba(255,255,255,0.12)]'
            }`}
            onClick={() => setActiveTab('filter')}
          >
            Play Filter
          </button>
          <button
            className={`tab-btn cursor-pointer rounded-md border-0 px-3.5 py-2 text-[12px] font-semibold tracking-[0.06em] transition-all duration-[180ms] ${
              activeTab === 'actions'
                ? 'bg-[#841617] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'bg-[rgba(255,255,255,0.06)] text-gray-200 hover:bg-[rgba(255,255,255,0.12)]'
            }`}
            onClick={() => setActiveTab('actions')}
          >
            Actions
          </button>
          <button
            className={`tab-btn cursor-pointer rounded-md border-0 px-3.5 py-2 text-[12px] font-semibold tracking-[0.06em] transition-all duration-[180ms] ${
              activeTab === 'shot'
                ? 'bg-[#841617] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'bg-[rgba(255,255,255,0.06)] text-gray-200 hover:bg-[rgba(255,255,255,0.12)]'
            }`}
            onClick={() => setActiveTab('shot')}
          >
            Shot Chart
          </button>
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden pb-3">
        {activeTab === 'actions' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <ActionBar
              actions={actions}
              onActionChange={onActionChange}
              onAddAction={onAddAction}
              onRemoveAction={onRemoveAction}
            />
          </div>
        )}
        {activeTab === 'filter' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {statusMessage && (
              <div className="rounded-md border border-[#3a3a3a] bg-[#1f1f1f] px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/70">
                {statusMessage}
              </div>
            )}
            <div className="flex flex-shrink-0 gap-3">
              <button
                onClick={processPlayByPlay}
                className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
              >
                Filter OU Defense
              </button>
              <button
                onClick={handleClear}
                className="rounded bg-neutral-800 px-3 py-2 text-xs hover:bg-neutral-700"
              >
                Clear
              </button>
            </div>
            <div className="rounded-[10px] border border-[#2e2e2e] bg-[#121212] p-3 text-[10px] text-white/80">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <svg
                      className="h-2.5 w-2.5 text-white/60 transition-transform duration-200 group-open:rotate-90"
                      viewBox="0 0 10 10"
                      aria-hidden
                    >
                      <path d="M2 1l5 4-5 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  Shooter List
                  </span>
                  <span className="text-[8px] font-normal uppercase tracking-[0.15em] text-white/30 whitespace-nowrap">Newline separated</span>
                </summary>
                <div className="mt-2 flex flex-col gap-1.5">
                  <label className="flex flex-col gap-0.5 text-[10px]">
                    <span className="text-white/60">Blue (Perimeter)</span>
                    <textarea
                      rows={1}
                      value={designationLists.bluePerimeter}
                      onChange={(e) => handleDesignationInputChange('bluePerimeter', e.target.value)}
                      className="min-h-[34px] rounded-md border border-[#363636] bg-[#1e1e1e] px-2 py-1.5 font-mono text-[12px] text-white focus:border-[#841617] focus:outline-none"
                      placeholder="First & Last Name..."
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px]">
                    <span className="text-white/60">Blue (Post)</span>
                    <textarea
                      rows={1}
                      value={designationLists.bluePost}
                      onChange={(e) => handleDesignationInputChange('bluePost', e.target.value)}
                      className="min-h-[34px] rounded-md border border-[#363636] bg-[#1e1e1e] px-2 py-1.5 font-mono text-[12px] text-white focus:border-[#841617] focus:outline-none"
                      placeholder="First & Last Name..."
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 text-[10px]">
                    <span className="text-white/60">Green</span>
                    <textarea
                      rows={1}
                      value={designationLists.green}
                      onChange={(e) => handleDesignationInputChange('green', e.target.value)}
                      className="min-h-[34px] rounded-md border border-[#363636] bg-[#1e1e1e] px-2 py-1.5 font-mono text-[12px] text-white focus:border-[#841617] focus:outline-none"
                      placeholder="First & Last Name..."
                    />
                  </label>
                </div>
              </details>
            </div>
            <textarea
              value={pbpText}
              onChange={(e) => handlePbpTextChange(e.target.value)}
              placeholder="Paste ESPN Play-by-Play here..."
              wrap="off"
              className="min-h-0 flex-1 resize-none overflow-auto rounded-[10px] border border-[#2e2e2e] bg-[#121212] p-3 font-mono text-[12px] leading-[1.5] text-white whitespace-pre focus:outline-none focus:ring-0"
            />
          </div>
        )}
        {activeTab === 'shot' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <ShotChart
              shotX={shotX}
              shotY={shotY}
              shotResult={shotResult}
              playerDesignation={playerDesignation}
              onShotClick={(x, y) => {
                if (onShotDataChange) {
                  onShotDataChange({
                    shotX: x.toFixed(2),
                    shotY: y.toFixed(2),
                    shotResult: shotResult || 'Missed FG',
                    playerDesignation: playerDesignation || 'role',
                  })
                }
              }}
              onShotResultChange={(result) => {
                if (onShotDataChange) {
                  onShotDataChange({
                    shotX,
                    shotY,
                    shotResult: result,
                    playerDesignation,
                  })
                }
              }}
              onPlayerDesignationChange={(designation) => {
                if (onShotDataChange) {
                  onShotDataChange({
                    shotX,
                    shotY,
                    shotResult,
                    playerDesignation: designation,
                  })
                }
              }}
              onClear={() => {
                if (onShotDataChange) {
                  onShotDataChange({
                    shotX: '',
                    shotY: '',
                    shotResult: '',
                    playerDesignation: '',
                  })
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
