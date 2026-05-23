import { useEffect, useRef } from 'react'
import {
  Beam,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow'
import type {
  Clef,
  Measure,
  NoteElement,
  Score,
  TimeSignature,
} from '../types/score'
import type { Cursor, NormSelection } from '../types/editor'
import { inNormSelection } from '../types/editor'
import { makeRest } from '../model/score'
import { buildStaveNote, type NoteStyle } from './vexMap'

// Logical layout constants (pre-zoom). Zoom is applied via context.scale().
const LABEL_W = 46
const LEFT_PAD = 6
const TOP_PAD = 10
const STAVE_H = 86 // vertical advance per part inside a system
const SYSTEM_GAP = 30
const MEASURE_W = 210
const FIRST_EXTRA = 64 // extra width for clef/key/time on a system's first measure
const RIGHT_MARGIN = 14

const COLOR_NORMAL = '#16181d'
const COLOR_PREVIEW = '#1d6fe0'
const COLOR_OVERFLOW = '#e23b3b'
const HILITE = 'rgba(29,111,224,0.10)'
const HILITE_ERASE = 'rgba(226,59,59,0.12)'
const HILITE_PLAY = 'rgba(34,180,90,0.18)'

const NOTE_STYLE_PREVIEW: NoteStyle = {
  fillStyle: COLOR_PREVIEW,
  strokeStyle: COLOR_PREVIEW,
}
const NOTE_STYLE_OVERFLOW: NoteStyle = {
  fillStyle: COLOR_OVERFLOW,
  strokeStyle: COLOR_OVERFLOW,
}
const COLOR_SELECT = '#8a3ffc'
const NOTE_STYLE_SELECT: NoteStyle = {
  fillStyle: COLOR_SELECT,
  strokeStyle: COLOR_SELECT,
}

const KEY_NAMES = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
  'C',
  'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
]
function keyName(fifths: number): string {
  return KEY_NAMES[fifths + 7] ?? 'C'
}

export interface HitBox {
  x: number
  y: number
  w: number
  h: number
  partIndex: number
  measureIndex: number
  /** When set, this box targets a specific note/rest within a voice. */
  voiceIndex?: number
  elementIndex?: number
}

export interface ClickTarget {
  voiceIndex: number
  elementIndex: number
}

export interface VexRendererProps {
  score: Score
  zoom: number
  containerWidth: number
  cursor: Cursor
  preview?: NoteElement | null
  previewOverflow?: boolean
  onCellClick?: (
    partIndex: number,
    measureIndex: number,
    target?: ClickTarget,
  ) => void
  /** Highlights the cursor cell in red to signal "tap a note to erase". */
  eraser?: boolean
  /** Selected element range (highlighted), or null. */
  selection?: NormSelection | null
  /** Measure index currently being played (highlighted green), or null. */
  playMeasure?: number | null
  /** Only used as a redraw trigger when the active music font changes. */
  fontToken?: string
}

