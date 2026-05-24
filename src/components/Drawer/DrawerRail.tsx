import { useState, type ReactNode } from 'react'

export interface DrawerDef {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

interface DrawerRailProps {
  drawers: DrawerDef[]
}

// Left-edge rail of toggle buttons. One drawer slides out at a time as a
// horizontal panel anchored to the bottom of the staff stage, so menus stay
// out of the way until summoned (matches the mockup's hidden-drawer idea).
export function DrawerRail({ drawers }: DrawerRailProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = drawers.find((d) => d.id === openId) ?? null

  return (
    <>
      <div className="rail">
        {drawers.map((d) => (
          <button
            key={d.id}
            className={`rail-btn ${openId === d.id ? 'active' : ''}`}
            aria-label={d.label}
            onClick={() => setOpenId((cur) => (cur === d.id ? null : d.id))}
          >
            <span className="rail-icon">{d.icon}</span>
            <span className="rail-text">{d.label}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="drawer-panel">
          <div className="drawer-head">
            <span>{open.label}</span>
            <button
              className="drawer-close"
              aria-label="閉じる"
              onClick={() => setOpenId(null)}
            >
              ◀
            </button>
          </div>
          {open.content}
        </div>
      )}
    </>
  )
}
