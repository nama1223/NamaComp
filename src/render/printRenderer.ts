// Off-screen, paginated renderer for PDF / print preview. Renders each page to
// a Canvas (so the music font glyphs are rasterised correctly — svg2pdf cannot
// embed the SMuFL font). Reuses drawMeasure from the on-screen renderer.

import { Renderer, Stave } from 'vexflow'
import type { Clef, Score, TimeSignature } from '../types/score'
import { tempoTimeline } from '../model/score'
import { drawMeasure } from './VexRenderer'

const LABEL_W = 46
const LEFT_PAD = 8
const TOP_PAD = 16
const STAVE_H = 92
const SYSTEM_GAP = 38
const MEASURE_W = 220
const FIRST_EXTRA = 70
const RIGHT_MARGIN = 16

// Page pixels (A4 portrait ratio ≈ 1.414).
export const PAGE_W = 770
export const PAGE_H = 1089
// Super-sampling for crisp output.
const SCALE = 2

const KEY_NAMES = [
  'Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F',
  'C',
  'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
]
const keyName = (fifths: number): string => KEY_NAMES[fifths + 7] ?? 'C'

const NO_CURSOR = {
  partIndex: -1,
  measureIndex: -1,
  voiceIndex: 0,
  elementIndex: 0,
}

/** Render the whole score into one Canvas per page. */
export function renderScorePages(score: Score): HTMLCanvasElement[] {
  const parts = score.parts
  if (parts.length === 0) return []

  const usableW = PAGE_W - LABEL_W - LEFT_PAD - RIGHT_MARGIN
  const totalMeasures = Math.max(...parts.map((p) => p.measures.length))

  // Per-part effective clef/key/time + change flags (mirrors VexRenderer).
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
  const effTempo = tempoTimeline(score)

  const colNoteW: number[] = []
  for (let mi = 0; mi < totalMeasures; mi++) {
    let maxTick = 1
    for (const p of parts) {
      const m = p.measures[mi]
      if (!m) continue
      for (const v of m.voices) if (v.length > maxTick) maxTick = v.length
    }
    colNoteW.push(Math.max(MEASURE_W, 30 + maxTick * 30))
  }

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
  }

  const systemHeight = parts.length * STAVE_H + SYSTEM_GAP
  const sysPerPage = Math.max(1, Math.floor((PAGE_H - TOP_PAD) / systemHeight))

  const canvases: HTMLCanvasElement[] = []
  for (let pStart = 0; pStart < systems.length; pStart += sysPerPage) {
    const pageSystems = systems.slice(pStart, pStart + sysPerPage)
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_W * SCALE
    canvas.height = PAGE_H * SCALE
    const renderer = new Renderer(canvas, Renderer.Backends.CANVAS)
    const ctx = renderer.getContext()
    ctx.scale(SCALE, SCALE)
    // White page background.
    ctx.save()
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, PAGE_W, PAGE_H)
    ctx.restore()

    pageSystems.forEach((row, sIdx) => {
      const systemTop = TOP_PAD + sIdx * systemHeight
      let x = LABEL_W + LEFT_PAD
      for (let col = 0; col < row.length; col++) {
        const measureIndex = row[col]
        const isFirst = col === 0
        const w = colNoteW[measureIndex] + (isFirst ? FIRST_EXTRA : 0)
        for (let pi = 0; pi < parts.length; pi++) {
          const part = parts[pi]
          const measure = part.measures[measureIndex]
          const y = systemTop + pi * STAVE_H
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
            ctx.fillText(part.name, LEFT_PAD, y + 26)
            ctx.restore()
          }
          if (
            pi === 0 &&
            (measureIndex === 0 ||
              effTempo[measureIndex] !== effTempo[measureIndex - 1])
          ) {
            ctx.save()
            ctx.setFont('Arial', 12, 'bold')
            ctx.fillText(
              `♩=${Math.round(effTempo[measureIndex])}`,
              stave.getNoteStartX() - 8,
              Math.max(y + 9, stave.getYForLine(0) - 6),
            )
            ctx.restore()
          }
          drawMeasure({
            ctx,
            stave,
            clef: eClef,
            measure,
            measureIndex,
            partIndex: pi,
            time: eTime,
            cursor: NO_CURSOR,
            preview: null,
            previewOverflow: false,
            selection: null,
          })
        }
        x += w
      }
    })

    canvases.push(canvas)
  }
  return canvases
}
