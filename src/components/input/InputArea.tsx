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
  overflow: boolean
}

export function InputArea(props: InputAreaProps) {
  const { method, onSwitchMethod } = props

  return (
    <section className="input-area">
      <button
        className="method-switch left"
        aria-label="入力方式を切替"
        onClick={onSwitchMethod}
      >
        ◀
      </button>

      <div className="input-body">
        {method === 'picker' ? (
          <PickerRollInput
            picker={props.picker}
            patch={props.patch}
            onCommitNote={props.onCommitNote}
            onCommitRest={props.onCommitRest}
            overflow={props.overflow}
          />
        ) : (
          <KeyboardInput />
        )}
      </div>

      <button
        className="method-switch right"
        aria-label="入力方式を切替"
        onClick={onSwitchMethod}
      >
        ▶
      </button>
    </section>
  )
}
