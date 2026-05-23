import type { NoteValue, Step } from '../../types/score'
import type { PickerState } from '../../state/useInputState'
import { NOTE_VALUES } from '../../model/duration'
import { Wheel } from './Wheel'

interface PickerRollInputProps {
  picker: PickerState
  patch: (p: Partial<PickerState>) => void
  onCommitNote: () => void
  onCommitRest: () => void
  onCommitDelete: () => void
  overflow: boolean
}

const STEPS: Step[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const SOLFEGE: Record<Step, string> = {
  C: 'ド',
  D: 'レ',
  E: 'ミ',
  F: 'ファ',
  G: 'ソ',
  A: 'ラ',
  B: 'シ',
}

const VALUE_GLYPH: Record<NoteValue, string> = {
  1: '𝅝',
  2: '𝅗𝅥',
  4: '♩',
  8: '♪',
  16: '𝅘𝅥𝅯',
  32: '𝅘𝅥𝅰',
  64: '𝅘𝅥𝅱',
}
const VALUE_LABEL: Record<NoteValue, string> = {
  1: '全',
  2: '2分',
  4: '4分',
  8: '8分',
  16: '16分',
  32: '32分',
  64: '64分',
}

// Tuplet "actual" counts the user can cycle through (0 = none).
const TUPLETS = [0, 3, 5, 6, 7]
const TUPLET_LABEL: Record<number, string> = {
  0: 'なし',
  3: '3連符',
  5: '5連符',
  6: '6連符',
  7: '7連符',
}

// ── 音程: C1〜B7 の連続配列（クロスオクターブ対応） ──────────────────────────
const OCT_MIN = 1
const OCT_MAX = 7
interface PitchItem {
  step: Step
  octave: number
}
const PITCH_ITEMS: PitchItem[] = []
for (let oct = OCT_MIN; oct <= OCT_MAX; oct++) {
  for (const step of STEPS) {
    PITCH_ITEMS.push({ step, octave: oct })
  }
}
// 49 items total (C1…B7)

export function PickerRollInput({
  picker,
  patch,
  onCommitNote,
  onCommitRest,
  onCommitDelete,
  overflow,
}: PickerRollInputProps) {
  // 音程インデックス: step + octave の両方から決定
  const pitchIndex = Math.max(
    0,
    PITCH_ITEMS.findIndex(
      (p) => p.step === picker.step && p.octave === picker.octave,
    ),
  )
  const valueIndex = NOTE_VALUES.indexOf(picker.value)

  return (
    <div className={`picker-roll ${overflow ? 'overflow' : ''}`}>
      {/* ── 音程ホイール (クロスオクターブ / クランプ) ── */}
      <div className="picker-col pitch">
        <Wheel
          items={PITCH_ITEMS}
          index={pitchIndex}
          onIndex={(i) =>
            patch({ step: PITCH_ITEMS[i].step, octave: PITCH_ITEMS[i].octave })
          }
          wrap={false}
          render={(p) => (
            <span>
              {SOLFEGE[p.step]}
              {p.octave}&thinsp;{p.step}
            </span>
          )}
        />
        {/* オクターブ直接ジャンプ用ステッパー（ホイールと連動） */}
        <div className="octave">
          <button
            onClick={() =>
              patch({
                octave: Math.max(OCT_MIN, picker.octave - 1),
              })
            }
          >
            ▼
          </button>
          <span>Oct {picker.octave}</span>
          <button
            onClick={() =>
              patch({
                octave: Math.min(OCT_MAX, picker.octave + 1),
              })
            }
          >
            ▲
          </button>
        </div>
      </div>

      {/* ── 音価ホイール (端同士ループ) + 連符 ── */}
      <div className="picker-col length">
        <Wheel
          items={NOTE_VALUES}
          index={valueIndex}
          onIndex={(i) => patch({ value: NOTE_VALUES[i] })}
          wrap /* 全音符 ↔ 64分音符 がループ */
          swipeStep={48} /* 音価は感度を下げる（誤操作防止） */
          render={(v) => (
            <span>
              <span className="glyph">{VALUE_GLYPH[v]}</span> {VALUE_LABEL[v]}
            </span>
          )}
        />
        <div className="octave tuplet">
          <button
            onClick={() => {
              const i = TUPLETS.indexOf(picker.tuplet)
              patch({ tuplet: TUPLETS[(i - 1 + TUPLETS.length) % TUPLETS.length] })
            }}
          >
            ◀
          </button>
          <span>{TUPLET_LABEL[picker.tuplet]}</span>
          <button
            onClick={() => {
              const i = TUPLETS.indexOf(picker.tuplet)
              patch({ tuplet: TUPLETS[(i + 1) % TUPLETS.length] })
            }}
          >
            ▶
          </button>
        </div>
      </div>

      {/* ── 臨時記号 ── */}
      <div className="picker-col accidentals">
        <label className={`chk ${picker.sharp ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={picker.sharp}
            onChange={(e) => patch({ sharp: e.target.checked, flat: false })}
          />
          ♯
        </label>
        <label className={`chk ${picker.flat ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={picker.flat}
            onChange={(e) => patch({ flat: e.target.checked, sharp: false })}
          />
          ♭
        </label>
      </div>

      {/* ── 付点 ── */}
      <div className="picker-col dots">
        <span className="dots-label">付点</span>
        <div className="dots-stepper">
          <button onClick={() => patch({ dots: Math.max(0, picker.dots - 1) })}>
            ◀
          </button>
          <span>{picker.dots}</span>
          <button onClick={() => patch({ dots: Math.min(2, picker.dots + 1) })}>
            ▶
          </button>
        </div>
      </div>

      {/* ── 確定ボタン ── */}
      <div className="picker-col commit">
        <button className="commit-note" onClick={onCommitNote}>
          音符
        </button>
        <button className="commit-rest" onClick={onCommitRest}>
          休符
        </button>
        <button className="commit-del" onClick={onCommitDelete}>
          削除
        </button>
      </div>
    </div>
  )
}