export function VexRenderer({
  score,
  zoom,
  containerWidth,
  cursor,
  preview,
  previewOverflow,
  onCellClick,
  eraser,
  selection,
  playMeasure,
  fontToken,
}: VexRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const hitboxRef = useRef<HitBox[]>([])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = ''
    hitboxRef.current = []

    const parts = score.parts
    if (parts.length === 0) return

    const logicalW = Math.max(320, containerWidth / zoom)
    const usableW = logicalW - LABEL_W - LEFT_PAD - RIGHT_MARGIN
    const measuresPerSystem = Math.max(
      1,
      Math.floor((usableW - FIRST_EXTRA) / MEASURE_W) + 1,
    )
    const totalMeasures = Math.max(...parts.map((p) => p.measures.length))
    const systemCount = Math.max(1, Math.ceil(totalMeasures / measuresPerSystem))

    const systemHeight = parts.length * STAVE_H + SYSTEM_GAP
    const logicalH = TOP_PAD + systemCount * systemHeight

    // Per-part running clef/key/time + "changed here" flags, so mid-piece
    // clef/key/time changes are drawn (and persist) from their measure on.
    const effClef: Clef[][] = []
    const clefChange: boolean[][] = []
    const effKey: number[][] = []
    const keyChange: boolean[][] = []
    const effTime: TimeSignature[][] = []
    const timeChange: boolean[][] = []
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi]
      let curClef: Clef = p.clef
      let curKey = score.keyFifths
      let curTime = score.time
      const ec: Clef[] = []
      const cc: boolean[] = []
      const ek: number[] = []
      const kc: boolean[] = []
      const et: TimeSignature[] = []
      const tc: boolean[] = []
      for (let mi = 0; mi < totalMeasures; mi++) {
        const m = p.measures[mi]
        let clefChg = false
        let keyChg = false
        let timeChg = false
        if (m?.clef && m.clef !== curClef) {
          curClef = m.clef
          clefChg = true
        }
        if (m && m.keyFifths !== undefined && m.keyFifths !== curKey) {
          curKey = m.keyFifths
          keyChg = true
        }
        if (
          m?.time &&
          (m.time.beats !== curTime.beats || m.time.beatType !== curTime.beatType)
        ) {
          curTime = m.time
          timeChg = true
        }
        ec.push(curClef)
        cc.push(clefChg)
        ek.push(curKey)
        kc.push(keyChg)
        et.push(curTime)
        tc.push(timeChg)
      }
      effClef.push(ec)
      clefChange.push(cc)
      effKey.push(ek)
      keyChange.push(kc)
      effTime.push(et)
      timeChange.push(tc)
    }

    const renderer = new Renderer(host, Renderer.Backends.SVG)
    renderer.resize(logicalW * zoom, logicalH * zoom)
    const ctx = renderer.getContext()
    ctx.scale(zoom, zoom)

    for (let s = 0; s < systemCount; s++) {
      const systemTop = TOP_PAD + s * systemHeight
      const startMeasure = s * measuresPerSystem
      const colCount = Math.min(measuresPerSystem, totalMeasures - startMeasure)

      let x = LABEL_W + LEFT_PAD
      for (let col = 0; col < colCount; col++) {
        const measureIndex = startMeasure + col
        const isFirst = col === 0
        const w = MEASURE_W + (isFirst ? FIRST_EXTRA : 0)

        for (let pi = 0; pi < parts.length; pi++) {
          const part = parts[pi]
          const measure = part.measures[measureIndex]
          const y = systemTop + pi * STAVE_H

          // Playhead: highlight the measure currently sounding.
          if (playMeasure === measureIndex) {
            ctx.save()
            ctx.setFillStyle(HILITE_PLAY)
            ctx.fillRect(x, y - 2, w, 64)
            ctx.restore()
          }

          // Cursor cell highlight (red when erasing).
          if (
            cursor.partIndex === pi &&
            cursor.measureIndex === measureIndex
          ) {
            ctx.save()
            ctx.setFillStyle(eraser ? HILITE_ERASE : HILITE)
            ctx.fillRect(x, y - 2, w, 64)
            ctx.restore()
          }

          const eClef = effClef[pi][measureIndex]
          const eKey = effKey[pi][measureIndex]
          const eTime = effTime[pi][measureIndex]

          const stave = new Stave(x, y, w)
          if (isFirst || clefChange[pi][measureIndex]) stave.addClef(eClef)
          if (isFirst || keyChange[pi][measureIndex]) {
            stave.addKeySignature(keyName(eKey))
          }
          if (isFirst || timeChange[pi][measureIndex]) {
            stave.addTimeSignature(`${eTime.beats}/${eTime.beatType}`)
          }
          stave.setContext(ctx).draw()

          if (isFirst) {
            ctx.save()
            ctx.setFont('Arial', 12, 'bold')
            ctx.setFillStyle(COLOR_NORMAL)
            ctx.fillText(part.name, LEFT_PAD, y + 26)
            ctx.restore()
          }

          const elementHits = drawMeasure({
            ctx,
            stave,
            clef: eClef,
            measure,
            measureIndex,
            partIndex: pi,
            time: eTime,
            cursor,
            preview: preview ?? null,
            previewOverflow: !!previewOverflow,
            selection: selection ?? null,
          })

          // Cell-level hitbox (fallback / append target).
          hitboxRef.current.push({
            x,
            y: y - 2,
            w,
            h: 64,
            partIndex: pi,
            measureIndex,
          })
          // Per-note hitboxes (checked first → tap a note to select/erase it).
          for (const h of elementHits) {
            hitboxRef.current.push({
              x: h.x,
              y: y - 2,
              w: h.w,
              h: 64,
              partIndex: pi,
              measureIndex,
              voiceIndex: h.voiceIndex,
              elementIndex: h.elementIndex,
            })
          }
        }
        x += w
      }
    }
  }, [
    score,
    zoom,
    containerWidth,
    cursor,
    preview,
    previewOverflow,
    eraser,
    selection,
    playMeasure,
    fontToken,
  ])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onCellClick) return
    const svg = hostRef.current?.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const lx = (e.clientX - rect.left) / zoom
    const ly = (e.clientY - rect.top) / zoom
    const inside = (b: HitBox) =>
      lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h
    // Prefer a specific note (small band) over the whole-measure cell box.
    // When voices overlap at the same x, prefer the one in the active voice.
    const noteHits = hitboxRef.current.filter(
      (b) => b.elementIndex !== undefined && inside(b),
    )
    const noteHit =
      noteHits.find((b) => b.voiceIndex === cursor.voiceIndex) ?? noteHits[0]
    if (noteHit) {
      onCellClick(noteHit.partIndex, noteHit.measureIndex, {
        voiceIndex: noteHit.voiceIndex ?? 0,
        elementIndex: noteHit.elementIndex ?? 0,
      })
      return
    }
    const cellHit = hitboxRef.current.find(
      (b) => b.elementIndex === undefined && inside(b),
    )
    if (cellHit) onCellClick(cellHit.partIndex, cellHit.measureIndex)
  }

  return <div ref={hostRef} className="vex-host" onClick={handleClick} />
}

