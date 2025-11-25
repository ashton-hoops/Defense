import type { QueueEntry } from '../../lib/types'

type QueueDrawerProps = {
  isOpen: boolean
  clips: QueueEntry[]
  selectedCount: number
  videoRef: HTMLVideoElement | null
  onToggle: () => void
  onSelectAll: (checked: boolean) => void
  onSelectClip: (index: number, checked: boolean) => void
  onDeleteClip: (index: number) => void
  onEditClip: (clip: QueueEntry) => void
  onExportCsv: () => void
  onAddToDashboard: () => void
}

export const QueueDrawer = ({
  isOpen,
  clips,
  selectedCount,
  videoRef,
  onToggle,
  onSelectAll,
  onSelectClip,
  onDeleteClip,
  onEditClip,
  onExportCsv,
  onAddToDashboard,
}: QueueDrawerProps) => {
  const allSelected = clips.length > 0 && selectedCount === clips.length
  const someSelected = selectedCount > 0 && selectedCount < clips.length

  const handleRowClick = (e: React.MouseEvent, clip: QueueEntry) => {
    if ((e.target as HTMLElement).closest('button, input[type="checkbox"]')) return
    onEditClip(clip)
  }

  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number)
    if (parts.length === 3) {
      const [h, m, s] = parts
      return h * 3600 + m * 60 + s
    }
    return 0
  }

  return (
    <>
      {/* Drawer Tab */}
      <button
        onClick={onToggle}
        className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 transform cursor-pointer rounded-t-[10px] border border-b-0 border-[#2a2a2a] bg-[#181818] px-[0.8rem] py-[0.35rem] text-[0.8rem] text-[#f0eee8] shadow-[0_-2px_10px_rgba(0,0,0,0.35)]"
      >
        Clips ({clips.length}) ▴
      </button>

      {/* Drawer */}
      <section
        className={`fixed bottom-0 left-0 right-0 z-50 border-t border-[#2a2a2a] bg-[#121212] shadow-[0_-8px_24px_rgba(0,0,0,0.45)] transition-transform duration-[220ms] ${
          isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-36px)]'
        } ${!isOpen ? 'hidden' : 'block'}`}
      >
        <div className="flex items-center justify-between border-b border-[#333] bg-[#191919] px-[0.9rem] py-[0.5rem]">
          <div className="flex items-center gap-3">
            <strong>Clip Queue</strong>
            <span className="text-xs text-slate-400">
              {clips.length} clip{clips.length !== 1 ? 's' : ''} - {selectedCount} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportCsv}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
            >
              Export CSV
            </button>
            <button
              onClick={onAddToDashboard}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500"
            >
              Add to Dashboard
            </button>
            <button
              onClick={onToggle}
              className="mr-3 translate-y-[1px] rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
            >
              Close
            </button>
          </div>
        </div>
        <div
          className="min-h-[18px] px-4 pb-1 pt-2 text-xs text-slate-400"
          id="dashboardStatus"
        ></div>
        <div className="max-h-[40vh] overflow-auto p-0">
          <table className="w-full border-collapse text-[0.84rem]" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '42px' }} />
              <col style={{ width: '50px' }} />
              <col style={{ width: '55px' }} />
              <col style={{ width: '65px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '190px' }} />
              <col style={{ width: '170px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '85px' }} />
            </colgroup>
            <thead className="sticky top-0 bg-[#191919]">
              <tr>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={(e) => onSelectAll(e.target.checked)}
                  />
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  #
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  Q
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  Poss
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  Start
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  End
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  Play
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  Situation
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  Shooter Designation
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-[#f0eee8]">
                  Play Result
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  Shot
                </th>
                <th className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.5rem] text-center text-[#f0eee8]">
                  Delete
                </th>
              </tr>
            </thead>
            <tbody>
              {clips.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="border-b border-[#2a2a2a] py-3 text-center text-slate-400"
                  >
                    No clips yet.
                  </td>
                </tr>
              ) : (
                clips.map((clip, i) => {
                  const isSelected = clip.__selected !== false
                  return (
                    <tr
                      key={i}
                      className={`cursor-pointer ${
                        isSelected
                          ? 'hover:bg-[#841617]'
                          : 'opacity-55 hover:bg-[#1b2732] hover:opacity-70'
                      }`}
                      onClick={(e) => handleRowClick(e, clip)}
                    >
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle text-[#f0eee8]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            onSelectClip(i, e.target.checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle text-[#f0eee8]">
                        {i + 1}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle text-[#f0eee8]">
                        {clip.q}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle text-[#f0eee8]">
                        {clip.p}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.start}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.end}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.play}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.situation}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.shooter}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] align-middle text-[#f0eee8]">
                        {clip.res}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle text-[#f0eee8]">
                        {/* Shot visualization placeholder */}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-[0.6rem] py-[0.45rem] text-center align-middle">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClip(i)
                          }}
                          className="rounded-lg border border-[#872021] bg-black px-[0.5rem] py-[0.25rem] text-[0.75rem] text-white hover:bg-[#2a2a2a]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
