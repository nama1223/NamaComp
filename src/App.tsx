import { useEffect, useMemo, useRef, useState } from 'react'
import type { Clef, TimeSignature } from './types/score'
import { useSettings } from './state/useSettings'
import { useScore } from './state/useScore'
import { useInputState } from './state/useInputState'
import { usePlayback } from './state/usePlayback'
import { ensureMusicFont, type MusicFontName } from './render/fonts'
import { measureUsedWhole } from './model/score'
import { durationToWholeFraction, wouldOverflow } from './model/duration'
import { exportMusicXML, importMusicXML } from './io/musicxml'
import { downloadText } from './io/download'
import { TopBar } from './components/TopBar'
import { StaffArea } from './components/StaffArea'
import { InputArea } from './components/input/InputArea'
import { DrawerRail, type DrawerDef } from './components/Drawer/DrawerRail'
import { SymbolDrawer } from './components/Drawer/SymbolDrawer'
import { PlaybackDrawer } from './components/Drawer/PlaybackDrawer'

export default function App() {
  const { settings, update } = useSettings()
  const score = useScore()
  const input = useInputState(settings.inputMethod)
  const playback = usePlayback()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeFont, setActiveFont] = useState<MusicFontName>('Bravura')
  useEffect(() => {
    let alive = true
    ensureMusicFont(settings.musicFont).then((f) => {
      if (alive) setActiveFont(f)
    })
    return () => {
      alive = false
    }
  }, [settings.musicFont])

  // Does dropping the previewed note into the cursor's measure overflow it?
  const previewOverflow = useMemo(() => {
    const part = score.score.parts[input.cursor.partIndex]
    const measure = part?.measures[input.cursor.measureIndex]
    const used = measure ? measureUsedWhole(measure) : 0
    const time = measure?.time ?? score.score.time
    return wouldOverflow(
      used,
      durationToWholeFraction(input.previewNote.duration),
      time,
    )
  }, [score.score, input.cursor, input.previewNote])

  function handleCellClick(partIndex: number, measureIndex: number) {
    const measure = score.score.parts[partIndex]?.measures[measureIndex]
    input.setCursor({
      partIndex,
      measureIndex,
      elementIndex: measure ? measure.elements.length : 0,
    })
  }

  function commitNote() {
    score.insertAt(input.cursor, input.buildNote())
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
  }
  function commitRest() {
    score.insertAt(input.cursor, input.buildRest())
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
  }

  function switchMethod() {
    const next = input.method === 'picker' ? 'keyboard' : 'picker'
    input.setMethod(next)
    update({ inputMethod: next })
  }

  function exportXML() {
    const xml = exportMusicXML(score.score)
    const safe = score.score.fileName.replace(/[\\/:*?"<>|]/g, '_') || 'score'
    downloadText(`${safe}.musicxml`, xml, 'application/vnd.recordare.musicxml+xml')
  }

  function importXML(file: File) {
    file
      .text()
      .then((text) => {
        const imported = importMusicXML(text)
        score.setScore(imported)
        input.setCursor({ partIndex: 0, measureIndex: 0, elementIndex: 0 })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        alert(`読み込みに失敗しました: ${msg}`)
      })
  }

  const drawers: DrawerDef[] = [
    {
      id: 'symbols',
      label: '記号',
      icon: '♯',
      content: (
        <SymbolDrawer
          score={score.score}
          cursorPartIndex={input.cursor.partIndex}
          onSetClef={(pi, clef: Clef) => score.updatePartMeta(pi, { clef })}
          onSetKey={(keyFifths) => score.updateMeta({ keyFifths })}
          onSetTime={(time: TimeSignature) => score.updateMeta({ time })}
        />
      ),
    },
    {
      id: 'playback',
      label: '再生',
      icon: '▶',
      content: (
        <PlaybackDrawer
          tempo={score.score.tempo}
          onTempo={(tempo) => score.updateMeta({ tempo })}
          isPlaying={playback.isPlaying}
          onPlay={() => playback.toggle(score.score)}
          onStop={playback.stop}
        />
      ),
    },
  ]

  return (
    <div className="app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,application/xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) importXML(file)
          e.target.value = ''
        }}
      />
      <TopBar
        fileName={score.score.fileName}
        onRename={(fileName) => score.updateMeta({ fileName })}
        theme={settings.theme}
        onToggleTheme={() =>
          update({ theme: settings.theme === 'light' ? 'dark' : 'light' })
        }
        musicFont={settings.musicFont}
        onSetFont={(f) => update({ musicFont: f })}
        onNewScore={() => {
          score.resetScore()
          input.setCursor({ partIndex: 0, measureIndex: 0, elementIndex: 0 })
        }}
        onExportXML={exportXML}
        onImportXML={() => fileInputRef.current?.click()}
        onUndo={score.undo}
        onRedo={score.redo}
        canUndo={score.canUndo}
        canRedo={score.canRedo}
      />

      <StaffArea
        score={score.score}
        zoom={settings.zoom}
        onZoomChange={(zoom) => update({ zoom })}
        cursor={input.cursor}
        preview={input.method === 'picker' ? input.previewNote : null}
        previewOverflow={previewOverflow}
        onCellClick={handleCellClick}
        fontToken={activeFont}
      >
        <DrawerRail drawers={drawers} />
      </StaffArea>

      <InputArea
        method={input.method}
        onSwitchMethod={switchMethod}
        picker={input.picker}
        patch={input.patchPicker}
        onCommitNote={commitNote}
        onCommitRest={commitRest}
        overflow={input.method === 'picker' && previewOverflow}
      />
    </div>
  )
}