interface DrawMeasureArgs {
  ctx: ReturnType<Renderer['getContext']>
  stave: Stave
  clef: Clef
  measure: Measure | undefined
  measureIndex: number
  partIndex: number
  time: TimeSignature
  cursor: Cursor
  preview: NoteElement | null
  previewOverflow: boolean
  selection: NormSelection | null
}

interface ElementHit {
  voiceIndex: number
  elementIndex: number
  x: number
  w: number
}

// Build the tuplet groups for one voice's notes (mutates notes' tick scaling).
function buildVoiceTuplets(
  elements: NoteElement[],
  notes: StaveNote[],
): Tuplet[] {
  const tuplets: Tuplet[] = []
  const n = elements.length
  let i = 0
  while (i < n) {
    const tup = elements[i].duration.tuplet
    if (tup && notes[i]) {
      let j = i + 1
      while (
        j < n &&
        notes[j] &&
        elements[j].duration.tuplet?.actual === tup.actual &&
        elements[j].duration.tuplet?.normal === tup.normal
      ) {
        j++
      }
      try {
        tuplets.push(
          new Tuplet(notes.slice(i, j), {
            numNotes: tup.actual,
            notesOccupied: tup.normal,
          }),
        )
      } catch {
        /* ignore a malformed tuplet group */
      }
      i = j
    } else {
      i++
    }
  }
  return tuplets
}

