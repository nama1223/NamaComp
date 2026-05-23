interface MeasureDrawerProps {
  measureCount: number
  cursorMeasureIndex: number
  onAppend: () => void
  onInsertAfter: () => void
  onDelete: () => void
  voiceCount: number
  activeVoice: number
  onSetVoice: (voiceIndex: number) => void
  onAddVoice: () => void
  onRemoveVoice: () => void
}

export function MeasureDrawer({
  measureCount,
  cursorMeasureIndex,
  onAppend,
  onInsertAfter,
  onDelete,
  voiceCount,
  activeVoice,
  onSetVoice,
  onAddVoice,
  onRemoveVoice,
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
