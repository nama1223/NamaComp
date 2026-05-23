// Maps NamaComp model elements onto VexFlow tickables. Kept separate from the
// React renderer so the model<->VexFlow translation is testable in isolation.

import { Accidental, Dot, StaveNote } from 'vexflow'
import type { AccidentalKind, Clef, NoteElement, Pitch } from '../types/score'
import { vexDuration } from '../model/duration'

const STEP_LOWER: Record<string, string> = {
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  A: 'a',
  B: 'b',
}

const ACCIDENTAL_GLYPH: Record<AccidentalKind, string> = {
  sharp: '#',
  flat: 'b',
  natural: 'n',
  'double-sharp': '##',
  'double-flat': 'bb',
}

// Where a rest sits, per clef (VexFlow centres the rest glyph on this key).
const REST_KEY: Record<Clef, string> = {
  treble: 'b/4',
  bass: 'd/3',
  alto: 'c/4',
  tenor: 'a/3',
  percussion: 'b/4',
}

export function pitchToVexKey(p: Pitch): string {
  return `${STEP_LOWER[p.step]}/${p.octave}`
}

export function alterToAccidental(alter: number): AccidentalKind | null {
  switch (alter) {
    case 2:
      return 'double-sharp'
    case 1:
      return 'sharp'
    case -1:
      return 'flat'
    case -2:
      return 'double-flat'
    default:
      return null
  }
}

export interface NoteStyle {
  fillStyle: string
  strokeStyle: string
}

export function durationToken(el: NoteElement): string {
  return vexDuration(el.duration.value) + (el.kind === 'rest' ? 'r' : '')
}

/** Build a VexFlow StaveNote from a model element (note or rest). */
export function buildStaveNote(
  el: NoteElement,
  clef: Clef,
  style?: NoteStyle,
): StaveNote {
  const isRest = el.kind === 'rest'
  const keys = isRest
    ? [REST_KEY[clef]]
    : el.pitches.map(pitchToVexKey)

  const note = new StaveNote({
    keys,
    duration: durationToken(el),
    clef,
    autoStem: true,
  })

  if (!isRest) {
    el.pitches.forEach((pitch, i) => {
      const explicit = el.accidentals?.[i] ?? null
      const kind = explicit ?? alterToAccidental(pitch.alter)
      if (kind) {
        note.addModifier(new Accidental(ACCIDENTAL_GLYPH[kind]), i)
      }
    })
  }

  if (el.duration.dots > 0) {
    for (let d = 0; d < el.duration.dots; d++) {
      Dot.buildAndAttach([note], { all: true })
    }
  }

  if (style) {
    note.setStyle(style)
  }

  return note
}
