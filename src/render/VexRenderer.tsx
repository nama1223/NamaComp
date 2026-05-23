import { useEffect, useRef } from 'react'
import { Beam, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow'
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
}

export interface VexRendererProps {
  score: Score
  zoom: number
  containerWidth: number
  cursor: Cursor
  preview?: NoteElement | null
  previewOverflow?: boolean
  onCellClick?: (partIndex: number, measureIndex: number) => void
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

          // Cursor cell highlight.
          if (
            cursor.partIndex === pi &&
            cursor.measureIndex === measureIndex
          ) {
            ctx.save()
            ctx.setFillStyle(HILITE)
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

          drawMeasure({
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

          hitboxRef.current.push({
            x,
            y: y - 2,
            w,
            h: 64,
            partIndex: pi,
            measureIndex,
          })
        }
        x += w
      }
    }
  }, [score, zoom, containerWidth, cursor, preview, previewOverflow, fontToken])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onCellClick) return
    const svg = hostRef.current?.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const lx = (e.clientX - rect.left) / zoom
    const ly = (e.clientY - rect.top) / zoom
    const hit = hitboxRef.current.find(
      (b) => lx >= b.x && lx <= b.x + b.w && ly >= b.y && ly <= b.y + b.h,
    )
    if (hit) onCellClick(hit.partIndex, hit.measureIndex)
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

function drawMeasure(args: DrawMeasureArgs) {
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

  if (notes.length === 0) return

  const time = measure?.time ?? score.time
  const voice = new Voice({ numBeats: time.beats, beatValue: time.beatType })
  voice.setStrict(false)
  voice.addTickables(notes)

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
}
