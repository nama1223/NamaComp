import { useCallback, useMemo, useState } from 'react'
import type { NoteElement, NoteValue, Step } from '../types/score'
import type { Cursor, InputMethod } from '../types/editor'
import { makeNote, makePitch, makeRest } from '../model/score'

export interface PickerState {
  step: Step
  octave: number
  value: NoteValue
  dots: number
  sharp: boolean
  flat: boolean
}

const INITIAL_PICKER: PickerState = {
  step: 'C',
  octave: 4,
  value: 4,
  dots: 0,
  sharp: false,
  flat: false,
}

const INITIAL_CURSOR: Cursor = {
  partIndex: 0,
  measureIndex: 0,
  elementIndex: 0,
}

export function useInputState(initialMethod: InputMethod) {
  const [method, setMethod] = useState<InputMethod>(initialMethod)
  const [picker, setPicker] = useState<PickerState>(INITIAL_PICKER)
  const [cursor, setCursor] = useState<Cursor>(INITIAL_CURSOR)

  const patchPicker = useCallback((patch: Partial<PickerState>) => {
    setPicker((prev) => ({ ...prev, ...patch }))
  }, [])

  const alter = picker.sharp ? 1 : picker.flat ? -1 : 0

  // Stable-identity preview note (id is constant so renderer effects don't
  // thrash). Not inserted into the score; display only.
  const previewNote = useMemo<NoteElement>(
    () => ({
      id: 'preview',
      kind: 'note',
      pitches: [makePitch(picker.step, picker.octave, alter)],
      duration: { value: picker.value, dots: picker.dots },
    }),
    [picker.step, picker.octave, alter, picker.value, picker.dots],
  )

  const buildNote = useCallback(
    (): NoteElement =>
      makeNote([makePitch(picker.step, picker.octave, alter)], {
        value: picker.value,
        dots: picker.dots,
      }),
    [picker.step, picker.octave, alter, picker.value, picker.dots],
  )

  const buildRest = useCallback(
    (): NoteElement => makeRest({ value: picker.value, dots: picker.dots }),
    [picker.value, picker.dots],
  )

  return {
    method,
    setMethod,
    picker,
    patchPicker,
    cursor,
    setCursor,
    previewNote,
    buildNote,
    buildRest,
  }
}
