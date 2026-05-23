import { useCallback, useEffect, useState } from 'react'
import type { InputMethod } from '../types/editor'
import type { MusicFontName } from '../render/fonts'

export type ThemeName = 'light' | 'dark'

export interface Settings {
  theme: ThemeName
  inputMethod: InputMethod
  musicFont: MusicFontName
  zoom: number
}

const KEY = 'namacomp_settings_v1'

const DEFAULTS: Settings = {
  theme: 'light',
  inputMethod: 'picker',
  musicFont: 'Bravura',
  zoom: 1,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULTS
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [settings])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
  }, [settings.theme])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return { settings, update }
}
