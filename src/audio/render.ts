// Offline audio rendering for file export. Reuses the exact note synthesis
// (triangle + ADSR) used for live playback, rendered into an AudioBuffer.

import type { Score } from '../types/score'
import { scoreToEvents, scheduleNote } from './player'

const SAMPLE_RATE = 44100

export async function renderScore(score: Score): Promise<AudioBuffer> {
  const { events, total } = scoreToEvents(score)
  const seconds = Math.max(0.2, total + 0.4)
  const length = Math.ceil(seconds * SAMPLE_RATE)

  // OfflineAudioContext signature differs slightly across browsers; the
  // numeric form is the most widely supported.
  const ctx = new OfflineAudioContext(1, length, SAMPLE_RATE)
  const master = ctx.createGain()
  master.gain.value = 0.8
  master.connect(ctx.destination)

  for (const ev of events) scheduleNote(ctx, master, ev, 0)

  return ctx.startRendering()
}
