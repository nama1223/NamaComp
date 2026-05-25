// Maps NamaComp model elements onto VexFlow tickables. Kept separate from the
// React renderer so the model<->VexFlow translation is testable in isolation.

import { Articulation, Dot, StaveNote } from 'vexflow'
import type { AccidentalKind, Clef, NoteElement, Pitch } from '../types/score'
import { vexDuration } from '../model/duration'

// Our articulation code → VexFlow articulation glyph code.
export const ARTICULATION_VEX: Record<string, string> = {
  staccato: 'a.',
  accent: 'a>',
  tenuto: 'a-',
  marcato: 'a^',
  fermata: 'a@a',
}

const STEP_LOWER: Record<string, string> = {
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  A: 'a',
  B: 'b',
}

// Where a rest sits, per clef (VexFlow centres the rest glyph on this key).
const REST_KEY: Record<Clef, string> = {
  treble: 'b/4',
  bass: 'd/3',
  alto: 'c/4',
  tenor: 'a/3',
  percussion: 'b/4',
}

const ALTER_LETTER: Record<number, string> = {
  2: '##',
  1: '#',
  0: '',
  '-1': 'b',
  '-2': 'bb',
}

// The key encodes the pitch's alteration so VexFlow's Accidental.applyAccidentals
// can decide which accidentals (incl. naturals to cancel) to actually display.
export function pitchToVexKey(p: Pitch): string {
  return `${STEP_LOWER[p.step]}${ALTER_LETTER[p.alter] ?? ''}/${p.octave}`
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

  // Accidentals are applied later via Accidental.applyAccidentals (per measure),
  // which encodes the key signature + prior-accidental context correctly.

  if (el.duration.dots > 0) {
    for (let d = 0; d < el.duration.dots; d++) {
      Dot.buildAndAttach([note], { all: true })
    }
  }

  // Articulations (staccato / accent / tenuto / marcato / fermata).
  if (el.articulations && el.articulations.length > 0) {
    for (const a of el.articulations) {
      const code = ARTICULATION_VEX[a]
      if (!code) continue
      try {
        const art = new Articulation(code)
        // Fermata always above; others above the note too (clear for drafts).
        art.setPosition(3) // 3 = ABOVE
        note.addModifier(art, 0)
      } catch {
        /* ignore unknown glyph */
      }
    }
  }

  if (style) {
    note.setStyle(style)
  }

  return note
}
