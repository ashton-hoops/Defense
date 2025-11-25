import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type FloatingPickerProps = {
  inputRef: HTMLInputElement | null
  options: string[]
  isOpen: boolean
  onSelect: (value: string) => void
  onClose: () => void
  highlightRule?: (value: string) => boolean
}

export const FloatingPicker = ({
  inputRef,
  options,
  isOpen,
  onSelect,
  onClose,
  highlightRule,
}: FloatingPickerProps) => {
  const pickerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 0 })
  const [direction, setDirection] = useState<'below' | 'above'>('below')
  const [thumbState, setThumbState] = useState<{ height: number; top: number; visible: boolean }>({
    height: 0,
    top: 0,
    visible: false,
  })

  const filteredOptions = options.filter((o) => o.toLowerCase().includes(filter.toLowerCase()))

  useEffect(() => {
    if (!isOpen || !inputRef) return

    const updatePosition = () => {
      const rect = inputRef.getBoundingClientRect()
      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom

      const itemHeight = 36
      const padding = 8
      const maxVisibleItems = 4
      const calculatedHeight = filteredOptions.length * itemHeight + padding
      const maxHeight = Math.min(calculatedHeight, maxVisibleItems * itemHeight + padding)

      if (spaceBelow >= maxHeight || spaceBelow >= spaceAbove) {
        setDirection('below')
        setPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: Math.max(220, rect.width),
          maxHeight: maxHeight,
        })
      } else {
        const dropdownHeight = Math.min(maxHeight, spaceAbove - 10)
        setDirection('above')
        setPosition({
          top: rect.top - dropdownHeight - 4,
          left: rect.left,
          width: Math.max(220, rect.width),
          maxHeight: dropdownHeight,
        })
      }
    }

    const updateThumb = () => {
      if (filteredOptions.length <= 4) {
        setThumbState({ height: 0, top: 0, visible: false })
        return
      }
      const el = scrollRef.current
      if (!el) return
      const { scrollHeight, clientHeight, scrollTop } = el
      if (scrollHeight - clientHeight <= 32) {
        setThumbState({ height: 0, top: 0, visible: false })
        return
      }
      const ratio = clientHeight / scrollHeight
      const height = Math.max(ratio * clientHeight, 24)
      const maxTop = clientHeight - height
      const top = ((scrollTop / (scrollHeight - clientHeight)) * maxTop) || 0
      setThumbState({ height, top, visible: true })
    }

    updatePosition()
    updateThumb()

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    const scrollEl = scrollRef.current
    scrollEl?.addEventListener('scroll', updateThumb)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
      scrollEl?.removeEventListener('scroll', updateThumb)
    }
  }, [isOpen, inputRef, filteredOptions.length])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== inputRef) return

      if (e.key === 'Enter') {
        const firstOption = filteredOptions[0]
        if (firstOption) {
          e.preventDefault()
          onSelect(firstOption)
        }
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, inputRef, filteredOptions, onSelect, onClose])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        e.target !== inputRef
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, inputRef, onClose])

  useEffect(() => {
    if (inputRef) {
      const currentValue = inputRef.value
      const lastToken = currentValue.split(',').slice(-1)[0].trim()
      setFilter(lastToken)
    }
  }, [inputRef?.value, isOpen])

  if (!isOpen) return null

  const handleWheel = (e: React.WheelEvent) => {
    // Prevent page scroll when scrolling inside dropdown
    e.stopPropagation()

    const target = e.currentTarget
    const isAtTop = target.scrollTop === 0
    const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight

    // Only prevent default if we're not at boundaries (to allow natural scroll feel)
    if ((e.deltaY < 0 && !isAtTop) || (e.deltaY > 0 && !isAtBottom)) {
      // Let the dropdown scroll naturally
    }
  }

  const pickerElement = (
    <div
      ref={pickerRef}
      className="fixed z-[9999]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: `${position.width}px`,
      }}
    >
      <div className="relative">
        <div
          ref={scrollRef}
          className="picker-scroll overflow-y-auto overflow-x-hidden rounded-lg border border-[#3a3a3a] bg-[#1a1a1a] shadow-xl"
          style={{
            maxHeight: `${position.maxHeight}px`,
          }}
          onMouseDown={(e) => e.preventDefault()}
          onWheel={handleWheel}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, idx) => (
              <div
                key={idx}
              className="flex cursor-pointer items-center whitespace-nowrap px-2.5 py-2 text-sm text-[#faf9f6] hover:bg-[#841617]"
                data-val={option}
                onClick={() => onSelect(option)}
              >
                <span className="flex-1">{option}</span>
                {highlightRule?.(option) ? <span className="text-xs text-white/50">→</span> : null}
              </div>
            ))
          ) : (
            <div className="px-2.5 py-2 text-xs text-slate-400">No matches</div>
          )}
        </div>
        {thumbState.visible && (
          <div
            className="pointer-events-none absolute right-[4px] top-[2px] w-[6px] rounded-full"
            style={{
              height: `${Math.max(0, thumbState.height - 4)}px`,
              transform: `translateY(${thumbState.top + 2}px)`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.45))',
              boxShadow: 'inset 0 0 4px rgba(0,0,0,0.25), 0 0 2px rgba(0,0,0,0.25)',
            }}
          />
        )}
      </div>
    </div>
  )

  return createPortal(pickerElement, document.body)
}
