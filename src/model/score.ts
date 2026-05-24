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
import { midiToPitch, pitchToMidi } from './pitch'

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
  return { id: uid(), voices: [[]] }
}

/** Migrate a legacy measure ({elements}) to the voices[][] shape in place-safe
 *  fashion. Used when loading older persisted scores. */
export function migrateMeasure(m: Measure & { elements?: NoteElement[] }): Measure {
  if (Array.isArray(m.voices) && m.voices.length > 0) return m
  const legacy = Array.isArray(m.elements) ? m.elements : []
  const { ...rest } = m
  delete (rest as { elements?: NoteElement[] }).elements
  return { ...rest, voices: [legacy] }
}

/** Migrate a whole score's measures to the voices shape (idempotent). */
export function migrateScore(score: Score): Score {
  return {
    ...score,
    parts: score.parts.map((p) => ({
      ...p,
      measures: p.measures.map((m) => migrateMeasure(m)),
    })),
  }
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

/** Whole-note fraction used by a single voice. */
export function voiceUsedWhole(voice: NoteElement[]): number {
  return voice.reduce((sum, el) => sum + durationToWholeFraction(el.duration), 0)
}

/** A measure is "as full as its fullest voice". */
export function measureUsedWhole(measure: Measure): number {
  return measure.voices.reduce((max, v) => Math.max(max, voiceUsedWhole(v)), 0)
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

function replaceVoice(
  m: Measure,
  voiceIndex: number,
  updater: (v: NoteElement[]) => NoteElement[],
): Measure {
  const voices = m.voices.map((v, i) => (i === voiceIndex ? updater(v) : v))
  return { ...m, voices }
}

export function insertElement(
  score: Score,
  partIndex: number,
  measureIndex: number,
  voiceIndex: number,
  elementIndex: number,
  element: NoteElement,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    if (voiceIndex < 0 || voiceIndex >= m.voices.length) return m
    return replaceVoice(m, voiceIndex, (voice) => {
      const elements = [...voice]
      const at = Math.max(0, Math.min(elementIndex, elements.length))
      elements.splice(at, 0, element)
      return elements
    })
  })
}

export function deleteElement(
  score: Score,
  partIndex: number,
  measureIndex: number,
  voiceIndex: number,
  elementIndex: number,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    if (voiceIndex < 0 || voiceIndex >= m.voices.length) return m
    return replaceVoice(m, voiceIndex, (voice) =>
      voice.filter((_, i) => i !== elementIndex),
    )
  })
}

/** Deep-clone elements with fresh ids (for copy/paste). */
export function cloneElements(els: NoteElement[]): NoteElement[] {
  return els.map((el) => ({
    ...el,
    id: uid(),
    pitches: el.pitches.map((p) => ({ ...p })),
    duration: {
      ...el.duration,
      ...(el.duration.tuplet ? { tuplet: { ...el.duration.tuplet } } : {}),
    },
    ...(el.accidentals ? { accidentals: [...el.accidentals] } : {}),
    ...(el.articulations ? { articulations: [...el.articulations] } : {}),
    ...(el.slurStart ? { slurStart: true } : {}),
    ...(el.slurStop ? { slurStop: true } : {}),
    ...(el.dynamic ? { dynamic: el.dynamic } : {}),
  }))
}

/** Collect elements in [start..end] (inclusive) within one part+voice. */
export function collectRange(
  score: Score,
  partIndex: number,
  voiceIndex: number,
  startMeasure: number,
  startEl: number,
  endMeasure: number,
  endEl: number,
): NoteElement[] {
  const part = score.parts[partIndex]
  if (!part) return []
  const out: NoteElement[] = []
  for (let mi = startMeasure; mi <= endMeasure; mi++) {
    const voice = part.measures[mi]?.voices[voiceIndex]
    if (!voice) continue
    const from = mi === startMeasure ? startEl : 0
    const to = mi === endMeasure ? endEl : voice.length - 1
    for (let i = from; i <= to && i < voice.length; i++) out.push(voice[i])
  }
  return out
}

/** Delete elements in [start..end] (inclusive) within one part+voice. */
export function deleteRange(
  score: Score,
  partIndex: number,
  voiceIndex: number,
  startMeasure: number,
  startEl: number,
  endMeasure: number,
  endEl: number,
): Score {
  const parts = score.parts.map((p, pi) => {
    if (pi !== partIndex) return p
    const measures = p.measures.map((m, mi) => {
      if (mi < startMeasure || mi > endMeasure) return m
      const voice = m.voices[voiceIndex]
      if (!voice) return m
      const from = mi === startMeasure ? startEl : 0
      const to = mi === endMeasure ? endEl : voice.length - 1
      const next = voice.filter((_, i) => i < from || i > to)
      return replaceVoice(m, voiceIndex, () => next)
    })
    return { ...p, measures }
  })
  return { ...score, parts }
}

