import { useRef } from 'react'

type ControlsBarProps = {
  videoRef: HTMLVideoElement | null
  inTime: string
  outTime: string
  onLoadVideo: () => void
  onMarkIn: () => void
  onMarkOut: () => void
  onSave: () => void
  onInTimeChange: (value: string) => void
  onOutTimeChange: (value: string) => void
}

export const ControlsBar = ({
  videoRef,
  inTime,
  outTime,
  onLoadVideo,
  onMarkIn,
  onMarkOut,
  onSave,
  onInTimeChange,
  onOutTimeChange,
}: ControlsBarProps) => {
  const inInputRef = useRef<HTMLInputElement>(null)
  const outInputRef = useRef<HTMLInputElement>(null)

  const handleSpeed = (speed: number) => {
    if (videoRef) videoRef.playbackRate = speed
  }

  const handleSkip = (seconds: number) => {
    if (videoRef) videoRef.currentTime = Math.max(0, videoRef.currentTime + seconds)
  }

  const handlePlayPause = () => {
    if (!videoRef) return
    if (videoRef.paused) {
      videoRef.play()
    } else {
      videoRef.pause()
    }
  }

  return (
    <div className="flex flex-shrink-0 flex-nowrap items-center justify-center gap-[0.25rem] rounded-b-[10px] rounded-t-none border border-[#2a2a2a] border-t-0 bg-[#191919] px-[0.3rem] py-[0.22rem]">
      {/* Load Video */}
      <button
        onClick={onLoadVideo}
        className="load ctl min-w-[58px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.48rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        Load Video
      </button>

      {/* Speed controls */}
      <button
        onClick={() => handleSpeed(0.5)}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        0.5x
      </button>
      <button
        onClick={() => handleSpeed(1)}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        1x
      </button>
      <button
        onClick={() => handleSpeed(2)}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        2x
      </button>

      <span className="sep mx-[0.35rem] text-xs text-[#7f7f7f]">|</span>

      {/* Skip controls */}
      <button
        onClick={() => handleSkip(-10)}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        -10s
      </button>
      <button
        onClick={handlePlayPause}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        ▶/⏸
      </button>
      <button
        onClick={() => handleSkip(10)}
        className="ctl min-w-[45px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.38rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        +10s
      </button>

      <span className="sep mx-[0.35rem] text-xs text-[#7f7f7f]">|</span>

      {/* IN/OUT inputs */}
      <input
        ref={inInputRef}
        type="text"
        placeholder="IN"
        value={inTime}
        onChange={(e) => onInTimeChange(e.target.value)}
        className="h-[26px] w-24 rounded border border-[#2a2a2a] bg-[#161616] px-2 text-center text-[0.8rem] text-[#f0f0ec] focus:border-[#841617] focus:shadow-none focus:outline-none"
      />
      <input
        ref={outInputRef}
        type="text"
        placeholder="OUT"
        value={outTime}
        onChange={(e) => onOutTimeChange(e.target.value)}
        className="h-[26px] w-24 rounded border border-[#2a2a2a] bg-[#161616] px-2 text-center text-[0.8rem] text-[#f0f0ec] focus:border-[#841617] focus:shadow-none focus:outline-none"
      />

      {/* Mark IN/OUT */}
      <button
        onClick={onMarkIn}
        className="ctl min-w-[58px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.48rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        Mark IN
      </button>
      <button
        onClick={onMarkOut}
        className="ctl ml-1 min-w-[58px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.48rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        Mark OUT
      </button>

      {/* Save */}
      <button
        onClick={onSave}
        className="ctl ml-2 min-w-[58px] whitespace-nowrap rounded-[7px] border border-[#333] bg-[#202020] px-[0.48rem] py-[0.28rem] text-[0.68rem] leading-none text-[#f2f2ef] hover:border-[#841617] hover:shadow-[0_0_0_2px_rgba(132,22,23,0.25)_inset]"
      >
        Save
      </button>
    </div>
  )
}
