interface MeasureDrawerProps {
  measureCount: number
  cursorMeasureIndex: number
  onAppend: () => void
  onInsertAfter: () => void
  onDelete: () => void
}

export function MeasureDrawer({
  measureCount,
  cursorMeasureIndex,
  onAppend,
  onInsertAfter,
  onDelete,
}: MeasureDrawerProps) {
  return (
    <div className="drawer-content symbols">
      <div className="sym-group">
        <span className="sym-label">
          小節数: {measureCount}（カーソル: {cursorMeasureIndex + 1}小節目）
        </span>
        <div className="sym-row">
          <button onClick={onAppend}>末尾に追加</button>
          <button onClick={onInsertAfter}>カーソルの後に挿入</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">削除</span>
        <div className="sym-row">
          <button
            className="danger"
            disabled={measureCount <= 1}
            onClick={onDelete}
          >
            カーソル小節を削除
          </button>
        </div>
      </div>
    </div>
  )
}
