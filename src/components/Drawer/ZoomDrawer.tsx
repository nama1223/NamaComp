interface ZoomDrawerProps {
  zoomY: number
  zoomX: number
  onSetZoomY: (z: number) => void
  onSetZoomX: (z: number) => void
  onReset: () => void
  layoutMode: 'wrap' | 'scroll'
  onSetLayoutMode: (m: 'wrap' | 'scroll') => void
  onPreview: () => void
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
  layoutMode,
  onSetLayoutMode,
  onPreview,
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
        <span className="sym-label">五線の表示</span>
        <div className="sym-row">
          <button
            className={layoutMode === 'wrap' ? 'active' : ''}
            onClick={() => onSetLayoutMode('wrap')}
          >
            折り返し
          </button>
          <button
            className={layoutMode === 'scroll' ? 'active' : ''}
            onClick={() => onSetLayoutMode('scroll')}
          >
            横スクロール
          </button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">出力</span>
        <div className="sym-row">
          <button onClick={onReset}>倍率を100%に</button>
          <button onClick={onPreview}>印刷プレビュー</button>
        </div>
      </div>
    </div>
  )
}
