import { useState, type ReactNode } from 'react'

export interface DrawerDef {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

interface DrawerRailProps {
  drawers: DrawerDef[]
  /** Global action buttons (play/eraser/undo/redo) shown in the same bar. */
  actions?: ReactNode
}

// Horizontal toolbar at the bottom of the screen (kept off the staff so it
// never steals horizontal width — the priority is fitting many measures per
// row). Action buttons sit on the left, drawer toggles on the right; the open
// drawer slides up as a bottom sheet.
export function DrawerRail({ drawers, actions }: DrawerRailProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = drawers.find((d) => d.id === openId) ?? null

  return (
    <>
      <div className="toolbar">
        {actions && <div className="tb-actions">{actions}</div>}
        <div className="tb-drawers">
          {drawers.map((d) => (
            <button
              key={d.id}
              className={`tb-btn ${openId === d.id ? 'active' : ''}`}
              aria-label={d.label}
              title={d.label}
              onClick={() => setOpenId((cur) => (cur === d.id ? null : d.id))}
            >
              <span className="tb-icon">{d.icon}</span>
              <span className="tb-text">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpenId(null)} />
          <div className="drawer-panel">
            <div className="drawer-head">
              <span>{open.label}</span>
              <button
                className="drawer-close"
                aria-label="閉じる"
                onClick={() => setOpenId(null)}
              >
                閉じる
              </button>
            </div>
            {open.content}
          </div>
        </>
      )}
    </>
  )
}
