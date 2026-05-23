import { useEffect, useMemo, useRef, useState } from 'react'
import type { Clef, TimeSignature } from './types/score'
import { useSettings } from './state/useSettings'
import { useScore } from './state/useScore'
import { useInputState } from './state/useInputState'
import { usePlayback } from './state/usePlayback'
import { ensureMusicFont, type MusicFontName } from './render/fonts'
import { makeNote, measureUsedWhole } from './model/score'
import { midiToPitch } from './model/pitch'
import { durationToWholeFraction, wouldOverflow } from './model/duration'
import { exportMusicXML, importMusicXML } from './io/musicxml'
import { exportMIDI } from './io/midi'
import { downloadText, downloadBytes } from './io/download'
import { TopBar } from './components/TopBar'
import { StaffArea } from './components/StaffArea'
import { InputArea } from './components/input/InputArea'
import { DrawerRail, type DrawerDef } from './components/Drawer/DrawerRail'
import { SymbolDrawer } from './components/Drawer/SymbolDrawer'
import { MeasureDrawer } from './components/Drawer/MeasureDrawer'
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

  function handleCellClick(
    partIndex: number,
    measureIndex: number,
    elementIndex?: number,
  ) {
    const measure = score.score.parts[partIndex]?.measures[measureIndex]
    // Eraser mode: tapping a specific note removes it immediately.
    if (input.eraser && elementIndex != null) {
      score.removeAt({ partIndex, measureIndex, elementIndex })
      input.setCursor({ partIndex, measureIndex, elementIndex })
      return
    }
    // Otherwise land the cursor on the tapped note, or at the measure end.
    input.setCursor({
      partIndex,
      measureIndex,
      elementIndex: elementIndex ?? (measure ? measure.elements.length : 0),
    })
  }

  // Delete the note at the cursor (or the last note if the cursor sits at the
  // append position). Used by the picker / keyboard 削除 buttons.
  function commitDelete() {
    const measure =
      score.score.parts[input.cursor.partIndex]?.measures[
        input.cursor.measureIndex
      ]
    if (!measure || measure.elements.length === 0) return
    const last = measure.elements.length - 1
    const target =
      input.cursor.elementIndex <= last ? input.cursor.elementIndex : last
    score.removeAt({ ...input.cursor, elementIndex: target })
    input.setCursor((c) => ({ ...c, elementIndex: target }))
  }

  function commitNote() {
    score.insertAt(input.cursor, input.buildNote())
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
  }
  function commitRest() {
    score.insertAt(input.cursor, input.buildRest())
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
  }
  function commitMidi(midi: number) {
    const note = makeNote([midiToPitch(midi)], {
      value: input.picker.value,
      dots: input.picker.dots,
    })
    score.insertAt(input.cursor, note)
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
  }

  function switchMethod() {
    const next = input.method === 'picker' ? 'keyboard' : 'picker'
    input.setMethod(next)
    update({ inputMethod: next })
  }

  const measureCount = Math.max(
    1,
    ...score.score.parts.map((p) => p.measures.length),
  )

  function appendMeasure() {
    score.addMeasure()
  }
  function insertMeasure() {
    score.insertMeasure(input.cursor.measureIndex)
  }
  function deleteMeasure() {
    if (measureCount <= 1) return
    score.removeMeasure(input.cursor.measureIndex)
    const newMax = measureCount - 1
    input.setCursor((c) => ({
      ...c,
      measureIndex: Math.min(c.measureIndex, newMax - 1),
      elementIndex: 0,
    }))
  }

  function safeName() {
    return score.score.fileName.replace(/[\\/:*?"<>|]/g, '_') || 'score'
  }

  function exportXML() {
    const xml = exportMusicXML(score.score)
    downloadText(
      `${safeName()}.musicxml`,
      xml,
      'application/vnd.recordare.musicxml+xml',
    )
  }

  function exportMidi() {
    const bytes = exportMIDI(score.score)
    downloadBytes(`${safeName()}.mid`, bytes, 'audio/midi')
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
      id: 'measures',
      label: '小節',
      icon: '⊞',
      content: (
        <MeasureDrawer
          measureCount={measureCount}
          cursorMeasureIndex={input.cursor.measureIndex}
          onAppend={appendMeasure}
          onInsertAfter={insertMeasure}
          onDelete={deleteMeasure}
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
        onExportMIDI={exportMidi}
        onImportXML={() => fileInputRef.current?.click()}
        onUndo={score.undo}
        onRedo={score.redo}
        canUndo={score.canUndo}
        canRedo={score.canRedo}
        eraser={input.eraser}
        onToggleEraser={() => input.setEraser((v) => !v)}
      />

      <StaffArea
        score={score.score}
        zoom={settings.zoom}
        onZoomChange={(zoom) => update({ zoom })}
        cursor={input.cursor}
        preview={input.method === 'picker' ? input.previewNote : null}
        previewOverflow={previewOverflow}
        onCellClick={handleCellClick}
        eraser={input.eraser}
        playMeasure={playback.playMeasure}
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
        onCommitMidi={commitMidi}
        onCommitDelete={commitDelete}
        overflow={previewOverflow}
      />
    </div>
  )
}
