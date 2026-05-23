import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { NoteElement, Score } from '../types/score'
import type { Cursor } from '../types/editor'
import type { MusicFontName } from '../render/fonts'
import { VexRenderer, type ClickTarget } from '../render/VexRenderer'

interface StaffAreaProps {
  score: Score
  zoom: number
  onZoomChange: (zoom: number) => void
  cursor: Cursor
  preview: NoteElement | null
  previewOverflow: boolean
  onCellClick: (
    partIndex: number,
    measureIndex: number,
    target?: ClickTarget,
  ) => void
  eraser?: boolean
  playMeasure?: number | null
  fontToken: MusicFontName
  children?: ReactNode
}

const ZOOM_MIN = 0.4
const ZOOM_MAX = 3

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

export function StaffArea({
  score,
  zoom,
  onZoomChange,
  cursor,
  preview,
  previewOverflow,
  onCellClick,
  eraser,
  playMeasure,
  fontToken,
  children,
}: StaffAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  // Track container width so the renderer can wrap systems sensibly.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Pinch-to-zoom (two pointers) + ctrl/⌘ + wheel.
  const pinch = useRef<{ startDist: number; startZoom: number } | null>(null)
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())

  // Mouse drag-to-pan. Touch keeps native pan-x/pan-y scrolling.
  const pan = useRef<{
    startX: number
    startY: number
    sl: number
    st: number
    moved: number
  } | null>(null)
  const dragged = useRef(false)

  function dist() {
    const pts = [...pointers.current.values()]
    if (pts.length < 2) return 0
    const dx = pts[0].x - pts[1].x
    const dy = pts[0].y - pts[1].y
    return Math.hypot(dx, dy)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return
      const el = scrollRef.current
      if (!el) return
      pan.current = {
        startX: e.clientX,
        startY: e.clientY,
        sl: el.scrollLeft,
        st: el.scrollTop,
        moved: 0,
      }
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      pinch.current = { startDist: dist(), startZoom: zoom }
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') {
      const p = pan.current
      const el = scrollRef.current
      if (!p || !el) return
      const dx = e.clientX - p.startX
      const dy = e.clientY - p.startY
      p.moved = Math.max(p.moved, Math.abs(dx) + Math.abs(dy))
      el.scrollLeft = p.sl - dx
      el.scrollTop = p.st - dy
      return
    }
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const d = dist()
      if (d > 0 && pinch.current.startDist > 0) {
        onZoomChange(
          clampZoom((pinch.current.startZoom * d) / pinch.current.startDist),
        )
      }
    }
  }
  function endPointer(e: React.PointerEvent) {
    if (e.pointerType === 'mouse') {
      if (pan.current) {
        dragged.current = pan.current.moved > 5
        pan.current = null
      }
      return
    }
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  // Swallow the click that ends a drag so it doesn't move the cursor.
  function onClickCapture(e: React.MouseEvent) {
    if (dragged.current) {
      e.stopPropagation()
      dragged.current = false
    }
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      onZoomChange(clampZoom(zoom * (1 - e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, onZoomChange])

  return (
    <div className="staff-stage">
      <div
        className="staff-scroll"
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onClickCapture={onClickCapture}
      >
        <VexRenderer
          score={score}
          zoom={zoom}
          containerWidth={width}
          cursor={cursor}
          preview={preview}
          previewOverflow={previewOverflow}
          onCellClick={onCellClick}
          eraser={eraser}
          playMeasure={playMeasure}
          fontToken={fontToken}
        />
      </div>

      <div className="zoom-controls">
        <button onClick={() => onZoomChange(clampZoom(zoom - 0.2))}>－</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => onZoomChange(clampZoom(zoom + 0.2))}>＋</button>
      </div>

      {children}
    </div>
  )
}
