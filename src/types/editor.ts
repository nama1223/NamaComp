// Editor-only state (not part of the saved score document).

export interface Cursor {
  partIndex: number
  measureIndex: number
  /** Insertion index within the measure's element list (0..length). */
  elementIndex: number
}

export type InputMethod = 'picker' | 'keyboard'
