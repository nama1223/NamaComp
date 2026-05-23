import type { EditMode } from '../../types/editor'

interface SelectionDrawerProps {
  mode: EditMode
  onToggleSelect: () => void
  hasSelection: boolean
  hasClipboard: boolean
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onClearSelection: () => void
}

export function SelectionDrawer({
  mode,
  onToggleSelect,
  hasSelection,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onClearSelection,
}: SelectionDrawerProps) {
  return (
    <div className="drawer-content">
      <button
        className={mode === 'select' ? 'active' : ''}
        onClick={onToggleSelect}
      >
        選択モード{mode === 'select' ? '：ON' : ''}
      </button>
      <button disabled={!hasSelection} onClick={onCopy}>
        コピー
      </button>
      <button disabled={!hasSelection} onClick={onCut}>
        切り取り
      </button>
      <button disabled={!hasClipboard} onClick={onPaste}>
        貼り付け
      </button>
      <button disabled={!hasSelection} onClick={onClearSelection}>
        解除
      </button>
    </div>
  )
}
