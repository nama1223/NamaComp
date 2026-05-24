// Generate a real PDF (not via the browser print dialog) from the score.
// Each laid-out page SVG is drawn onto an A4 jsPDF page with svg2pdf.

import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import type { Score } from '../types/score'
import {
  renderScorePages,
  cleanupPages,
  PAGE_W,
  PAGE_H,
} from '../render/printRenderer'

// A4 portrait in points.
const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 32

export async function exportPDF(score: Score, fileName: string): Promise<void> {
  const svgs = renderScorePages(score)
  if (svgs.length === 0) throw new Error('楽譜が空です')

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
  const contentW = A4_W - MARGIN * 2
  const scale = contentW / PAGE_W
  const contentH = PAGE_H * scale // ≈ fits within A4 height by page ratio

  for (let i = 0; i < svgs.length; i++) {
    if (i > 0) doc.addPage()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (doc as any).svg(svgs[i], {
      x: MARGIN,
      y: MARGIN,
      width: contentW,
      height: Math.min(contentH, A4_H - MARGIN * 2),
    })
  }

  cleanupPages(svgs)
  doc.save(fileName)
}
