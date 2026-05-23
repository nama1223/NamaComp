// Music font management. The `vexflow` entry pre-loads + activates Bravura, so
// that is our guaranteed baseline. Leland (the preferred engraving font) and
// Petaluma are loaded on demand from VexFlow's font CDN, with graceful fallback
// to the currently active font if a load fails (e.g. offline).

import { VexFlow } from 'vexflow'

export type MusicFontName = 'Bravura' | 'Leland' | 'Petaluma'

const TEXT_COMPANION: Record<MusicFontName, string> = {
  Bravura: 'Academico',
  Leland: 'Leland Text',
  Petaluma: 'Petaluma Script',
}

let activeFont: MusicFontName = 'Bravura'

export function getActiveFont(): MusicFontName {
  return activeFont
}

/**
 * Ensure `font` is loaded and active. Returns the font that ended up active
 * (which may differ from the request if loading failed).
 */
export async function ensureMusicFont(font: MusicFontName): Promise<MusicFontName> {
  if (font === activeFont) return activeFont
  const text = TEXT_COMPANION[font]
  try {
    await VexFlow.loadFonts(font, text)
    VexFlow.setFonts(font, text)
    activeFont = font
  } catch (err) {
    console.warn(
      `[NamaComp] music font "${font}" failed to load; staying on "${activeFont}".`,
      err,
    )
  }
  return activeFont
}
