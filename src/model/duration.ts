// Duration arithmetic, expressed in "whole-note fractions" so every note value,
// dot, and tuplet collapses to a single comparable number. A quarter note = 0.25.

import type { Duration, NoteValue, TimeSignature } from '../types/score'

const VEX_BASE: Record<NoteValue, string> = {
  1: 'w',
  2: 'h',
  4: 'q',
  8: '8',
  16: '16',
  32: '32',
  64: '64',
}

export const NOTE_VALUES: NoteValue[] = [1, 2, 4, 8, 16, 32, 64]

/** Fraction of a whole note that this duration occupies (incl. dots + tuplet). */
export function durationToWholeFraction(d: Duration): number {
  const base = 1 / d.value
  let total = base
  let increment = base
  for (let i = 0; i < d.dots; i++) {
    increment /= 2
    total += increment
  }
  if (d.tuplet) {
    total = (total * d.tuplet.normal) / d.tuplet.actual
  }
  return total
}

/** VexFlow duration token, e.g. quarter -> "q", dotted handled separately. */
export function vexDuration(value: NoteValue): string {
  return VEX_BASE[value]
}

/** Capacity of one measure as a whole-note fraction (4/4 -> 1.0, 6/8 -> 0.75). */
export function measureCapacityWhole(time: TimeSignature): number {
  return time.beats / time.beatType
}

const EPSILON = 1e-6

export interface FillState {
  used: number
  capacity: number
  remaining: number
  overflow: boolean
}

export function fillState(usedWhole: number, time: TimeSignature): FillState {
  const capacity = measureCapacityWhole(time)
  return {
    used: usedWhole,
    capacity,
    remaining: capacity - usedWhole,
    overflow: usedWhole > capacity + EPSILON,
  }
}

/** Would adding `addWhole` to the current `usedWhole` exceed the measure? */
export function wouldOverflow(
  usedWhole: number,
  addWhole: number,
  time: TimeSignature,
): boolean {
  return usedWhole + addWhole > measureCapacityWhole(time) + EPSILON
}
