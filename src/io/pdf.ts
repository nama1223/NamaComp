// Generate a real PDF (not via the browser print dialog). Each page is rendered
// to a Canvas (correct music-font glyphs) and embedded as a PNG image.

import { jsPDF } from 'jspdf'
import type { Score } from '../types/score'
import { renderScorePages, PAGE_W, PAGE_H } from '../render/printRenderer'

const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 28

/** Build a jsPDF document from the score's rendered page canvases. */
export function buildPDF(score: Score): jsPDF {
  const canvases = renderScorePages(score)
  if (canvases.length === 0) throw new Error('楽譜が空です')

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const contentW = A4_W - MARGIN * 2
  const contentH = Math.min(A4_H - MARGIN * 2, contentW * (PAGE_H / PAGE_W))

  canvases.forEach((canvas, i) => {
    if (i > 0) doc.addPage()
    const png = canvas.toDataURL('image/png')
    doc.addImage(png, 'PNG', MARGIN, MARGIN, contentW, contentH)
  })
  return doc
}

export function exportPDF(score: Score, fileName: string): void {
  buildPDF(score).save(fileName)
}
