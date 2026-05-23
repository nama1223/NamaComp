import type { Clef, Score, TimeSignature } from '../../types/score'

interface SymbolDrawerProps {
  score: Score
  cursorPartIndex: number
  onSetClef: (partIndex: number, clef: Clef) => void
  onSetKey: (fifths: number) => void
  onSetTime: (time: TimeSignature) => void
}

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'ト音' },
  { value: 'bass', label: 'ヘ音' },
  { value: 'alto', label: 'ハ音(ア)' },
  { value: 'tenor', label: 'ハ音(テ)' },
]

const KEY_LABELS = [
  '♭7', '♭6', '♭5', '♭4', '♭3', '♭2', '♭1',
  '♮',
  '♯1', '♯2', '♯3', '♯4', '♯5', '♯6', '♯7',
]

const TIMES: TimeSignature[] = [
  { beats: 4, beatType: 4 },
  { beats: 3, beatType: 4 },
  { beats: 2, beatType: 4 },
  { beats: 6, beatType: 8 },
  { beats: 2, beatType: 2 },
]

export function SymbolDrawer({
  score,
  cursorPartIndex,
  onSetClef,
  onSetKey,
  onSetTime,
}: SymbolDrawerProps) {
  const part = score.parts[cursorPartIndex]
  const fifths = score.keyFifths

  return (
    <div className="drawer-content symbols">
      <div className="sym-group">
        <span className="sym-label">音部記号 ({part?.name})</span>
        <div className="sym-row">
          {CLEFS.map((c) => (
            <button
              key={c.value}
              className={part?.clef === c.value ? 'active' : ''}
              onClick={() => onSetClef(cursorPartIndex, c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">調号</span>
        <div className="sym-row">
          <button onClick={() => onSetKey(Math.max(-7, fifths - 1))}>◀</button>
          <span className="sym-value">{KEY_LABELS[fifths + 7]}</span>
          <button onClick={() => onSetKey(Math.min(7, fifths + 1))}>▶</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">拍子</span>
        <div className="sym-row">
          {TIMES.map((t) => {
            const active =
              score.time.beats === t.beats && score.time.beatType === t.beatType
            return (
              <button
                key={`${t.beats}/${t.beatType}`}
                className={active ? 'active' : ''}
                onClick={() => onSetTime(t)}
              >
                {t.beats}/{t.beatType}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
