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
