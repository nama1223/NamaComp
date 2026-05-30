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

// Note values shown shortest-at-bottom (descending duration: whole … 64th).
const VALUES_DESC: NoteValue[] = [...NOTE_VALUES].reverse() as NoteValue[]

// Tuplet "actual" counts the user can cycle through (0 = none).
const TUPLETS = [0, 3, 5, 6, 7]
const TUPLET_LABEL: Record<number, string> = {
  0: 'なし',
  3: '3',
  5: '5',
  6: '6',
  7: '7',
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
  const pitchIndex = Math.max(
    0,
    PITCH_ITEMS.findIndex(
      (p) => p.step === picker.step && p.octave === picker.octave,
    ),
  )
  const valueIndex = VALUES_DESC.indexOf(picker.value)

  function cycleTuplet(dir: number) {
    const i = TUPLETS.indexOf(picker.tuplet)
    patch({ tuplet: TUPLETS[(i + dir + TUPLETS.length) % TUPLETS.length] })
  }

  return (
    <div className={`picker-roll ${overflow ? 'overflow' : ''}`}>
      {/* 2 つのホイール（音程 / 音価）を上端そろえで横並び */}
      <div className="pk-wheels">
        <Wheel
          className="pitch"
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
        <Wheel
          className="length"
          items={VALUES_DESC}
          index={valueIndex}
          onIndex={(i) => patch({ value: VALUES_DESC[i] })}
          wrap
          swipeStep={48}
          render={(v) => (
            <span>
              <span className="glyph">{VALUE_GLYPH[v]}</span> {VALUE_LABEL[v]}
            </span>
          )}
        />
      </div>

      {/* 小さな調整類を 2 列グリッドにまとめてコンパクトに */}
      <div className="pk-controls">
        <div className="pk-ctrl">
          <span className="pk-ctrl-label">Oct</span>
          <button
            aria-label="オクターブを下げる"
            onClick={() =>
              patch({ octave: Math.max(OCT_MIN, picker.octave - 1) })
            }
          >
            ◀
          </button>
          <span className="pk-ctrl-val">{picker.octave}</span>
          <button
            aria-label="オクターブを上げる"
            onClick={() =>
              patch({ octave: Math.min(OCT_MAX, picker.octave + 1) })
            }
          >
            ▶
          </button>
        </div>

        <div className="pk-ctrl pk-acc">
          <button
            className={picker.sharp ? 'on' : ''}
            aria-pressed={picker.sharp}
            onClick={() => patch({ sharp: !picker.sharp, flat: false })}
          >
            ♯
          </button>
          <button
            className={picker.flat ? 'on' : ''}
            aria-pressed={picker.flat}
            onClick={() => patch({ flat: !picker.flat, sharp: false })}
          >
            ♭
          </button>
        </div>

        <div className="pk-ctrl">
          <span className="pk-ctrl-label">付点</span>
          <button
            aria-label="付点を減らす"
            onClick={() => patch({ dots: Math.max(0, picker.dots - 1) })}
          >
            ◀
          </button>
          <span className="pk-ctrl-val">{picker.dots}</span>
          <button
            aria-label="付点を増やす"
            onClick={() => patch({ dots: Math.min(2, picker.dots + 1) })}
          >
            ▶
          </button>
        </div>

        <div className="pk-ctrl">
          <span className="pk-ctrl-label">連符</span>
          <button aria-label="連符を減らす" onClick={() => cycleTuplet(-1)}>
            ◀
          </button>
          <span className="pk-ctrl-val">{TUPLET_LABEL[picker.tuplet]}</span>
          <button aria-label="連符を増やす" onClick={() => cycleTuplet(1)}>
            ▶
          </button>
        </div>
      </div>

      {/* 確定ボタン（右端・縦並び） */}
      <div className="pk-commit">
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
