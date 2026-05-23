import { useEffect, useRef } from 'react'
import { Beam, Formatter, Renderer, Stave, StaveNote, Tuplet, Voice } from 'vexflow'
import type { Measure, NoteElement, Part, Score } from '../types/score'
import type { Cursor } from '../types/editor'
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
  /** When set, this box targets a specific note/rest within the measure. */
  elementIndex?: number
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
    elementIndex?: number,
  ) => void
  /** Highlights the cursor cell in red to signal "tap a note to erase". */
  eraser?: boolean
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

          const stave = new Stave(x, y, w)
          if (isFirst) {
            stave.addClef(part.clef)
            stave.addKeySignature(keyName(measure?.keyFifths ?? score.keyFifths))
            const time = measure?.time ?? score.time
            stave.addTimeSignature(`${time.beats}/${time.beatType}`)
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
            part,
            measure,
            measureIndex,
            partIndex: pi,
            isFirst,
            score,
            cursor,
            preview: preview ?? null,
            previewOverflow: !!previewOverflow,
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
    const noteHit = hitboxRef.current.find(
      (b) => b.elementIndex !== undefined && inside(b),
    )
    if (noteHit) {
      onCellClick(noteHit.partIndex, noteHit.measureIndex, noteHit.elementIndex)
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
  part: Part
  measure: Measure | undefined
  measureIndex: number
  partIndex: number
  isFirst: boolean
  score: Score
  cursor: Cursor
  preview: NoteElement | null
  previewOverflow: boolean
}

interface ElementHit {
  elementIndex: number
  x: number
  w: number
}

function drawMeasure(args: DrawMeasureArgs): ElementHit[] {
  const {
    ctx,
    stave,
    part,
    measure,
    measureIndex,
    partIndex,
    isFirst,
    score,
    cursor,
    preview,
    previewOverflow,
  } = args

  const elements: NoteElement[] = measure ? [...measure.elements] : []
  const isCursorCell =
    cursor.partIndex === partIndex && cursor.measureIndex === measureIndex
  const showPreview = isCursorCell && preview != null

  // When the preview would overflow, colour the already-committed notes red too.
  const overflowExisting = showPreview && previewOverflow

  // Build the tickables.
  const notes: StaveNote[] = []
  if (elements.length === 0 && !showPreview) {
    // Empty measure -> display-only whole rest.
    notes.push(buildStaveNote(makeRest({ value: 1, dots: 0 }), part.clef))
  } else {
    for (const el of elements) {
      const style = overflowExisting ? NOTE_STYLE_OVERFLOW : undefined
      notes.push(buildStaveNote(el, part.clef, style))
    }
    if (showPreview && preview) {
      const style = previewOverflow ? NOTE_STYLE_OVERFLOW : NOTE_STYLE_PREVIEW
      notes.push(buildStaveNote(preview, part.clef, style))
    }
  }

  if (notes.length === 0) return []

  const time = measure?.time ?? score.time
  const voice = new Voice({ numBeats: time.beats, beatValue: time.beatType })
  voice.setStrict(false)
  voice.addTickables(notes)

  // Group consecutive committed notes that share a tuplet ratio. Constructed
  // before formatting so the tuplet tick-scaling is taken into account.
  const tuplets: Tuplet[] = []
  {
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
  }

  const noteAreaPad = isFirst ? 90 : 22
  const noteAreaWidth = Math.max(60, stave.getWidth() - noteAreaPad)

  try {
    new Formatter().joinVoices([voice]).format([voice], noteAreaWidth)
  } catch (err) {
    console.warn('[NamaComp] format failed for measure', measureIndex, err)
  }

  let beams: Beam[] = []
  try {
    beams = Beam.generateBeams(notes)
  } catch {
    beams = []
  }

  voice.draw(ctx, stave)
  for (const beam of beams) {
    beam.setContext(ctx).draw()
  }
  for (const t of tuplets) {
    t.setContext(ctx).draw()
  }

  // After formatting, the first `elements.length` notes correspond 1:1 to the
  // committed elements (preview / empty-rest come after). Map their x → hitboxes.
  const hits: ElementHit[] = []
  const realCount = elements.length
  const PAD_R = 26
  const staveRight = stave.getX() + stave.getWidth()
  const startX = stave.getNoteStartX()
  for (let i = 0; i < realCount; i++) {
    const note = notes[i]
    if (!note) break
    let xi: number
    try {
      xi = note.getAbsoluteX()
    } catch {
      continue
    }
    const prev = i > 0 ? notes[i - 1].getAbsoluteX() : startX
    const next = i < realCount - 1 ? notes[i + 1].getAbsoluteX() : xi + PAD_R
    const left = i === 0 ? startX : (prev + xi) / 2
    const right = i === realCount - 1 ? Math.min(next, staveRight) : (xi + next) / 2
    hits.push({ elementIndex: i, x: left, w: Math.max(8, right - left) })
  }
  return hits
}
