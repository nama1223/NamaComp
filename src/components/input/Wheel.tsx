import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react'

interface WheelProps<T> {
  items: T[]
  index: number
  onIndex: (i: number) => void
  render: (item: T) => ReactNode
  wrap?: boolean
  className?: string
  /** Pixels of vertical swipe / wheel delta needed to advance one step. */
  swipeStep?: number
}

const ITEM_H = 19 // px per row
const HALF = 2 // 5 visible rows (centre ± 2)
const WINDOW = 3 // render ± 3 rows (extra headroom for the slide)
const VIEWPORT_H = (HALF * 2 + 1) * ITEM_H // 95
const BASE = (HALF - WINDOW) * ITEM_H // centring offset (= -ITEM_H)

// A 5-row vertical picker with smooth sliding. Higher index renders above the
// centre (so pitch goes up = up; the caller reverses the array for note values).
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
  const containerRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const prevIndex = useRef(index)

  const resolve = (off: number): number | null => {
    const idx = index + off
    if (wrap) return ((idx % n) + n) % n
    return idx >= 0 && idx < n ? idx : null
  }

  // Smooth slide whenever the index changes.
  useLayoutEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    let delta = index - prevIndex.current
    prevIndex.current = index
    if (wrap && Math.abs(delta) > n / 2) delta -= Math.sign(delta) * n
    if (delta === 0) {
      strip.style.transform = `translateY(${BASE}px)`
      return
    }
    strip.style.transition = 'none'
    strip.style.transform = `translateY(${BASE + delta * ITEM_H}px)`
    void strip.offsetHeight // force reflow
    strip.style.transition = 'transform 0.16s ease-out'
    strip.style.transform = `translateY(${BASE}px)`
  }, [index, n, wrap])

  // Mouse wheel + vertical swipe.
  const stepRef = useRef<(d: 1 | -1) => void>(() => {})
  stepRef.current = (d) => {
    const target = resolve(d)
    if (target !== null) onIndex(target)
  }
  const thresholdRef = useRef(swipeStep)
  thresholdRef.current = swipeStep
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let acc = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      acc += e.deltaY
      const t = thresholdRef.current
      while (Math.abs(acc) >= t) {
        stepRef.current(acc < 0 ? 1 : -1)
        acc += acc < 0 ? t : -t
      }
    }
    let startY = 0
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const dy = startY - e.touches[0].clientY
      const t = thresholdRef.current
      if (Math.abs(dy) >= t) {
        stepRef.current(dy > 0 ? 1 : -1)
        startY = e.touches[0].clientY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  // Rows top → bottom: off = +WINDOW … -WINDOW (higher index on top).
  const offsets: number[] = []
  for (let off = WINDOW; off >= -WINDOW; off--) offsets.push(off)

  return (
    <div
      className={`wheel ${className}`}
      ref={containerRef}
      style={{ height: VIEWPORT_H }}
    >
      <div className="wheel-strip" ref={stripRef}>
        {offsets.map((off) => {
          const idx = resolve(off)
          const item = idx !== null ? items[idx] : null
          const dist = Math.abs(off)
          const cls = off === 0 ? 'cur' : dist === 1 ? 'near' : 'far'
          return (
            <button
              key={off}
              className={`wheel-cell ${cls}`}
              style={{ height: ITEM_H }}
              disabled={item === null || off === 0}
              onClick={() => idx !== null && onIndex(idx)}
            >
              {item !== null ? render(item) : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}
