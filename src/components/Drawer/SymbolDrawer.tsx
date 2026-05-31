import { useState } from 'react'
import type { Clef, Part, Score, TimeSignature } from '../../types/score'

interface SymbolDrawerProps {
  score: Score
  cursorPartIndex: number
  cursorMeasureIndex: number
  onSetClef: (partIndex: number, clef: Clef) => void
  onSetMeasureClef: (partIndex: number, measureIndex: number, clef: Clef) => void
  onSetKey: (fifths: number) => void
  onSetMeasureKey: (measureIndex: number, fifths: number) => void
  onSetTime: (time: TimeSignature) => void
  onSetMeasureTime: (measureIndex: number, time: TimeSignature) => void
  onTranspose: (semitones: number) => void
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

// Quick one-tap presets for the most common meters.
const TIME_PRESETS: TimeSignature[] = [
  { beats: 4, beatType: 4 },
  { beats: 3, beatType: 4 },
  { beats: 2, beatType: 4 },
  { beats: 6, beatType: 8 },
  { beats: 12, beatType: 8 },
  { beats: 2, beatType: 2 },
]
// Denominators must be real note values (powers of 2): rules out 3/5 etc.
const TIME_DENOMS = [1, 2, 4, 8, 16, 32]
const TIME_BEATS_MAX = 32
const stepDenom = (cur: number, dir: number): number => {
  const i = TIME_DENOMS.indexOf(cur)
  const ni = Math.max(0, Math.min(TIME_DENOMS.length - 1, (i < 0 ? 2 : i) + dir))
  return TIME_DENOMS[ni]
}

// Effective value at the cursor measure (walks overrides up to that measure).
function effClefAt(part: Part | undefined, mi: number): Clef | undefined {
  if (!part) return undefined
  let c = part.clef
  for (let i = 0; i <= mi && i < part.measures.length; i++) {
    const ov = part.measures[i]?.clef
    if (ov) c = ov
  }
  return c
}
function effKeyAt(part: Part | undefined, score: Score, mi: number): number {
  let k = score.keyFifths
  if (!part) return k
  for (let i = 0; i <= mi && i < part.measures.length; i++) {
    const ov = part.measures[i]?.keyFifths
    if (ov !== undefined) k = ov
  }
  return k
}
function effTimeAt(part: Part | undefined, score: Score, mi: number): TimeSignature {
  let t = score.time
  if (!part) return t
  for (let i = 0; i <= mi && i < part.measures.length; i++) {
    const ov = part.measures[i]?.time
    if (ov) t = ov
  }
  return t
}

type Scope = 'all' | 'measure'

export function SymbolDrawer({
  score,
  cursorPartIndex,
  cursorMeasureIndex,
  onSetClef,
  onSetMeasureClef,
  onSetKey,
  onSetMeasureKey,
  onSetTime,
  onSetMeasureTime,
  onTranspose,
}: SymbolDrawerProps) {
  const [scope, setScope] = useState<Scope>('all')
  const part = score.parts[cursorPartIndex]
  const mi = cursorMeasureIndex

  const curClef = effClefAt(part, mi)
  const curKey = effKeyAt(part, score, mi)
  const curTime = effTimeAt(part, score, mi)

  function applyClef(clef: Clef) {
    if (scope === 'measure') onSetMeasureClef(cursorPartIndex, mi, clef)
    else onSetClef(cursorPartIndex, clef)
  }
  function applyKey(fifths: number) {
    if (scope === 'measure') onSetMeasureKey(mi, fifths)
    else onSetKey(fifths)
  }
  function applyTime(time: TimeSignature) {
    if (scope === 'measure') onSetMeasureTime(mi, time)
    else onSetTime(time)
  }

  return (
    <div className="drawer-content symbols">
      <div className="sym-group">
        <span className="sym-label">適用範囲</span>
        <div className="sym-row scope-row">
          <button
            className={scope === 'all' ? 'active' : ''}
            onClick={() => setScope('all')}
          >
            全体
          </button>
          <button
            className={scope === 'measure' ? 'active' : ''}
            onClick={() => setScope('measure')}
          >
            {mi + 1}小節目から
          </button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">音部記号 ({part?.name})</span>
        <div className="sym-row">
          {CLEFS.map((c) => (
            <button
              key={c.value}
              className={curClef === c.value ? 'active' : ''}
              onClick={() => applyClef(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">調号</span>
        <div className="sym-row">
          <button onClick={() => applyKey(Math.max(-7, curKey - 1))}>◀</button>
          <span className="sym-value">{KEY_LABELS[curKey + 7]}</span>
          <button onClick={() => applyKey(Math.min(7, curKey + 1))}>▶</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">拍子（{curTime.beats}/{curTime.beatType}）</span>
        <div className="sym-row">
          {TIME_PRESETS.map((t) => {
            const active =
              curTime.beats === t.beats && curTime.beatType === t.beatType
            return (
              <button
                key={`${t.beats}/${t.beatType}`}
                className={active ? 'active' : ''}
                onClick={() => applyTime(t)}
              >
                {t.beats}/{t.beatType}
              </button>
            )
          })}
        </div>
        <div className="sym-row time-custom">
          <span className="sym-sublabel">拍数</span>
          <button
            aria-label="拍数を減らす"
            onClick={() =>
              applyTime({
                beats: Math.max(1, curTime.beats - 1),
                beatType: curTime.beatType,
              })
            }
          >
            ◀
          </button>
          <span className="sym-value">{curTime.beats}</span>
          <button
            aria-label="拍数を増やす"
            onClick={() =>
              applyTime({
                beats: Math.min(TIME_BEATS_MAX, curTime.beats + 1),
                beatType: curTime.beatType,
              })
            }
          >
            ▶
          </button>
          <span className="time-slash">/</span>
          <span className="sym-sublabel">音価</span>
          <button
            aria-label="拍子の音価を大きく"
            onClick={() =>
              applyTime({
                beats: curTime.beats,
                beatType: stepDenom(curTime.beatType, -1),
              })
            }
          >
            ◀
          </button>
          <span className="sym-value">{curTime.beatType}</span>
          <button
            aria-label="拍子の音価を小さく"
            onClick={() =>
              applyTime({
                beats: curTime.beats,
                beatType: stepDenom(curTime.beatType, 1),
              })
            }
          >
            ▶
          </button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">全体移調（曲全体・半音）</span>
        <div className="sym-row">
          <button onClick={() => onTranspose(-1)}>♭ -1</button>
          <button onClick={() => onTranspose(-12)}>-1oct</button>
          <button onClick={() => onTranspose(12)}>+1oct</button>
          <button onClick={() => onTranspose(1)}>♯ +1</button>
        </div>
      </div>
    </div>
  )
}
