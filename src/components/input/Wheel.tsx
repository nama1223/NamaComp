import { type ReactNode, useEffect, useRef } from 'react'

interface WheelProps<T> {
  items: T[]
  index: number
  onIndex: (i: number) => void
  render: (item: T) => ReactNode
  wrap?: boolean
  className?: string
  /** Pixels of vertical swipe (and wheel delta) needed to advance one step. */
  swipeStep?: number
}

// A compact 3-row vertical "picker roll": higher value on top, current in the
// middle, lower below. Tapping a neighbour selects it.
// Supports mouse wheel and vertical touch swipe to scroll through items.
export function Wheel<T>({
  items,
  index,
  onIndex,
  render,
  wrap = false,
  className = '',
  swipeStep = 24,
}: WheelProps<T>) {
  const n = items.length
  const hiIdx = wrap ? (index + 1) % n : index + 1
  const loIdx = wrap ? (index - 1 + n) % n : index - 1
  const hi = items[hiIdx]
  const lo = items[loIdx]

  const containerRef = useRef<HTMLDivElement>(null)

  // Always-current "step" function stored in a ref so we can attach the
  // event listener once and never worry about stale closures.
  const stepRef = useRef<(dir: 1 | -1) => void>(() => {})
  stepRef.current = (dir: 1 | -1) => {
    if (dir === 1 && hi !== undefined) onIndex(hiIdx)
    if (dir === -1 && lo !== undefined) onIndex(loIdx)
  }
  // Keep the latest threshold available to the (once-attached) listeners.
  const thresholdRef = useRef(swipeStep)
  thresholdRef.current = swipeStep

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // ── Mouse wheel (non-passive so we can call preventDefault) ──────────
    // Accumulate delta so trackpads / fine wheels don't over-scroll.
    let wheelAccum = 0
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelAccum += e.deltaY
      const t = thresholdRef.current
      while (Math.abs(wheelAccum) >= t) {
        // deltaY < 0 → scroll up → go hi (higher pitch / longer note on top)
        stepRef.current(wheelAccum < 0 ? 1 : -1)
        wheelAccum += wheelAccum < 0 ? t : -t
      }
    }

    // ── Touch swipe (vertical) ────────────────────────────────────────────
    let startY = 0
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault() // prevent page scroll while swiping the wheel
      const dy = startY - e.touches[0].clientY // positive = swiped up
      const t = thresholdRef.current
      if (Math.abs(dy) >= t) {
        stepRef.current(dy > 0 ? 1 : -1)
        startY = e.touches[0].clientY // reset so each step fires once
      }
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', handleWheel)
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, []) // attach once; stepRef always stays current

  return (
    <div className={`wheel ${className}`} ref={containerRef}>
      <button
        className="wheel-cell hi"
        disabled={hi === undefined}
        onClick={() => hi !== undefined && onIndex(hiIdx)}
      >
        {hi !== undefined ? render(hi) : ''}
      </button>
      <div className="wheel-cell cur">{render(items[index])}</div>
      <button
        className="wheel-cell lo"
        disabled={lo === undefined}
        onClick={() => lo !== undefined && onIndex(loIdx)}
      >
        {lo !== undefined ? render(lo) : ''}
      </button>
    </div>
  )
}
