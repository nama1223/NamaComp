// Editor-only state (not part of the saved score document).

export interface Cursor {
  partIndex: number
  measureIndex: number
  /** Which voice on the staff is being edited (0 = primary). */
  voiceIndex: number
  /** Insertion index within the active voice's element list (0..length). */
  elementIndex: number
}

export type InputMethod = 'picker' | 'keyboard'

/** What a tap on the staff does. */
export type EditMode = 'normal' | 'eraser' | 'select'

/** A position within a part/voice element list. */
export interface SelPos {
  measureIndex: number
  elementIndex: number
}

/** A contiguous range of elements within one part + voice (anchor→focus). */
export interface Selection {
  partIndex: number
  voiceIndex: number
  anchor: SelPos
  focus: SelPos
}

/** Selection normalised so start ≤ end (inclusive element indices). */
export interface NormSelection {
  partIndex: number
  voiceIndex: number
  startMeasure: number
  startEl: number
  endMeasure: number
  endEl: number
}

export function normalizeSelection(sel: Selection): NormSelection {
  const a = sel.anchor
  const b = sel.focus
  const aBefore =
    a.measureIndex < b.measureIndex ||
    (a.measureIndex === b.measureIndex && a.elementIndex <= b.elementIndex)
  const start = aBefore ? a : b
  const end = aBefore ? b : a
  return {
    partIndex: sel.partIndex,
    voiceIndex: sel.voiceIndex,
    startMeasure: start.measureIndex,
    startEl: start.elementIndex,
    endMeasure: end.measureIndex,
    endEl: end.elementIndex,
  }
}

/** Is (measureIndex, elementIndex) inside the normalised selection? */
export function inNormSelection(
  n: NormSelection,
  measureIndex: number,
  elementIndex: number,
): boolean {
  if (measureIndex < n.startMeasure || measureIndex > n.endMeasure) return false
  if (measureIndex === n.startMeasure && elementIndex < n.startEl) return false
  if (measureIndex === n.endMeasure && elementIndex > n.endEl) return false
  return true
}
