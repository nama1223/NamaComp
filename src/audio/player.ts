// Lightweight Web Audio playback. No external dependency — a small triangle
// oscillator + ADSR per note is plenty for draft/preview playback. Timing is
// measure-aligned so multiple parts stay in sync even when a measure isn't
// completely filled with notes.

import type { Score } from '../types/score'
import { durationToWholeFraction, measureCapacityWhole } from '../model/duration'
import { midiToFreq, pitchToMidi } from '../model/pitch'

export interface PlayEvent {
  /** Seconds from playback start. */
  time: number
  /** Seconds the note sounds. */
  dur: number
  freq: number
}

/** Flatten a score into scheduled note events (seconds), applying transpose. */
export function scoreToEvents(score: Score): { events: PlayEvent[]; total: number } {
  const events: PlayEvent[] = []
  const secPerWhole = 240 / score.tempo // whole note seconds = 4 * (60/bpm)

  for (const part of score.parts) {
    // Measure-aligned: each measure starts at its boundary so parts stay in
    // sync even when a bar isn't completely filled.
    let measureStart = 0
    for (const measure of part.measures) {
      const time = measure.time ?? score.time
      const measureSec = measureCapacityWhole(time) * secPerWhole

      let local = measureStart
      for (const el of measure.elements) {
        const durSec = durationToWholeFraction(el.duration) * secPerWhole
        if (el.kind === 'note') {
          for (const pitch of el.pitches) {
            const midi = pitchToMidi(pitch) + part.transpose
            events.push({ time: local, dur: durSec, freq: midiToFreq(midi) })
          }
        }
        local += durSec
      }
      measureStart += measureSec
    }
  }

  // End at the last sounding note (avoid long silence from trailing empty bars).
  const total = events.reduce((m, e) => Math.max(m, e.time + e.dur), 0)
  return { events, total }
}

export class Player {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private endTimer: ReturnType<typeof setTimeout> | null = null
  onEnded: (() => void) | null = null

  get isPlaying(): boolean {
    return this.ctx !== null
  }

  play(score: Score): void {
    this.stop()
    const { events, total } = scoreToEvents(score)
    if (events.length === 0) {
      this.onEnded?.()
      return
    }

    const ctx = new AudioContext()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(ctx.destination)
    this.master = master

    const start = ctx.currentTime + 0.06
    for (const ev of events) {
      this.scheduleNote(ctx, master, ev, start)
    }

    this.endTimer = setTimeout(
      () => {
        this.stop()
        this.onEnded?.()
      },
      (total + 0.4) * 1000,
    )
  }

  private scheduleNote(
    ctx: AudioContext,
    dest: GainNode,
    ev: PlayEvent,
    start: number,
  ): void {
    const t0 = start + ev.time
    const t1 = t0 + ev.dur

    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = ev.freq

    const gain = ctx.createGain()
    const peak = 0.32
    const attack = 0.008
    const release = Math.min(0.12, ev.dur * 0.4)
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + attack)
    gain.gain.setValueAtTime(peak, Math.max(t0 + attack, t1 - release))
    gain.gain.linearRampToValueAtTime(0, t1)

    osc.connect(gain)
    gain.connect(dest)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }

  stop(): void {
    if (this.endTimer !== null) {
      clearTimeout(this.endTimer)
      this.endTimer = null
    }
    if (this.ctx) {
      this.ctx.close().catch(() => undefined)
      this.ctx = null
      this.master = null
    }
  }
}