/** Insert several elements at once into a voice (for paste). */
export function insertElements(
  score: Score,
  partIndex: number,
  measureIndex: number,
  voiceIndex: number,
  elementIndex: number,
  elements: NoteElement[],
): Score {
  if (elements.length === 0) return score
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    if (voiceIndex < 0 || voiceIndex >= m.voices.length) return m
    return replaceVoice(m, voiceIndex, (voice) => {
      const next = [...voice]
      const at = Math.max(0, Math.min(elementIndex, next.length))
      next.splice(at, 0, ...elements)
      return next
    })
  })
}

/** Transform a single element in place (immutably). No-op if out of range. */
export function updateElement(
  score: Score,
  partIndex: number,
  measureIndex: number,
  voiceIndex: number,
  elementIndex: number,
  updater: (el: NoteElement) => NoteElement,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) => {
    if (voiceIndex < 0 || voiceIndex >= m.voices.length) return m
    return replaceVoice(m, voiceIndex, (voice) =>
      voice.map((el, i) => (i === elementIndex ? updater(el) : el)),
    )
  })
}

/** Toggle an articulation code on an element (notes only). */
export function toggleArticulation(el: NoteElement, code: string): NoteElement {
  if (el.kind !== 'note') return el
  const cur = el.articulations ?? []
  const has = cur.includes(code)
  const next = has ? cur.filter((a) => a !== code) : [...cur, code]
  return { ...el, articulations: next }
}

/** Add an empty voice to a measure (caps at 4 voices). */
export function addVoice(
  score: Score,
  partIndex: number,
  measureIndex: number,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) =>
    m.voices.length >= 4 ? m : { ...m, voices: [...m.voices, []] },
  )
}

/** Remove a voice from a measure (always keeps at least one). */
export function removeVoice(
  score: Score,
  partIndex: number,
  measureIndex: number,
  voiceIndex: number,
): Score {
  return replaceMeasure(score, partIndex, measureIndex, (m) =>
    m.voices.length <= 1
      ? m
      : { ...m, voices: m.voices.filter((_, i) => i !== voiceIndex) },
  )
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

/** Set (or clear with undefined) the tempo starting at `measureIndex`. */
export function setMeasureTempo(
  score: Score,
  measureIndex: number,
  tempo: number | undefined,
): Score {
  const parts = score.parts.map((p) => ({
    ...p,
    measures: p.measures.map((m, i) => {
      if (i !== measureIndex) return m
      const next = { ...m }
      if (tempo === undefined) delete next.tempo
      else next.tempo = tempo
      return next
    }),
  }))
  return { ...score, parts }
}

/** Effective tempo (quarter BPM) at each measure index, following overrides. */
export function tempoTimeline(score: Score): number[] {
  const count = Math.max(0, ...score.parts.map((p) => p.measures.length))
  const longest = score.parts.reduce(
    (a, p) => (p.measures.length >= a.measures.length ? p : a),
    score.parts[0],
  )
  const out: number[] = []
  let cur = score.tempo
  for (let i = 0; i < count; i++) {
    const t = longest?.measures[i]?.tempo
    if (t !== undefined) cur = t
    out.push(cur)
  }
  return out
}

// --- whole-score transpose --------------------------------------------------

const fifthsToPc = (f: number): number => (((f * 7) % 12) + 12) % 12
function pcToFifths(pc: number): number {
  for (let f = -5; f <= 6; f++) if (fifthsToPc(f) === pc) return f
  return 0
}

/** Transpose every written pitch (and key signatures) by `semitones`. */
export function transposeScore(score: Score, semitones: number): Score {
  if (semitones === 0) return score
  const shiftKey = (fifths: number) =>
    pcToFifths((fifthsToPc(fifths) + semitones) % 12)

  const mapEl = (el: NoteElement): NoteElement => {
    if (el.kind !== 'note') return el
    const pitches = el.pitches.map((p) =>
      midiToPitch(pitchToMidi(p) + semitones),
    )
    // Drop forced accidental overrides; they re-derive from the new alter.
    const { accidentals: _drop, ...rest } = el
    void _drop
    return { ...rest, pitches }
  }

  const parts = score.parts.map((part) => ({
    ...part,
    measures: part.measures.map((m) => ({
      ...m,
      voices: m.voices.map((v) => v.map(mapEl)),
      ...(m.keyFifths !== undefined ? { keyFifths: shiftKey(m.keyFifths) } : {}),
    })),
  }))
  return { ...score, parts, keyFifths: shiftKey(score.keyFifths) }
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
