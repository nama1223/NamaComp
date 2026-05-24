interface ExpressionDrawerProps {
  onArticulate: (code: string) => void
  onTie: () => void
  onSlur: () => void
  onDynamic: (code: string) => void
  hasSelection: boolean
}

const ARTICULATIONS: { code: string; glyph: string; label: string }[] = [
  { code: 'staccato', glyph: '・', label: 'スタッカート' },
  { code: 'accent', glyph: '＞', label: 'アクセント' },
  { code: 'tenuto', glyph: '－', label: 'テヌート' },
  { code: 'marcato', glyph: '＾', label: 'マルカート' },
  { code: 'fermata', glyph: '𝄐', label: 'フェルマータ' },
]

const DYNAMICS = ['pp', 'p', 'mp', 'mf', 'f', 'ff']

export function ExpressionDrawer({
  onArticulate,
  onTie,
  onSlur,
  onDynamic,
  hasSelection,
}: ExpressionDrawerProps) {
  return (
    <div className="drawer-content">
      {ARTICULATIONS.map((a) => (
        <button
          key={a.code}
          title="選択範囲またはカーソルの音符に付与"
          onClick={() => onArticulate(a.code)}
        >
          {a.glyph} {a.label}
        </button>
      ))}
      <button title="次の音符へタイ" onClick={onTie}>
        ⌒ タイ
      </button>
      <button
        title="選択範囲にスラー（先頭→末尾）"
        disabled={!hasSelection}
        onClick={onSlur}
      >
        ⌒ スラー
      </button>
      {DYNAMICS.map((d) => (
        <button
          key={d}
          className="dyn-btn"
          title="選択範囲先頭またはカーソルの音符に強弱"
          onClick={() => onDynamic(d)}
        >
          {d}
        </button>
      ))}
    </div>
  )
}
