import { useCallback, useMemo, useState } from 'react'
import type { Duration, NoteElement, NoteValue, Step } from '../types/score'
import type { Cursor, InputMethod } from '../types/editor'
import { makeNote, makePitch, makeRest } from '../model/score'

export interface PickerState {
  step: Step
  octave: number
  value: NoteValue
  dots: number
  sharp: boolean
  flat: boolean
  /** Tuplet "actual" count: 0 = none, 3 = triplet, 5 = quintuplet, ... */
  tuplet: number
}

const INITIAL_PICKER: PickerState = {
  step: 'C',
  octave: 4,
  value: 4,
  dots: 0,
  sharp: false,
  flat: false,
  tuplet: 0,
}

const INITIAL_CURSOR: Cursor = {
  partIndex: 0,
  measureIndex: 0,
  elementIndex: 0,
}

/** Map a tuplet "actual" count to a {actual, normal} ratio (normal = pow2 below). */
export function tupletRatio(actual: number): { actual: number; normal: number } {
  let normal = 1
  while (normal * 2 < actual) normal *= 2
  return { actual, normal }
}

export function useInputState(initialMethod: InputMethod) {
  const [method, setMethod] = useState<InputMethod>(initialMethod)
  const [picker, setPicker] = useState<PickerState>(INITIAL_PICKER)
  const [cursor, setCursor] = useState<Cursor>(INITIAL_CURSOR)
  const [eraser, setEraser] = useState(false)

  const patchPicker = useCallback((patch: Partial<PickerState>) => {
    setPicker((prev) => ({ ...prev, ...patch }))
  }, [])

  const alter = picker.sharp ? 1 : picker.flat ? -1 : 0

  // Current duration from the picker (value + dots + optional tuplet).
  const buildDuration = useCallback((): Duration => {
    const d: Duration = { value: picker.value, dots: picker.dots }
    if (picker.tuplet > 0) d.tuplet = tupletRatio(picker.tuplet)
    return d
  }, [picker.value, picker.dots, picker.tuplet])

  // Stable-identity preview note (id is constant so renderer effects don't
  // thrash). Not inserted into the score; display only.
  const previewNote = useMemo<NoteElement>(
    () => ({
      id: 'preview',
      kind: 'note',
      pitches: [makePitch(picker.step, picker.octave, alter)],
      duration: buildDuration(),
    }),
    [picker.step, picker.octave, alter, buildDuration],
  )

  const buildNote = useCallback(
    (): NoteElement =>
      makeNote([makePitch(picker.step, picker.octave, alter)], buildDuration()),
    [picker.step, picker.octave, alter, buildDuration],
  )

  const buildRest = useCallback(
    (): NoteElement => makeRest(buildDuration()),
    [buildDuration],
  )

  return {
    method,
    setMethod,
    picker,
    patchPicker,
    cursor,
    setCursor,
    eraser,
    setEraser,
    previewNote,
    buildNote,
    buildRest,
    buildDuration,
  }
}
