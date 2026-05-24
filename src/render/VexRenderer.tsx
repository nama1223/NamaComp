import { useEffect, useRef } from 'react'
import {
  Beam,
  Curve,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  Tuplet,
  Voice,
} from 'vexflow'
import { tempoTimeline } from '../model/score'
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
// Per-voice colours so 1st/2nd/3rd/4th voices are distinguishable.
const VOICE_COLOR = ['#16181d', '#1f6feb', '#1f9d57', '#c2255c']
const VOICE_COLOR_DIM = [
  'rgba(22,24,29,0.32)',
  'rgba(31,111,235,0.38)',
  'rgba(31,157,87,0.42)',
  'rgba(194,37,92,0.42)',
]
const CARET_COLOR = '#e8590c' // insertion-point vertical line

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
  /** Vertical/uniform scale (glyph size). */
  zoomY: number
  /** Horizontal spread (note spacing); glyphs unaffected. */
  zoomX: number
  containerWidth: number
  cursor: Cursor
  preview?: NoteElement | null
  previewOverflow?: boolean
  onCellClick?: (
    partIndex: number,
    measureIndex: number,
    target?: ClickTarget,
  ) => void
  /** When true, mouse/touch drag draws a marquee that selects notes. */
  selectMode?: boolean
  /** Called on marquee release with every note hit inside the rectangle. */
  onSelectRect?: (
    hits: {
      partIndex: number
      measureIndex: number
      voiceIndex: number
      elementIndex: number
    }[],
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
  zoomY,
  zoomX,
  containerWidth,
  cursor,
  preview,
  previewOverflow,
  onCellClick,
  selectMode,
  onSelectRect,
  eraser,
  selection,
  playMeasure,
  fontToken,
}: VexRendererProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const marquee = useRef<{ x0: number; y0: number; moved: number } | null>(null)
  const draggedRef = useRef(false)
  const hitboxRef = useRef<HitBox[]>([])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.innerHTML = ''
    hitboxRef.current = []

    const parts = score.parts
    if (parts.length === 0) return

    // zoomY uniformly scales glyphs + layout via ctx.scale (no distortion).
    // zoomX adds extra horizontal note spacing on top (hstretch).
    const hstretch = zoomX
    const logicalW = Math.max(320, containerWidth / zoomY)
    const usableW = logicalW - LABEL_W - LEFT_PAD - RIGHT_MARGIN
    const mw = MEASURE_W * hstretch // desired note-area width per measure
    const totalMeasures = Math.max(...parts.map((p) => p.measures.length))

    // Each measure's note-area width = max(desired, minimum needed for its note
    // count) so notes never spill past the barline (dense measures / small 横).
    const MIN_PER_NOTE = 30
    const colNoteW: number[] = []
    for (let mi = 0; mi < totalMeasures; mi++) {
      let maxTick = 1
      for (const p of parts) {
        const m = p.measures[mi]
        if (!m) continue
        for (const v of m.voices) if (v.length > maxTick) maxTick = v.length
      }
      if (cursor.measureIndex === mi) maxTick += 1 // room for the preview note
      const minNeeded = 30 + maxTick * MIN_PER_NOTE
      colNoteW.push(Math.max(mw, minNeeded))
    }

    // Pack measures into systems by accumulated width (variable widths). The
    // first measure of a system also carries the clef/key/time (FIRST_EXTRA).
    const systems: number[][] = []
    {
      let row: number[] = []
      let rowW = 0
      for (let mi = 0; mi < totalMeasures; mi++) {
        const first = row.length === 0
        const wCol = colNoteW[mi] + (first ? FIRST_EXTRA : 0)
        if (!first && rowW + wCol > usableW) {
          systems.push(row)
          row = [mi]
          rowW = colNoteW[mi] + FIRST_EXTRA
        } else {
          row.push(mi)
          rowW += wCol
        }
      }
      if (row.length) systems.push(row)
      if (systems.length === 0) systems.push([])
    }
    const systemCount = systems.length

    let logicalContentW = logicalW
    for (const row of systems) {
      let w = LABEL_W + LEFT_PAD + RIGHT_MARGIN
      row.forEach((mi, idx) => {
        w += colNoteW[mi] + (idx === 0 ? FIRST_EXTRA : 0)
      })
      if (w > logicalContentW) logicalContentW = w
    }

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

    // Effective tempo per measure (global); drawn where it changes.
    const effTempo = tempoTimeline(score)

    const renderer = new Renderer(host, Renderer.Backends.SVG)
    renderer.resize(logicalContentW * zoomY, logicalH * zoomY)
    const ctx = renderer.getContext()
    ctx.scale(zoomY, zoomY)

    for (let s = 0; s < systemCount; s++) {
      const systemTop = TOP_PAD + s * systemHeight
      const row = systems[s]

      let x = LABEL_W + LEFT_PAD
      for (let col = 0; col < row.length; col++) {
        const measureIndex = row[col]
        const isFirst = col === 0
        const w = colNoteW[measureIndex] + (isFirst ? FIRST_EXTRA : 0)

        for (let pi = 0; pi < parts.length; pi++) {
          const part = parts[pi]
          const measure = part.measures[measureIndex]
          const y = systemTop + pi * STAVE_H

          // Playhead: highlight the measure currently sounding.
          if (playMeasure === measureIndex) {
            ctx.save()
            ctx.setFillStyle(HILITE_PLAY)
            ctx.fillRect(x, y, w, STAVE_H)
            ctx.restore()
          }

          // Cursor cell highlight (red when erasing).
          if (
            cursor.partIndex === pi &&
            cursor.measureIndex === measureIndex
          ) {
            ctx.save()
            ctx.setFillStyle(eraser ? HILITE_ERASE : HILITE)
            ctx.fillRect(x, y, w, STAVE_H)
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

          // Tempo marking above the top staff where the tempo changes.
          if (
            pi === 0 &&
            (measureIndex === 0 ||
              effTempo[measureIndex] !== effTempo[measureIndex - 1])
          ) {
            ctx.save()
            ctx.setFont('Arial', 12, 'bold')
            ctx.setFillStyle(COLOR_NORMAL)
            ctx.fillText(
              `♩=${Math.round(effTempo[measureIndex])}`,
              stave.getNoteStartX() - 8,
              Math.max(y + 9, stave.getYForLine(0) - 6),
            )
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
            y,
            w,
            h: STAVE_H,
            partIndex: pi,
            measureIndex,
          })
          // Per-note hitboxes (checked first → tap a note to select/erase it).
          for (const h of elementHits) {
            hitboxRef.current.push({
              x: h.x,
              y,
              w: h.w,
              h: STAVE_H,
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
    zoomY,
    zoomX,
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
    // Ignore the click that ends a marquee drag.
    if (draggedRef.current) {
      draggedRef.current = false
      return
    }
    if (!onCellClick) return
    const svg = hostRef.current?.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const lx = (e.clientX - rect.left) / zoomY
    const ly = (e.clientY - rect.top) / zoomY
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

  // ── Marquee (drag-rectangle) selection, active only in select mode ─────────
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggedRef.current = false // fresh interaction; clear any stale drag flag
    if (!selectMode || (e.pointerType === 'mouse' && e.button !== 0)) return
    const wrap = wrapRef.current
    if (!wrap) return
    e.stopPropagation() // don't let StaffArea start a pan
    const r = wrap.getBoundingClientRect()
    marquee.current = { x0: e.clientX - r.left, y0: e.clientY - r.top, moved: 0 }
    try {
      wrap.setPointerCapture(e.pointerId)
    } catch {
      /* capture not always available */
    }
    const m = marqueeRef.current
    if (m) {
      m.style.display = 'block'
      m.style.left = `${marquee.current.x0}px`
      m.style.top = `${marquee.current.y0}px`
      m.style.width = '0px'
      m.style.height = '0px'
    }
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const mq = marquee.current
    const wrap = wrapRef.current
    if (!mq || !wrap) return
    const r = wrap.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    mq.moved = Math.max(mq.moved, Math.abs(x - mq.x0) + Math.abs(y - mq.y0))
    const m = marqueeRef.current
    if (m) {
      m.style.left = `${Math.min(x, mq.x0)}px`
      m.style.top = `${Math.min(y, mq.y0)}px`
      m.style.width = `${Math.abs(x - mq.x0)}px`
      m.style.height = `${Math.abs(y - mq.y0)}px`
    }
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const mq = marquee.current
    if (!mq) return
    marquee.current = null
    const m = marqueeRef.current
    if (m) m.style.display = 'none'
    if (mq.moved < 5) return // treat as a tap → let onClick handle it
    draggedRef.current = true // suppress the trailing click

    const svg = hostRef.current?.querySelector('svg')
    const wrap = wrapRef.current
    if (!svg || !wrap || !onSelectRect) return
    const sr = svg.getBoundingClientRect()
    const toLogX = (cx: number) => (cx - sr.left) / zoomY
    const toLogY = (cy: number) => (cy - sr.top) / zoomY
    const wr = wrap.getBoundingClientRect()
    const lx1 = toLogX(wr.left + mq.x0)
    const ly1 = toLogY(wr.top + mq.y0)
    const lx2 = toLogX(e.clientX)
    const ly2 = toLogY(e.clientY)
    const minX = Math.min(lx1, lx2)
    const maxX = Math.max(lx1, lx2)
    const minY = Math.min(ly1, ly2)
    const maxY = Math.max(ly1, ly2)
    const hits = hitboxRef.current
      .filter(
        (b) =>
          b.elementIndex !== undefined &&
          b.x < maxX &&
          b.x + b.w > minX &&
          b.y < maxY &&
          b.y + b.h > minY,
      )
      .map((b) => ({
        partIndex: b.partIndex,
        measureIndex: b.measureIndex,
        voiceIndex: b.voiceIndex ?? 0,
        elementIndex: b.elementIndex ?? 0,
      }))
    onSelectRect(hits)
  }

  return (
    <div
      ref={wrapRef}
      className="vex-wrap"
      style={selectMode ? { touchAction: 'none' } : undefined}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={hostRef} className="vex-host" />
      <div ref={marqueeRef} className="marquee" style={{ display: 'none' }} />
    </div>
  )
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
  const built: {
    voiceIndex: number
    notes: StaveNote[]
    realCount: number
    elements: NoteElement[]
  }[] = []

  const isCursorPart = partIndex === cursor.partIndex

  modelVoices.forEach((elements, vi) => {
    const showHere = showPreview && vi === cursor.voiceIndex
    const overflowExisting = showHere && previewOverflow
    const notes: StaveNote[] = []

    // Voice colour: distinguishes 1st/2nd/3rd/4th; non-active voices in the
    // cursor's part are dimmed to emphasise the layer being edited.
    const dimVoice = isCursorPart && multi && vi !== cursor.voiceIndex
    const vColor = dimVoice
      ? VOICE_COLOR_DIM[vi % VOICE_COLOR_DIM.length]
      : VOICE_COLOR[vi % VOICE_COLOR.length]
    const voiceStyle: NoteStyle = { fillStyle: vColor, strokeStyle: vColor }

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
            : voiceStyle
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
    built.push({ voiceIndex: vi, notes, realCount: elements.length, elements })
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

  // Ties within a voice: element[i].tieStart connects note i → i+1.
  for (const b of built) {
    for (let i = 0; i < b.realCount - 1; i++) {
      if (!b.elements[i]?.tieStart) continue
      if (!b.notes[i] || !b.notes[i + 1]) continue
      try {
        new StaveTie({
          firstNote: b.notes[i],
          lastNote: b.notes[i + 1],
        })
          .setContext(ctx)
          .draw()
      } catch {
        /* ignore tie failures */
      }
    }
  }

  // Slurs within a voice: slurStart … the next slurStop.
  for (const b of built) {
    for (let i = 0; i < b.realCount; i++) {
      if (!b.elements[i]?.slurStart) continue
      let j = i + 1
      while (j < b.realCount && !b.elements[j]?.slurStop) j++
      const to = Math.min(j, b.realCount - 1)
      if (to > i && b.notes[i] && b.notes[to]) {
        try {
          new Curve(b.notes[i], b.notes[to], {}).setContext(ctx).draw()
        } catch {
          /* ignore slur failures */
        }
      }
    }
  }

  // Dynamics drawn under the staff at the note's x.
  {
    const dynY = stave.getYForLine(4) + 22
    for (const b of built) {
      for (let i = 0; i < b.realCount; i++) {
        const dyn = b.elements[i]?.dynamic
        if (!dyn || !b.notes[i]) continue
        let dx: number
        try {
          dx = b.notes[i].getAbsoluteX()
        } catch {
          continue
        }
        ctx.save()
        ctx.setFont('Georgia', 13, 'bold')
        ctx.setFillStyle(COLOR_NORMAL)
        ctx.fillText(dyn, dx - 4, dynY)
        ctx.restore()
      }
    }
  }

  // Insertion caret: a vertical line at the cursor's position in its voice.
  if (isCursorCell) {
    const cv = built.find((b) => b.voiceIndex === cursor.voiceIndex)
    let caretX: number | null = null
    if (cv && cv.realCount > 0) {
      try {
        if (cursor.elementIndex < cv.realCount) {
          caretX = cv.notes[cursor.elementIndex].getAbsoluteX() - 7
        } else {
          caretX = cv.notes[cv.realCount - 1].getAbsoluteX() + 20
        }
      } catch {
        caretX = null
      }
    } else {
      caretX = stave.getNoteStartX()
    }
    if (caretX != null) {
      const top = stave.getYForLine(0) - 8
      const bottom = stave.getYForLine(4) + 8
      ctx.save()
      ctx.setStrokeStyle(CARET_COLOR)
      ctx.setLineWidth(2)
      ctx.beginPath()
      ctx.moveTo(caretX, top)
      ctx.lineTo(caretX, bottom)
      ctx.stroke()
      ctx.restore()
    }
  }

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
