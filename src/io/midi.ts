// Standard MIDI File (SMF) Format 1 exporter.
//
// Track 0 is a conductor track (tempo / time sig / key sig); each part becomes
// its own track on its own channel. Pitches are written as SOUNDING pitch
// (written pitch + part.transpose) so the file plays back in concert key.

import type { Part, Score } from '../types/score'
import { durationToWholeFraction, measureCapacityWhole } from './../model/duration'
import { pitchToMidi } from '../model/pitch'

const DIVISION = 480 // ticks per quarter note
const TICKS_PER_WHOLE = DIVISION * 4
const VELOCITY = 80

/** Variable-length quantity (big-endian, 7 bits per byte, high bit = continue). */
function vlq(value: number): number[] {
  let v = Math.max(0, Math.round(value))
  const out = [v & 0x7f]
  v = Math.floor(v / 128)
  while (v > 0) {
    out.unshift((v & 0x7f) | 0x80)
    v = Math.floor(v / 128)
  }
  return out
}

function ascii(s: string): number[] {
  const out: number[] = []
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out.push(c < 128 ? c : 63 /* '?' for non-ASCII */)
  }
  return out
}

function chunk(id: string, data: number[]): number[] {
  const len = data.length
  return [
    ...ascii(id),
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...data,
  ]
}

/** A rough General MIDI program guess from the part's name. */
function gmProgram(part: Part): number {
  const n = (part.fullName || part.name || '').toLowerCase()
  if (n.includes('trumpet') || n.includes('trp')) return 56
  if (n.includes('trombone') || n.includes('trb')) return 57
  if (n.includes('tuba')) return 58
  if (n.includes('horn')) return 60
  if (n.includes('sax')) return 65
  if (n.includes('flute')) return 73
  if (n.includes('clarinet') || n.includes('cl')) return 71
  if (n.includes('oboe')) return 68
  if (n.includes('piano') || n.includes('pf')) return 0
  if (n.includes('violin') || n.includes('vn')) return 40
  if (n.includes('cello') || n.includes('vc')) return 42
  if (n.includes('bass')) return 32
  return 0
}

interface MidiEvent {
  tick: number
  order: number // tie-break: note-off (0) before note-on (1) at the same tick
  data: number[]
}

function buildPartTrack(part: Part, channelIndex: number, score: Score): number[] {
  // Avoid channel 9 (GM percussion) for melodic parts.
  const channel = channelIndex < 9 ? channelIndex : (channelIndex + 1) % 16
  const events: MidiEvent[] = []

  let measureStart = 0
  let curTime = score.time
  for (const measure of part.measures) {
    if (measure.time) curTime = measure.time
    let local = measureStart
    for (const el of measure.elements) {
      const durTick = Math.round(
        durationToWholeFraction(el.duration) * TICKS_PER_WHOLE,
      )
      if (el.kind === 'note') {
        for (const pitch of el.pitches) {
          const key = Math.max(
            0,
            Math.min(127, pitchToMidi(pitch) + part.transpose),
          )
          events.push({
            tick: local,
            order: 1,
            data: [0x90 | channel, key, VELOCITY],
          })
          events.push({
            tick: local + durTick,
            order: 0,
            data: [0x80 | channel, key, 0],
          })
        }
      }
      local += durTick
    }
    measureStart += Math.round(measureCapacityWhole(curTime) * TICKS_PER_WHOLE)
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order)

  const bytes: number[] = []
  // Track name + program change at tick 0.
  const name = ascii(part.name || `Part ${channelIndex + 1}`)
  bytes.push(...vlq(0), 0xff, 0x03, ...vlq(name.length), ...name)
  bytes.push(...vlq(0), 0xc0 | channel, gmProgram(part))

  let prev = 0
  for (const ev of events) {
    bytes.push(...vlq(ev.tick - prev), ...ev.data)
    prev = ev.tick
  }
  bytes.push(...vlq(0), 0xff, 0x2f, 0x00) // end of track
  return bytes
}

function buildConductorTrack(score: Score): number[] {
  const bytes: number[] = []

  // Tempo (microseconds per quarter note).
  const mpq = Math.round(60000000 / score.tempo)
  bytes.push(
    ...vlq(0),
    0xff,
    0x51,
    0x03,
    (mpq >> 16) & 0xff,
    (mpq >> 8) & 0xff,
    mpq & 0xff,
  )

  // Time signature.
  const dd = Math.round(Math.log2(score.time.beatType))
  bytes.push(...vlq(0), 0xff, 0x58, 0x04, score.time.beats, dd, 24, 8)

  // Key signature.
  const sf = score.keyFifths < 0 ? 256 + score.keyFifths : score.keyFifths
  bytes.push(...vlq(0), 0xff, 0x59, 0x02, sf & 0xff, 0)

  // Title.
  const title = ascii(score.title || 'NamaComp')
  bytes.push(...vlq(0), 0xff, 0x03, ...vlq(title.length), ...title)

  bytes.push(...vlq(0), 0xff, 0x2f, 0x00)
  return bytes
}

export function exportMIDI(score: Score): Uint8Array {
  const ntrks = score.parts.length + 1
  const header = [
    0x00,
    0x01, // format 1
    (ntrks >> 8) & 0xff,
    ntrks & 0xff,
    (DIVISION >> 8) & 0xff,
    DIVISION & 0xff,
  ]

  const out: number[] = [
    ...chunk('MThd', header),
    ...chunk('MTrk', buildConductorTrack(score)),
  ]
  score.parts.forEach((part, i) => {
    out.push(...chunk('MTrk', buildPartTrack(part, i, score)))
  })

  return Uint8Array.from(out)
}
