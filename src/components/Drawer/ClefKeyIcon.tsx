import { useEffect, useRef } from 'react'
import { Renderer, Stave } from 'vexflow'

interface ClefKeyIconProps {
  /** Glyph colour (theme foreground). */
  color: string
}

/** A tiny rendered staff: bass clef + 3 flats — used as the 記号 drawer icon. */
export function ClefKeyIcon({ color }: ClefKeyIconProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = ''
    const W = 84
    const renderer = new Renderer(el, Renderer.Backends.SVG)
    renderer.resize(W, 110)
    const ctx = renderer.getContext()
    ctx.setFillStyle(color)
    ctx.setStrokeStyle(color)
    const stave = new Stave(2, 8, W - 6)
    stave.addClef('bass')
    stave.addKeySignature('Eb') // 3 flats: B♭, E♭, A♭
    stave.setContext(ctx).draw()
    const svg = el.querySelector('svg')
    if (svg) {
      const top = stave.getYForLine(0) - 9
      const bottom = stave.getYForLine(4) + 9
      const h = bottom - top
      const iconW = 40
      svg.setAttribute('viewBox', `0 ${top} ${W} ${h}`)
      svg.setAttribute('width', String(iconW))
      svg.setAttribute('height', String(Math.round(iconW * (h / W))))
      svg.removeAttribute('style')
    }
  }, [color])
  return <div ref={ref} className="clef-key-icon" aria-hidden />
}
