// ---------------------------------------------------------------------------
// NamaComp core data model.
//
// This is OUR model, deliberately renderer-agnostic. VexFlow consumes it for
// display, MusicXML/MIDI exporters will read from it, and we can swap the
// rendering engine later without touching this. Keep it expressive but simple.
// ---------------------------------------------------------------------------

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'

/** What accidental glyph to actually draw on a note (independent of key sig). */
export type AccidentalKind =
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'double-sharp'
  | 'double-flat'

export interface Pitch {
  step: Step
  /** Scientific octave. Middle C = C4. */
  octave: number
  /** Chromatic alteration in semitones, -2..2. Drives playback + transposition. */
  alter: number
}

/** Base note value as its denominator: 1=whole, 2=half, 4=quarter, 8=eighth ... */
export type NoteValue = 1 | 2 | 4 | 8 | 16 | 32 | 64

export interface Tuplet {
  /** e.g. triplet = 3 notes ... */
  actual: number
  /** ... in the time of 2. */
  normal: number
}

export interface Duration {
  value: NoteValue
  /** Augmentation dots: 0 (none), 1, 2 (double dot). */
  dots: number
  tuplet?: Tuplet
}

export type ElementKind = 'note' | 'rest'

export interface NoteElement {
  id: string
  kind: ElementKind
  /** Sounding pitches. One = single note, many = chord, empty = rest. */
  pitches: Pitch[]
  duration: Duration
  /** Per-pitch forced accidental display, indexed parallel to `pitches`. */
  accidentals?: (AccidentalKind | null)[]
  articulations?: string[]
  tieStart?: boolean
  tieStop?: boolean
}

export type Clef = 'treble' | 'bass' | 'alto' | 'tenor' | 'percussion'

export interface TimeSignature {
  beats: number
  /** Beat unit denominator: 4 = quarter, 8 = eighth, etc. */
  beatType: number
}

export interface Measure {
  id: string
  /** Independent rhythmic lines on this staff. Always has at least one voice;
   *  voices[0] is the primary voice. */
  voices: NoteElement[][]
  /** Optional per-measure overrides; fall back to the part / score defaults. */
  clef?: Clef
  keyFifths?: number
  time?: TimeSignature
}

export interface Part {
  id: string
  /** Short label shown on the staff, e.g. "Trp". */
  name: string
  /** Full instrument name, e.g. "Trumpet in Bb". */
  fullName?: string
  clef: Clef
  /** Written-vs-sounding transposition in semitones (Bb trumpet = -2). */
  transpose: number
  measures: Measure[]
}

export interface Score {
  title: string
  composer?: string
  fileName: string
  parts: Part[]
  /** Global defaults; measures/parts may override. */
  keyFifths: number
  time: TimeSignature
  /** Quarter-note BPM. */
  tempo: number
}
