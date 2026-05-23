import type { NoteValue, Step } from '../../types/score'
import type { PickerState } from '../../state/useInputState'
import { NOTE_VALUES } from '../../model/duration'
import { Wheel } from './Wheel'

interface PickerRollInputProps {
  picker: PickerState
  patch: (p: Partial<PickerState>) => void
  onCommitNote: () => void
  onCommitRest: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
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

export function PickerRollInput({
  picker,
  patch,
  onCommitNote,
  onCommitRest,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  overflow,
}: PickerRollInputProps) {
  const stepIndex = STEPS.indexOf(picker.step)
  const valueIndex = NOTE_VALUES.indexOf(picker.value)

  return (
    <div className={`picker-roll ${overflow ? 'overflow' : ''}`}>
      <div className="picker-col history">
        <button
          className="hist-btn"
          aria-label="元に戻す"
          disabled={!canUndo}
          onClick={onUndo}
        >
          ↩
        </button>
        <button
          className="hist-btn"
          aria-label="やり直し"
          disabled={!canRedo}
          onClick={onRedo}
        >
          ↪
        </button>
      </div>

      <div className="picker-col pitch">
        <Wheel
          items={STEPS}
          index={stepIndex}
          onIndex={(i) => patch({ step: STEPS[i] })}
          wrap
          render={(s) => (
            <span>
              {SOLFEGE[s]} {s}
            </span>
          )}
        />
        <div className="octave">
          <button onClick={() => patch({ octave: Math.max(0, picker.octave - 1) })}>
            ▼
          </button>
          <span>Oct {picker.octave}</span>
          <button onClick={() => patch({ octave: Math.min(8, picker.octave + 1) })}>
            ▲
          </button>
        </div>
      </div>

      <div className="picker-col length">
        <Wheel
          items={NOTE_VALUES}
          index={valueIndex}
          onIndex={(i) => patch({ value: NOTE_VALUES[i] })}
          render={(v) => (
            <span>
              <span className="glyph">{VALUE_GLYPH[v]}</span> {VALUE_LABEL[v]}
            </span>
          )}
        />
      </div>

      <div className="picker-col accidentals">
        <label className={`chk ${picker.sharp ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={picker.sharp}
            onChange={(e) =>
              patch({ sharp: e.target.checked, flat: false })
            }
          />
          ♯
        </label>
        <label className={`chk ${picker.flat ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={picker.flat}
            onChange={(e) =>
              patch({ flat: e.target.checked, sharp: false })
            }
          />
          ♭
        </label>
      </div>

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

      <div className="picker-col commit">
        <button className="commit-note" onClick={onCommitNote}>
          音符
        </button>
        <button className="commit-rest" onClick={onCommitRest}>
          休符
        </button>
      </div>
    </div>
  )
}
