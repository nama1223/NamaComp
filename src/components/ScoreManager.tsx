import { useState } from 'react'
import type { Clef, Part } from '../types/score'
import { MAX_PARTS } from '../model/score'
import { INSTRUMENTS, type InstrumentPreset } from '../model/instruments'

interface ScoreManagerProps {
  parts: Part[]
  onClose: () => void
  onAdd: (preset: InstrumentPreset) => void
  onRemove: (index: number) => void
  onMove: (from: number, to: number) => void
  onUpdate: (index: number, patch: Partial<Part>) => void
}

const CLEFS: { value: Clef; label: string }[] = [
  { value: 'treble', label: 'ト音' },
  { value: 'bass', label: 'ヘ音' },
  { value: 'alto', label: 'ハ音(ア)' },
  { value: 'tenor', label: 'ハ音(テ)' },
  { value: 'percussion', label: '打' },
]

// Group instruments for the <optgroup>s.
const GROUPS = [...new Set(INSTRUMENTS.map((i) => i.group))]

export function ScoreManager({
  parts,
  onClose,
  onAdd,
  onRemove,
  onMove,
  onUpdate,
}: ScoreManagerProps) {
  const [sel, setSel] = useState(0)
  const full = parts.length >= MAX_PARTS

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal manager"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="楽譜マネージャー"
      >
        <div className="modal-head">
          <span>楽譜マネージャー（編成）</span>
          <span className="manager-count">
            {parts.length} / {MAX_PARTS} 段
          </span>
          <button className="modal-close" aria-label="閉じる" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="manager-list">
          {parts.map((part, i) => (
            <div className="manager-row" key={part.id}>
              <span className="manager-idx">{i + 1}</span>
              <input
                className="manager-name"
                value={part.name}
                aria-label="パート名"
                onChange={(e) => onUpdate(i, { name: e.target.value })}
              />
              <select
                className="manager-clef"
                value={part.clef}
                aria-label="音部記号"
                onChange={(e) => onUpdate(i, { clef: e.target.value as Clef })}
              >
                {CLEFS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="manager-tr">
                移調
                <input
                  type="number"
                  min={-24}
                  max={24}
                  value={part.transpose}
                  aria-label="移調(半音)"
                  onChange={(e) =>
                    onUpdate(i, {
                      transpose: Math.max(
                        -24,
                        Math.min(24, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </label>
              <div className="manager-move">
                <button
                  aria-label="上へ"
                  disabled={i === 0}
                  onClick={() => onMove(i, i - 1)}
                >
                  ▲
                </button>
                <button
                  aria-label="下へ"
                  disabled={i === parts.length - 1}
                  onClick={() => onMove(i, i + 1)}
                >
                  ▼
                </button>
              </div>
              <button
                className="manager-del"
                aria-label="削除"
                disabled={parts.length <= 1}
                onClick={() => onRemove(i)}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        <div className="manager-add">
          <select
            value={sel}
            aria-label="追加する楽器"
            onChange={(e) => setSel(Number(e.target.value))}
          >
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {INSTRUMENTS.map((inst, idx) =>
                  inst.group === g ? (
                    <option key={idx} value={idx}>
                      {inst.fullName}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
          </select>
          <button
            className="manager-add-btn"
            disabled={full}
            onClick={() => onAdd(INSTRUMENTS[sel])}
          >
            ＋ パートを追加
          </button>
        </div>
        {full && <p className="manager-hint">最大 {MAX_PARTS} 段に達しました。</p>}
      </div>
    </div>
  )
}
