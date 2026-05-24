interface ZoomDrawerProps {
  zoomY: number
  zoomX: number
  onSetZoomY: (z: number) => void
  onSetZoomX: (z: number) => void
  onReset: () => void
}

const MIN = 0.4
const MAX = 3
const STEP = 0.1

function clamp(z: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100))
}

export function ZoomDrawer({
  zoomY,
  zoomX,
  onSetZoomY,
  onSetZoomX,
  onReset,
}: ZoomDrawerProps) {
  return (
    <div className="drawer-content symbols">
      <div className="sym-group">
        <span className="sym-label">縦の倍率（音符サイズ）</span>
        <div className="sym-row">
          <button onClick={() => onSetZoomY(clamp(zoomY - STEP))}>◀</button>
          <span className="sym-value">{Math.round(zoomY * 100)}%</span>
          <button onClick={() => onSetZoomY(clamp(zoomY + STEP))}>▶</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">横の倍率（音符の間隔）</span>
        <div className="sym-row">
          <button onClick={() => onSetZoomX(clamp(zoomX - STEP))}>◀</button>
          <span className="sym-value">{Math.round(zoomX * 100)}%</span>
          <button onClick={() => onSetZoomX(clamp(zoomX + STEP))}>▶</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">リセット</span>
        <div className="sym-row">
          <button onClick={onReset}>100% に戻す</button>
        </div>
      </div>
    </div>
  )
}
