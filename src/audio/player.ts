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
  /** 0..1 loudness (from dynamics). */
  vel: number
}

// Dynamic marking → relative loudness (0..1).
const DYN_VEL: Record<string, number> = {
  ppp: 0.2,
  pp: 0.3,
  p: 0.42,
  mp: 0.55,
  mf: 0.68,
  f: 0.82,
  ff: 0.92,
  fff: 1,
}

/** Per-measure start time (sec) + whole-note seconds, following tempo/time. */
function buildTimeline(score: Score): {
  startSec: number[]
  spw: number[]
  count: number
} {
  const count = Math.max(0, ...score.parts.map((p) => p.measures.length))
  const longest = score.parts.reduce(
    (a, p) => (p.measures.length >= a.measures.length ? p : a),
    score.parts[0],
  )
  const startSec: number[] = []
  const spw: number[] = []
  let t = 0
  let curTempo = score.tempo
  let curTime = score.time
  for (let i = 0; i < count; i++) {
    const m = longest?.measures[i]
    if (m?.tempo !== undefined) curTempo = m.tempo
    if (m?.time) curTime = m.time
    const sec = 240 / curTempo // whole-note seconds at this tempo
    startSec.push(t)
    spw.push(sec)
    t += measureCapacityWhole(curTime) * sec
  }
  return { startSec, spw, count }
}

/** Flatten a score into scheduled note events (seconds), applying transpose,
 *  per-measure tempo, and dynamics (which persist per part). */
export function scoreToEvents(score: Score): { events: PlayEvent[]; total: number } {
  const events: PlayEvent[] = []
  const { startSec, spw } = buildTimeline(score)

  for (const part of score.parts) {
    let vel = DYN_VEL.mf // current dynamic for this part
    part.measures.forEach((measure, mi) => {
      const sec = spw[mi] ?? 240 / score.tempo
      const base = startSec[mi] ?? 0
      for (const voice of measure.voices) {
        let local = base
        for (const el of voice) {
          if (el.dynamic && DYN_VEL[el.dynamic] !== undefined) {
            vel = DYN_VEL[el.dynamic]
          }
          const durSec = durationToWholeFraction(el.duration) * sec
          if (el.kind === 'note') {
            for (const pitch of el.pitches) {
              const midi = pitchToMidi(pitch) + part.transpose
              events.push({ time: local, dur: durSec, freq: midiToFreq(midi), vel })
            }
          }
          local += durSec
        }
      }
    })
  }

  const total = events.reduce((m, e) => Math.max(m, e.time + e.dur), 0)
  return { events, total }
}

/** Cumulative start time (seconds) of each measure — drives the playhead. */
export function measureStartTimes(score: Score): number[] {
  return buildTimeline(score).startSec
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
  const peak = 0.32 * (ev.vel ?? 0.68)
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