function drawMeasure(args: DrawMeasureArgs): ElementHit[] {
  const {
    ctx,
    stave,
    clef,
    measure,
    measureIndex,
    partIndex,
    time,
    cursor,
    preview,
    previewOverflow,
    selection,
  } = args

  const selHere =
    selection && selection.partIndex === partIndex ? selection : null
  const modelVoices: NoteElement[][] = measure ? measure.voices : [[]]
  const isCursorCell =
    cursor.partIndex === partIndex && cursor.measureIndex === measureIndex
  const showPreview = isCursorCell && preview != null
  const multi = modelVoices.length > 1
  const allEmpty = modelVoices.every((v) => v.length === 0)

  const vexVoices: Voice[] = []
  const allTuplets: Tuplet[] = []
  const built: { voiceIndex: number; notes: StaveNote[]; realCount: number }[] =
    []

  modelVoices.forEach((elements, vi) => {
    const showHere = showPreview && vi === cursor.voiceIndex
    const overflowExisting = showHere && previewOverflow
    const notes: StaveNote[] = []

    if (elements.length === 0 && !showHere) {
      // Only voice 0 of a fully-empty measure shows a whole rest; extra empty
      // voices render nothing.
      if (vi === 0 && allEmpty) {
        notes.push(buildStaveNote(makeRest({ value: 1, dots: 0 }), clef))
      } else {
        return
      }
    } else {
      elements.forEach((el, i) => {
        const isSel =
          selHere != null &&
          vi === selHere.voiceIndex &&
          inNormSelection(selHere, measureIndex, i)
        const style = isSel
          ? NOTE_STYLE_SELECT
          : overflowExisting
            ? NOTE_STYLE_OVERFLOW
            : undefined
        notes.push(buildStaveNote(el, clef, style))
      })
      if (showHere && preview) {
        const style = previewOverflow ? NOTE_STYLE_OVERFLOW : NOTE_STYLE_PREVIEW
        notes.push(buildStaveNote(preview, clef, style))
      }
    }

    if (notes.length === 0) return

    // Fixed stem directions keep two voices visually separated.
    if (multi) {
      const dir = vi === 0 ? Stem.UP : vi === 1 ? Stem.DOWN : null
      if (dir !== null) {
        for (const n of notes) {
          try {
            n.setStemDirection(dir)
          } catch {
            /* rests have no stem */
          }
        }
      }
    }

    const voice = new Voice({ numBeats: time.beats, beatValue: time.beatType })
    voice.setStrict(false)
    voice.addTickables(notes)
    vexVoices.push(voice)
    allTuplets.push(...buildVoiceTuplets(elements, notes))
    built.push({ voiceIndex: vi, notes, realCount: elements.length })
  })

  if (vexVoices.length === 0) return []

  // Derive the note area from the stave's actual note-start (accounts for any
  // clef/key/time drawn on this measure, incl. mid-system changes).
  const areaStartX = stave.getNoteStartX()
  const endX = stave.getX() + stave.getWidth()
  const noteAreaWidth = Math.max(60, endX - areaStartX - 14)

  try {
    new Formatter().joinVoices(vexVoices).format(vexVoices, noteAreaWidth)
  } catch (err) {
    console.warn('[NamaComp] format failed for measure', measureIndex, err)
  }

  const beams: Beam[] = []
  for (const b of built) {
    try {
      beams.push(...Beam.generateBeams(b.notes))
    } catch {
      /* ignore */
    }
  }

  for (const voice of vexVoices) voice.draw(ctx, stave)
  for (const beam of beams) beam.setContext(ctx).draw()
  for (const t of allTuplets) t.setContext(ctx).draw()

  // Per-voice, per-note hitboxes (real committed notes only).
  const hits: ElementHit[] = []
  const PAD_R = 26
  const staveRight = stave.getX() + stave.getWidth()
  const startX = stave.getNoteStartX()
  for (const b of built) {
    for (let i = 0; i < b.realCount; i++) {
      const note = b.notes[i]
      if (!note) break
      let xi: number
      try {
        xi = note.getAbsoluteX()
      } catch {
        continue
      }
      const prev = i > 0 ? b.notes[i - 1].getAbsoluteX() : startX
      const next = i < b.realCount - 1 ? b.notes[i + 1].getAbsoluteX() : xi + PAD_R
      const left = i === 0 ? startX : (prev + xi) / 2
      const right =
        i === b.realCount - 1 ? Math.min(next, staveRight) : (xi + next) / 2
      hits.push({
        voiceIndex: b.voiceIndex,
        elementIndex: i,
        x: left,
        w: Math.max(8, right - left),
      })
    }
  }
  return hits
}
