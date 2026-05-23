import { useState } from 'react'
import type { NoteValue, Step } from '../../types/score'
import type { PickerState } from '../../state/useInputState'
import { midiToFreq } from '../../model/pitch'
import { playTone } from '../../audio/preview'

interface KeyboardInputProps {
  picker: PickerState
  patch: (p: Partial<PickerState>) => void
  onCommitMidi: (midi: number) => void
  onCommitDelete: () => void
  overflow: boolean
}

const WHITE: { step: Step; semi: number; sol: string }[] = [
  { step: 'C', semi: 0, sol: 'ド' },
  { step: 'D', semi: 2, sol: 'レ' },
  { step: 'E', semi: 4, sol: 'ミ' },
  { step: 'F', semi: 5, sol: 'ファ' },
  { step: 'G', semi: 7, sol: 'ソ' },
  { step: 'A', semi: 9, sol: 'ラ' },
  { step: 'B', semi: 11, sol: 'シ' },
]

// `anchor` = index of the white key the black key sits to the right of.
const BLACK: { semi: number; anchor: number; label: string }[] = [
  { semi: 1, anchor: 1, label: 'C♯' },
  { semi: 3, anchor: 2, label: 'D♯' },
  { semi: 6, anchor: 4, label: 'F♯' },
  { semi: 8, anchor: 5, label: 'G♯' },
  { semi: 10, anchor: 6, label: 'A♯' },
]

const LEN_CHOICES: NoteValue[] = [1, 2, 4, 8, 16]
const LEN_LABEL: Record<number, string> = {
  1: '全',
  2: '2',
  4: '4',
  8: '8',
  16: '16',
}

const WHITE_PCT = 100 / WHITE.length

export function KeyboardInput({
  picker,
  patch,
  onCommitMidi,
  onCommitDelete,
  overflow,
}: KeyboardInputProps) {
  const [octave, setOctave] = useState(4)
  const [transpose, setTranspose] = useState(0)

  function tap(semi: number) {
    const midi = (octave + 1) * 12 + semi + transpose
    playTone(midiToFreq(midi))
    onCommitMidi(midi)
  }

  const tSign = transpose > 0 ? '+' : ''

  return (
    <div className={`kbd-input ${overflow ? 'overflow' : ''}`}>
      <div className="kbd-controls">
        <div className="kbd-lens">
          {LEN_CHOICES.map((v) => (
            <button
              key={v}
              className={picker.value === v ? 'active' : ''}
              onClick={() => patch({ value: v })}
            >
              {LEN_LABEL[v]}
            </button>
          ))}
        </div>

        <div className="kbd-step">
          <span className="dots-label">付点</span>
          <button onClick={() => patch({ dots: Math.max(0, picker.dots - 1) })}>
            ◀
          </button>
          <span>{picker.dots}</span>
          <button onClick={() => patch({ dots: Math.min(2, picker.dots + 1) })}>
            ▶
          </button>
        </div>

        <div className="kbd-step">
          <span>移調</span>
          <button onClick={() => setTranspose((t) => Math.max(-12, t - 1))}>
            ◀
          </button>
          <span className="kbd-num">
            {tSign}
            {transpose}
          </span>
          <button onClick={() => setTranspose((t) => Math.min(12, t + 1))}>
            ▶
          </button>
        </div>

        <div className="kbd-step">
          <span>Oct</span>
          <button onClick={() => setOctave((o) => Math.max(1, o - 1))}>◀</button>
          <span className="kbd-num">{octave}</span>
          <button onClick={() => setOctave((o) => Math.min(7, o + 1))}>▶</button>
        </div>

        <button className="kbd-del" onClick={onCommitDelete}>
          削除
        </button>
      </div>

      <div className="kbd-piano">
        {WHITE.map((w) => (
          <button
            key={w.step}
            className="wkey"
            style={{ width: `${WHITE_PCT}%` }}
            onClick={() => tap(w.semi)}
          >
            <span className="wkey-sol">{w.sol}</span>
            <span className="wkey-name">{w.step}</span>
          </button>
        ))}
        {BLACK.map((b) => (
          <button
            key={b.label}
            className="bkey"
            style={{ left: `calc(${b.anchor * WHITE_PCT}% - 5.5%)` }}
            onClick={() => tap(b.semi)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}
