import { useEffect, useRef, useState } from 'react'

interface MeasureDrawerProps {
  measureCount: number
  cursorMeasureIndex: number
  onAppendMany: (n: number) => void
  onInsertAfter: () => void
  onDelete: () => void
  voiceCount: number
  activeVoice: number
  onSetVoice: (voiceIndex: number) => void
  onAddVoice: () => void
  onRemoveVoice: () => void
}

const MIN_N = 1
const MAX_N = 64
const clampN = (n: number) => Math.max(MIN_N, Math.min(MAX_N, Math.round(n)))

export function MeasureDrawer({
  measureCount,
  cursorMeasureIndex,
  onAppendMany,
  onInsertAfter,
  onDelete,
  voiceCount,
  activeVoice,
  onSetVoice,
  onAddVoice,
  onRemoveVoice,
}: MeasureDrawerProps) {
  const [count, setCount] = useState(4)
  const countRef = useRef(count)
  countRef.current = count
  const stepperRef = useRef<HTMLDivElement>(null)

  // Mouse wheel + vertical swipe to adjust the count.
  useEffect(() => {
    const el = stepperRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCount((c) => clampN(c + (e.deltaY < 0 ? 1 : -1)))
    }
    let startY = 0
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const dy = startY - e.touches[0].clientY
      if (Math.abs(dy) >= 22) {
        setCount((c) => clampN(c + (dy > 0 ? 1 : -1)))
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
    <div className="drawer-content symbols">
      <div className="sym-group">
        <span className="sym-label">小節を追加（現在 {measureCount}小節）</span>
        <div className="sym-row" ref={stepperRef}>
          <button onClick={() => setCount((c) => clampN(c - 1))}>－</button>
          <input
            className="num-input"
            type="number"
            min={MIN_N}
            max={MAX_N}
            value={count}
            aria-label="追加する小節数"
            onChange={(e) => setCount(clampN(Number(e.target.value) || MIN_N))}
          />
          <button onClick={() => setCount((c) => clampN(c + 1))}>＋</button>
          <button className="num-add" onClick={() => onAppendMany(count)}>
            末尾に{count}小節追加
          </button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">小節の挿入 / 削除（カーソル位置）</span>
        <div className="sym-row">
          <button onClick={onInsertAfter}>後ろに1小節挿入</button>
          <button
            className="danger"
            disabled={measureCount <= 1}
            onClick={onDelete}
          >
            この小節を削除
          </button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">声部（この小節）</span>
        <div className="sym-row">
          <button
            disabled={activeVoice <= 0}
            onClick={() => onSetVoice(activeVoice - 1)}
          >
            ◀
          </button>
          <span className="sym-value">
            第{activeVoice + 1} / {voiceCount}声部
          </span>
          <button
            disabled={activeVoice >= voiceCount - 1}
            onClick={() => onSetVoice(activeVoice + 1)}
          >
            ▶
          </button>
          <button disabled={voiceCount >= 4} onClick={onAddVoice}>
            ＋追加
          </button>
          <button
            className="danger"
            disabled={voiceCount <= 1}
            onClick={onRemoveVoice}
          >
            －削除
          </button>
        </div>
      </div>
    </div>
  )
}
