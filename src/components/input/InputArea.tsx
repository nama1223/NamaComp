import type { InputMethod } from '../../types/editor'
import type { PickerState } from '../../state/useInputState'
import { PickerRollInput } from './PickerRollInput'
import { KeyboardInput } from './KeyboardInput'

interface InputAreaProps {
  method: InputMethod
  onSwitchMethod: () => void
  picker: PickerState
  patch: (p: Partial<PickerState>) => void
  onCommitNote: () => void
  onCommitRest: () => void
  onCommitMidi: (midi: number) => void
  onCommitDelete: () => void
  overflow: boolean
}

// A slim method toggle sits on the left edge (always visible, costs no extra
// row); the rest is the picker / keyboard body.
export function InputArea(props: InputAreaProps) {
  const { method, onSwitchMethod } = props

  return (
    <section className="input-area">
      <div className="method-tabs" role="group" aria-label="入力方式">
        <button
          className={method === 'picker' ? 'active' : ''}
          onClick={() => method !== 'picker' && onSwitchMethod()}
        >
          ロール
        </button>
        <button
          className={method === 'keyboard' ? 'active' : ''}
          onClick={() => method !== 'keyboard' && onSwitchMethod()}
        >
          鍵盤
        </button>
      </div>

      <div className="input-body">
        {method === 'picker' ? (
          <PickerRollInput
            picker={props.picker}
            patch={props.patch}
            onCommitNote={props.onCommitNote}
            onCommitRest={props.onCommitRest}
            onCommitDelete={props.onCommitDelete}
            overflow={props.overflow}
          />
        ) : (
          <KeyboardInput
            picker={props.picker}
            patch={props.patch}
            onCommitMidi={props.onCommitMidi}
            onCommitDelete={props.onCommitDelete}
            overflow={props.overflow}
          />
        )}
      </div>
    </section>
  )
}
