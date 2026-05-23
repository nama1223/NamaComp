// Score construction + immutable edit operations. All edit helpers return a new
// Score (structural sharing where convenient) so React state updates stay clean.

import type {
  Clef,
  Duration,
  Measure,
  NoteElement,
  Part,
  Pitch,
  Score,
  Step,
  TimeSignature,
} from '../types/score'
import { durationToWholeFraction } from './duration'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2, 10)
}

export function makePitch(step: Step, octave: number, alter = 0): Pitch {
  return { step, octave, alter }
}

export function makeNote(pitches: Pitch[], duration: Duration): NoteElement {
  return { id: uid(), kind: 'note', pitches, duration }
}

export function makeRest(duration: Duration): NoteElement {
  return { id: uid(), kind: 'rest', pitches: [], duration }
}

function emptyMeasure(): Measure {
  return { id: uid(), elements: [] }
}

function makePart(
  name: string,
  fullName: string,
  clef: Clef,
  transpose: number,
  measureCount: number,
): Part {
  return {
    id: uid(),
    name,
    fullName,
    clef,
    transpose,
    measures: Array.from({ length: measureCount }, emptyMeasure),
  }
}

/** Default 3-part score mirroring the mockup (Trp / Horn / Tuba). */
export function createDefaultScore(): Score {
  const MEASURES = 4
  return {
    title: '無題のスコア',
    fileName: 'ファイル名',
    keyFifths: 0,
    time: { beats: 4, beatType: 4 },
    tempo: 100,
    parts: [
      makePart('Trp', 'Trumpet in B♭', 'treble', -2, MEASURES),
      makePart('Horn', 'Horn in F', 'treble', -7, MEASURES),
      makePart('Tuba', 'Tuba', 'bass', 0, MEASURES),
    ],
  }
}

// --- whole-note fraction helpers -------------------------------------------

export function measureUsedWhole(measure: Measure): number {
  return measure.elements.reduce(
    (sum, el) => sum + durationToWholeFraction(el.duration),
    0,
  )
}

// --- immutable edit ops -----------------------------------------------------

function replaceMeasure(
  score: Score,
  partIndex: number,
  measureIndex: number,
  updater: (m: Measure) => Measure,
): Score {
  const parts = score.parts.map((part, pi) => {
    if (pi !== partIndex) return part
    const measures = part.measures.map((m, mi) =>
      mi === measureIndex ? updater(m) : m,
    )
    return { ...part, measures }
  })
  return { ...score, parts }
}

export function insertElement(
  score: Score,
  partIndex: number,
  measureIndex: number,
  elementIndex: number,
  element: NoteElement,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    const elements = [...m.elements]
    const at = Math.max(0, Math.min(elementIndex, elements.length))
    elements.splice(at, 0, element)
    return { ...m, elements }
  })
}

export function deleteElement(
  score: Score,
  partIndex: number,
  measureIndex: number,
  elementIndex: number,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    const elements = m.elements.filter((_, i) => i !== elementIndex)
    return { ...m, elements }
  })
}

// --- measure structure ops --------------------------------------------------

/** Append one empty measure to every part (keeps parts the same length). */
export function appendMeasure(score: Score): Score {
  const parts = score.parts.map((p) => ({
    ...p,
    measures: [...p.measures, emptyMeasure()],
  }))
  return { ...score, parts }
}

/** Insert an empty measure right after `measureIndex` in every part. */
export function insertMeasureAfter(score: Score, measureIndex: number): Score {
  const parts = score.parts.map((p) => {
    const measures = [...p.measures]
    const at = Math.max(0, Math.min(measureIndex + 1, measures.length))
    measures.splice(at, 0, emptyMeasure())
    return { ...p, measures }
  })
  return { ...score, parts }
}

/** Delete `measureIndex` from every part. Always keeps at least one measure. */
export function deleteMeasure(score: Score, measureIndex: number): Score {
  const count = Math.max(0, ...score.parts.map((p) => p.measures.length))
  if (count <= 1) return score
  const parts = score.parts.map((p) => ({
    ...p,
    measures: p.measures.filter((_, i) => i !== measureIndex),
  }))
  return { ...score, parts }
}

// --- mid-piece (per-measure) overrides --------------------------------------
// These persist from the measure they appear on until the next override.

/** Change a single part's clef starting at `measureIndex`. */
export function setMeasureClef(
  score: Score,
  partIndex: number,
  measureIndex: number,
  clef: Clef,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => ({ ...m, clef }))
}

/** Change the key signature for all parts starting at `measureIndex`. */
export function setMeasureKey(
  score: Score,
  measureIndex: number,
  keyFifths: number,
): Score {
  const parts = score.parts.map((p) => ({
    ...p,
    measures: p.measures.map((m, i) =>
      i === measureIndex ? { ...m, keyFifths } : m,
    ),
  }))
  return { ...score, parts }
}

/** Change the time signature for all parts starting at `measureIndex`. */
export function setMeasureTime(
  score: Score,
  measureIndex: number,
  time: TimeSignature,
): Score {
  const parts = score.parts.map((p) => ({
    ...p,
    measures: p.measures.map((m, i) =>
      i === measureIndex ? { ...m, time } : m,
    ),
  }))
  return { ...score, parts }
}

export function setScoreMeta(score: Score, patch: Partial<Score>): Score {
  return { ...score, ...patch }
}

export function updatePart(
  score: Score,
  partIndex: number,
  patch: Partial<Part>,
): Score {
  const parts = score.parts.map((p, i) =>
    i === partIndex ? { ...p, ...patch } : p,
  )
  return { ...score, parts }
}

// --- part / ensemble ops ----------------------------------------------------

export const MAX_PARTS = 36

export interface PartSpec {
  name: string
  fullName?: string
  clef: Clef
  transpose: number
}

/** Append a part, matching the current measure count with empty measures. */
export function addPart(score: Score, spec: PartSpec): Score {
  if (score.parts.length >= MAX_PARTS) return score
  const count = Math.max(1, ...score.parts.map((p) => p.measures.length))
  const part: Part = {
    id: uid(),
    name: spec.name,
    fullName: spec.fullName,
    clef: spec.clef,
    transpose: spec.transpose,
    measures: Array.from({ length: count }, emptyMeasure),
  }
  return { ...score, parts: [...score.parts, part] }
}

/** Remove a part. Always keeps at least one part. */
export function removePart(score: Score, partIndex: number): Score {
  if (score.parts.length <= 1) return score
  return { ...score, parts: score.parts.filter((_, i) => i !== partIndex) }
}

/** Move a part from one index to another (reorder staves). */
export function movePart(score: Score, from: number, to: number): Score {
  const n = score.parts.length
  if (from === to || from < 0 || from >= n || to < 0 || to >= n) return score
  const parts = [...score.parts]
  const [p] = parts.splice(from, 1)
  parts.splice(to, 0, p)
  return { ...score, parts }
}
