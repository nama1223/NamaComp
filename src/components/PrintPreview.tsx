import { useEffect, useRef, useState } from 'react'
import type { Score } from '../types/score'
import { renderScorePages } from '../render/printRenderer'
import { exportPDF } from '../io/pdf'

interface PrintPreviewProps {
  score: Score
  fileName: string
  onClose: () => void
}

export function PrintPreview({ score, fileName, onClose }: PrintPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    host.innerHTML = ''
    let canvases: HTMLCanvasElement[] = []
    try {
      canvases = renderScorePages(score)
    } catch {
      host.textContent = '楽譜が空です'
      return
    }
    setPageCount(canvases.length)
    canvases.forEach((cv) => {
      cv.style.cssText =
        'width:100%;height:auto;display:block;background:#fff;' +
        'box-shadow:0 1px 8px rgba(0,0,0,0.35);margin:0 auto 14px;'
      host.appendChild(cv)
    })
  }, [score])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal preview"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="印刷プレビュー"
      >
        <div className="modal-head">
          <span>印刷プレビュー（{pageCount}ページ）</span>
          <button
            className="manager-add-btn"
            onClick={() => exportPDF(score, fileName)}
          >
            PDFを保存
          </button>
          <button className="modal-close" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="preview-pages" ref={ref} />
      </div>
    </div>
  )
}
