import { useEffect, useRef } from 'react'

interface CursorBarProps {
  measureIndex: number
  measureCount: number
  elementIndex: number
  elementCount: number
  voiceIndex: number
  voiceCount: number
  /** Move the insert cursor by ±1 element (wraps across measures). */
  onStep: (delta: number) => void
  /** Jump the cursor to the previous/next measure. */
  onMeasure: (delta: number) => void
  /** True when there's an editable target (a selection, or a note/rest under
   *  the cursor) so the pitch / value scrubbers are shown. */
  canEdit: boolean
  /** Re-pitch the target(s) by ±1 semitone (+1 = up). */
  onPitch: (step: number) => void
  /** Change the value of the target(s) (+1 = longer, -1 = shorter). */
  onValue: (step: number) => void
}

// A tiny ▲▼ control that also responds to mouse-wheel and vertical swipe, so
// nudging pitch/value feels continuous (not just tap-tap-tap). +1 = up.
function ScrubControl({
  label,
  onStep,
}: {
  label: string
  onStep: (d: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const stepRef = useRef(onStep)
  stepRef.current = onStep
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let acc = 0
    const WHEEL = 30
    const SWIPE = 22
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      acc += e.deltaY
      while (Math.abs(acc) >= WHEEL) {
        stepRef.current(acc < 0 ? 1 : -1)
        acc += acc < 0 ? WHEEL : -WHEEL
      }
    }
    let startY = 0
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const dy = startY - e.touches[0].clientY
      if (Math.abs(dy) >= SWIPE) {
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
  return (
    <div
      className="cbar-scrub"
      ref={ref}
      title={`${label}: ボタン / スクロール / スワイプで変更`}
    >
      <span className="cbar-scrub-label">{label}</span>
      <div className="cbar-scrub-btns">
        <button aria-label={`${label}を上げる`} onClick={() => onStep(1)}>
          ▲
        </button>
        <button aria-label={`${label}を下げる`} onClick={() => onStep(-1)}>
          ▼
        </button>
      </div>
    </div>
  )
}

// Thin strip between the staff and the input area: shows where the insert
// cursor is, nudges it precisely (which a touch tap can't), edits the
// target's pitch/value, and toggles the input method — all in one place.
export function CursorBar({
  measureIndex,
  measureCount,
  elementIndex,
  elementCount,
  voiceIndex,
  voiceCount,
  onStep,
  onMeasure,
  canEdit,
  onPitch,
  onValue,
}: CursorBarProps) {
  return (
    <div className="cursor-bar">
      <div className="cbar-nav">
        <button
          aria-label="前の小節へ"
          title="前の小節へ"
          disabled={measureIndex <= 0}
          onClick={() => onMeasure(-1)}
        >
          ⏮
        </button>
        <button
          aria-label="カーソルを左へ"
          title="カーソルを左へ"
          onClick={() => onStep(-1)}
        >
          ◀
        </button>
        <span className="cbar-pos">
          <b>{measureIndex + 1}</b>
          <span className="cbar-sep">/{measureCount}</span>
          <span className="cbar-unit">小節</span>
          {voiceCount > 1 && (
            <span className="cbar-voice">声部{voiceIndex + 1}</span>
          )}
          <span className="cbar-el">
            {Math.min(elementIndex, elementCount)}/{elementCount}
          </span>
        </span>
        <button
          aria-label="カーソルを右へ"
          title="カーソルを右へ"
          onClick={() => onStep(1)}
        >
          ▶
        </button>
        <button
          aria-label="次の小節へ"
          title="次の小節へ"
          disabled={measureIndex >= measureCount - 1}
          onClick={() => onMeasure(1)}
        >
          ⏭
        </button>
      </div>

      {canEdit && (
        <div className="cbar-edit" role="group" aria-label="選択音符の編集">
          <ScrubControl label="音程" onStep={onPitch} />
          <ScrubControl label="音価" onStep={onValue} />
        </div>
      )}
    </div>
  )
}
