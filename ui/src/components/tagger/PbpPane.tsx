import { useState } from 'react'

type PbpPaneProps = {
  opponent: string
  pbpText?: string
  onPbpTextChange?: (text: string) => void
}

export const PbpPane = ({ opponent, pbpText = '', onPbpTextChange }: PbpPaneProps) => {
  const [activeTab, setActiveTab] = useState<'filter' | 'shot'>('filter')

  const handlePbpTextChange = (text: string) => {
    if (onPbpTextChange) {
      onPbpTextChange(text)
    }
  }

  const processPlayByPlay = () => {
    const raw = pbpText || ''
    if (!raw.trim()) {
      alert('Paste ESPN play-by-play first')
      return
    }

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
        if (isFT(d) && !/missed/i.test(d)) return `${OPP_LABEL} FT`
        if (isMade(d)) return isThree(d) ? `${OPP_LABEL} 3` : `${OPP_LABEL} 2`
      }
      if (isTO(d) && who === 'OPP') return `${OPP_LABEL} TO?`
      return null
    }

    const possessions: Array<{ num: number; start: string; end: string; action: string; result: string }> = []
    let inDef = false
    let startClock: string | null = null
    let startNote = ''
    let n = 1

    const endPoss = (endClock: string, result: string) => {
      possessions.push({ num: n++, start: startClock!, end: endClock, action: startNote, result })
      inDef = false
      startClock = null
      startNote = ''
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
        }
        continue
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
        endPoss(clock, label)
        continue
      }
      if (isOReb(desc) && classify(desc) === 'OPP') continue
    }

    if (!possessions.length) {
      alert('No defensive possessions found.')
      return
    }

    let out = '#  Clock Range   Action → Result\n'
    for (const p of possessions) out += `${p.num}  ${p.start} → ${p.end}  ${p.action} → ${p.result}\n`

    handlePbpTextChange(out)
    alert(`✅ Processed ${possessions.length} OU defensive possessions`)
  }

  const handleClear = () => {
    if (confirm('Clear play-by-play text?')) {
      handlePbpTextChange('')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-[2] flex flex-shrink-0 items-center justify-between rounded-lg border-b border-[#333] bg-[#191919] px-[0.7rem] py-[0.5rem]">
        <h2 className="text-sm font-semibold tracking-wide">Tagging Tools</h2>
        <div className="flex gap-[6px] rounded-lg border border-[#2e2e2e] bg-[#161616] p-[3px]">
          <button
            className={`tab-btn cursor-pointer rounded-md border-0 px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] transition-all duration-[180ms] ${
              activeTab === 'filter'
                ? 'bg-[#841617] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'bg-[rgba(255,255,255,0.06)] text-gray-200 hover:bg-[rgba(255,255,255,0.12)]'
            }`}
            onClick={() => setActiveTab('filter')}
          >
            Play Filter
          </button>
          <button
            className={`tab-btn cursor-pointer rounded-md border-0 px-3 py-1.5 text-[11px] font-semibold tracking-[0.04em] transition-all duration-[180ms] ${
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
        {activeTab === 'filter' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
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
            <textarea
              value={pbpText}
              onChange={(e) => handlePbpTextChange(e.target.value)}
              placeholder="Paste ESPN Play-by-Play here..."
              className="min-h-0 flex-1 resize-none rounded-[10px] border border-[#841617] bg-black p-3 font-mono text-[11px] leading-[1.35] text-white"
            />
          </div>
        )}
        {activeTab === 'shot' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 text-sm text-gray-400">
              Shot Chart Picker coming soon...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
