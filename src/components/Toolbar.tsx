import type { EditMode } from '../types/editor'

interface ToolbarProps {
  mode: EditMode
  onToggleSelect: () => void
  hasSelection: boolean
  hasClipboard: boolean
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onClearSelection: () => void
}

export function Toolbar({
  mode,
  onToggleSelect,
  hasSelection,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onClearSelection,
}: ToolbarProps) {
  const selecting = mode === 'select'
  return (
    <div className="toolbar">
      <div className="tb-group">
        <button
          className={`tb-btn ${selecting ? 'on' : ''}`}
          aria-pressed={selecting}
          title="選択モード: 開始の音符→終了の音符をタップ"
          onClick={onToggleSelect}
        >
          ⬚ 選択
        </button>
        <button
          className="tb-btn"
          disabled={!hasSelection}
          onClick={onCopy}
        >
          コピー
        </button>
        <button className="tb-btn" disabled={!hasSelection} onClick={onCut}>
          切り取り
        </button>
        <button className="tb-btn" disabled={!hasClipboard} onClick={onPaste}>
          貼り付け
        </button>
        <button
          className="tb-btn"
          disabled={!hasSelection}
          onClick={onClearSelection}
        >
          解除
        </button>
      </div>
    </div>
  )
}
