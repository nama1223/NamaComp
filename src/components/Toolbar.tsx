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
  onArticulate: (code: string) => void
  onTie: () => void
}

const ARTICULATIONS: { code: string; glyph: string; label: string }[] = [
  { code: 'staccato', glyph: '・', label: 'スタッカート' },
  { code: 'accent', glyph: '＞', label: 'アクセント' },
  { code: 'tenuto', glyph: '－', label: 'テヌート' },
  { code: 'marcato', glyph: '＾', label: 'マルカート' },
  { code: 'fermata', glyph: '𝄐', label: 'フェルマータ' },
]

export function Toolbar({
  mode,
  onToggleSelect,
  hasSelection,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onClearSelection,
  onArticulate,
  onTie,
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

      <div className="tb-sep" />

      <div className="tb-group">
        {ARTICULATIONS.map((a) => (
          <button
            key={a.code}
            className="tb-btn"
            title={`${a.label}（選択またはカーソルの音符）`}
            aria-label={a.label}
            onClick={() => onArticulate(a.code)}
          >
            <span className="tb-glyph">{a.glyph}</span>
          </button>
        ))}
        <button
          className="tb-btn"
          title="タイ（次の音符へ）"
          aria-label="タイ"
          onClick={onTie}
        >
          <span className="tb-glyph">⌒</span>
        </button>
      </div>
    </div>
  )
}
