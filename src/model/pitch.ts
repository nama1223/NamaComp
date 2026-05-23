// Shared pitch math: model Pitch <-> MIDI <-> frequency.

import type { Pitch, Step } from '../types/score'

const STEP_SEMITONE: Record<Step, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

// Default enharmonic spelling (sharps for black keys).
const SHARP_SPELL: [Step, number][] = [
  ['C', 0],
  ['C', 1],
  ['D', 0],
  ['D', 1],
  ['E', 0],
  ['F', 0],
  ['F', 1],
  ['G', 0],
  ['G', 1],
  ['A', 0],
  ['A', 1],
  ['B', 0],
]

export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONE[p.step] + p.alter
}

export function midiToPitch(midi: number): Pitch {
  const pc = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  const [step, alter] = SHARP_SPELL[pc]
  return { step, octave, alter }
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
