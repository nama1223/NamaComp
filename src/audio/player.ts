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
    // sync even when a bar isn't completely filled. A time-signature override
    // persists from its measure onward (matches the renderer).
    let measureStart = 0
    let curTime = score.time
    for (const measure of part.measures) {
      if (measure.time) curTime = measure.time
      const measureSec = measureCapacityWhole(curTime) * secPerWhole

      // Each voice runs in parallel, restarting at the measure boundary.
      for (const voice of measure.voices) {
        let local = measureStart
        for (const el of voice) {
          const durSec = durationToWholeFraction(el.duration) * secPerWhole
          if (el.kind === 'note') {
            for (const pitch of el.pitches) {
              const midi = pitchToMidi(pitch) + part.transpose
              events.push({ time: local, dur: durSec, freq: midiToFreq(midi) })
            }
          }
          local += durSec
        }
      }
      measureStart += measureSec
    }
  }

  // End at the last sounding note (avoid long silence from trailing empty bars).
  const total = events.reduce((m, e) => Math.max(m, e.time + e.dur), 0)
  return { events, total }
}

/** Cumulative start time (seconds) of each measure — drives the playhead. */
export function measureStartTimes(score: Score): number[] {
  const count = Math.max(0, ...score.parts.map((p) => p.measures.length))
  if (count === 0) return []
  const secPerWhole = 240 / score.tempo
  // The longest part sources per-measure time overrides (falls back to global).
  const longest = score.parts.reduce(
    (a, p) => (p.measures.length >= a.measures.length ? p : a),
    score.parts[0],
  )
  const starts: number[] = []
  let t = 0
  let curTime = score.time
  for (let i = 0; i < count; i++) {
    if (longest.measures[i]?.time) curTime = longest.measures[i]!.time!
    starts.push(t)
    t += measureCapacityWhole(curTime) * secPerWhole
  }
  return starts
}

/** Schedule one triangle-osc note with a short ADSR onto any audio context.
 *  Shared by live playback (Player) and offline rendering (renderScore). */
export function scheduleNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
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

export class Player {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private endTimer: ReturnType<typeof setTimeout> | null = null
  private startAt = 0
  onEnded: (() => void) | null = null

  get isPlaying(): boolean {
    return this.ctx !== null
  }

  /** Seconds elapsed since playback began (0 before the first note), or null. */
  get currentTime(): number | null {
    if (!this.ctx) return null
    return Math.max(0, this.ctx.currentTime - this.startAt)
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
    this.startAt = start
    for (const ev of events) {
      scheduleNote(ctx, master, ev, start)
    }

    this.endTimer = setTimeout(
      () => {
        this.stop()
        this.onEnded?.()
      },
      (total + 0.4) * 1000,
    )
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
