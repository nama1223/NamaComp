interface ExpressionDrawerProps {
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

export function ExpressionDrawer({ onArticulate, onTie }: ExpressionDrawerProps) {
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
    </div>
  )
}
