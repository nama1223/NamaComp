import type { InputMethod } from '../../types/editor'
import type { PickerState } from '../../state/useInputState'
import { PickerRollInput } from './PickerRollInput'
import { KeyboardInput } from './KeyboardInput'

interface InputAreaProps {
  method: InputMethod
  picker: PickerState
  patch: (p: Partial<PickerState>) => void
  onCommitNote: () => void
  onCommitRest: () => void
  onCommitMidi: (midi: number) => void
  onCommitDelete: () => void
  overflow: boolean
}

// The input-method toggle now lives in the CursorBar above, so the input area
// itself is a single full-width body — no side arrows eating thumb space.
export function InputArea(props: InputAreaProps) {
  const { method } = props

  return (
    <section className="input-area">
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
