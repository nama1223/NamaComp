import { useEffect, useMemo, useRef, useState } from 'react'
import type { Clef, TimeSignature } from './types/score'
import { useSettings } from './state/useSettings'
import { useScore } from './state/useScore'
import { useInputState } from './state/useInputState'
import { usePlayback } from './state/usePlayback'
import { ensureMusicFont, type MusicFontName } from './render/fonts'
import {
  makeNote,
  voiceUsedWhole,
  addPart,
  removePart,
  movePart,
  setMeasureClef,
  setMeasureKey,
  setMeasureTime,
  cloneElements,
  collectRange,
  deleteRange,
  insertElements,
  updateElement,
  toggleArticulation,
  transposeScore,
  setMeasureTempo,
  tempoTimeline,
} from './model/score'
import type { NoteElement, Score } from './types/score'
import type { ClickTarget } from './render/VexRenderer'
import { normalizeSelection } from './types/editor'
import type { InstrumentPreset } from './model/instruments'
import { midiToPitch } from './model/pitch'
import {
  durationToWholeFraction,
  measureCapacityWhole,
  wouldOverflow,
} from './model/duration'
import { exportMusicXML, importMusicXML } from './io/musicxml'
import { exportMIDI } from './io/midi'
import { exportPDF } from './io/pdf'
import { renderScore } from './audio/render'
import { encodeWav, encodeMp3 } from './audio/encode'
import { downloadText, downloadBytes } from './io/download'
import { TopBar } from './components/TopBar'
import { StaffArea } from './components/StaffArea'
import { InputArea } from './components/input/InputArea'
import { CursorBar } from './components/input/CursorBar'
import { DrawerRail, type DrawerDef } from './components/Drawer/DrawerRail'
import { SymbolDrawer } from './components/Drawer/SymbolDrawer'
import { MeasureDrawer } from './components/Drawer/MeasureDrawer'
import { ClefKeyIcon } from './components/Drawer/ClefKeyIcon'
import { SelectionDrawer } from './components/Drawer/SelectionDrawer'
import { ExpressionDrawer } from './components/Drawer/ExpressionDrawer'
import { ZoomDrawer } from './components/Drawer/ZoomDrawer'
import { PlaybackDrawer } from './components/Drawer/PlaybackDrawer'
import { ScoreManager } from './components/ScoreManager'
import { PrintPreview } from './components/PrintPreview'

export default function App() {
  const { settings, update } = useSettings()
  const score = useScore()
  const input = useInputState(settings.inputMethod)
  const playback = usePlayback()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showManager, setShowManager] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

  // Does dropping the previewed note into the cursor's voice overflow the bar?
  const previewOverflow = useMemo(() => {
    const part = score.score.parts[input.cursor.partIndex]
    const measure = part?.measures[input.cursor.measureIndex]
    const voice = measure?.voices[input.cursor.voiceIndex]
    const used = voice ? voiceUsedWhole(voice) : 0
    const time = measure?.time ?? score.score.time
    return wouldOverflow(
      used,
      durationToWholeFraction(input.previewNote.duration),
      time,
    )
  }, [score.score, input.cursor, input.previewNote])

  // Keep the cursor inside the current score's bounds. Undo/redo and measure
  // deletion edit the score without touching the cursor, which could otherwise
  // leave it pointing past the end (e.g. "5/4小節").
  useEffect(() => {
    input.setCursor((c) => {
      const parts = score.score.parts
      if (parts.length === 0) return c
      const pi = Math.min(c.partIndex, parts.length - 1)
      const measures = parts[pi].measures
      const mi = Math.min(c.measureIndex, Math.max(0, measures.length - 1))
      const voices = measures[mi]?.voices ?? []
      const vi = Math.min(c.voiceIndex, Math.max(0, voices.length - 1))
      const ei = Math.min(c.elementIndex, voices[vi]?.length ?? 0)
      if (
        pi === c.partIndex &&
        mi === c.measureIndex &&
        vi === c.voiceIndex &&
        ei === c.elementIndex
      ) {
        return c // already valid — return same ref so React bails out
      }
      return { partIndex: pi, measureIndex: mi, voiceIndex: vi, elementIndex: ei }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score.score])

  function handleCellClick(
    partIndex: number,
    measureIndex: number,
    target?: ClickTarget,
  ) {
    const measure = score.score.parts[partIndex]?.measures[measureIndex]

    // Select mode: tap a note to set/extend the selection; tap empty space to
    // just move the cursor (e.g. to position a paste target) — selection kept.
    if (input.mode === 'select') {
      if (target) {
        input.setSelection((prev) =>
          prev &&
          prev.partIndex === partIndex &&
          prev.voiceIndex === target.voiceIndex
            ? {
                ...prev,
                focus: {
                  measureIndex,
                  elementIndex: target.elementIndex,
                },
              }
            : {
                partIndex,
                voiceIndex: target.voiceIndex,
                anchor: { measureIndex, elementIndex: target.elementIndex },
                focus: { measureIndex, elementIndex: target.elementIndex },
              },
        )
        input.setCursor({ partIndex, measureIndex, ...target })
      } else {
        const voiceCount = measure ? measure.voices.length : 1
        const voiceIndex = Math.min(input.cursor.voiceIndex, voiceCount - 1)
        const voice = measure?.voices[voiceIndex]
        input.setCursor({
          partIndex,
          measureIndex,
          voiceIndex,
          elementIndex: voice ? voice.length : 0,
        })
      }
      return
    }

    // Eraser mode: tapping a specific note removes it immediately.
    if (input.mode === 'eraser' && target) {
      score.removeAt({
        partIndex,
        measureIndex,
        voiceIndex: target.voiceIndex,
        elementIndex: target.elementIndex,
      })
      input.setCursor({ partIndex, measureIndex, ...target })
      return
    }
    if (target) {
      // Land the cursor on the tapped note (its voice).
      input.setCursor({ partIndex, measureIndex, ...target })
      return
    }
    // Empty area: keep the active voice (clamped) and go to its end.
    const voiceCount = measure ? measure.voices.length : 1
    const voiceIndex = Math.min(input.cursor.voiceIndex, voiceCount - 1)
    const voice = measure?.voices[voiceIndex]
    input.setCursor({
      partIndex,
      measureIndex,
      voiceIndex,
      elementIndex: voice ? voice.length : 0,
    })
  }

  // Delete the note at the cursor (or the last note if the cursor sits at the
  // append position) within the active voice. Used by the 削除 buttons.
  function commitDelete() {
    const measure =
      score.score.parts[input.cursor.partIndex]?.measures[
        input.cursor.measureIndex
      ]
    const voice = measure?.voices[input.cursor.voiceIndex]
    if (!voice || voice.length === 0) return
    const last = voice.length - 1
    const target =
      input.cursor.elementIndex <= last ? input.cursor.elementIndex : last
    score.removeAt({ ...input.cursor, elementIndex: target })
    input.setCursor((c) => ({ ...c, elementIndex: target }))
  }

  // Insert an element at the cursor. When the measure becomes full, advance the
  // cursor to the next measure (auto-appending one if we're at the end).
  function commitElement(element: NoteElement) {
    const cur = input.cursor
    const measure = score.score.parts[cur.partIndex]?.measures[cur.measureIndex]
    const voice = measure?.voices[cur.voiceIndex]
    const time = measure?.time ?? score.score.time
    const used = voice ? voiceUsedWhole(voice) : 0
    const added = durationToWholeFraction(element.duration)
    const full = used + added >= measureCapacityWhole(time) - 1e-6

    score.insertAtAutoExpand(cur, element, full)
    if (full) {
      input.setCursor({
        partIndex: cur.partIndex,
        measureIndex: cur.measureIndex + 1,
        voiceIndex: cur.voiceIndex,
        elementIndex: 0,
      })
    } else {
      input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + 1 }))
    }
  }

  function commitNote() {
    commitElement(input.buildNote())
  }
  function commitRest() {
    commitElement(input.buildRest())
  }
  function commitMidi(midi: number) {
    commitElement(makeNote([midiToPitch(midi)], input.buildDuration()))
  }

  function switchMethod() {
    const next = input.method === 'picker' ? 'keyboard' : 'picker'
    input.setMethod(next)
    update({ inputMethod: next })
  }

  // ── Cursor navigation (precise repositioning a tap can't give on touch) ───
  // Step the insert point ±1 element within the active voice, wrapping to the
  // adjacent measure at the boundaries.
  function moveStep(delta: number) {
    input.setCursor((c) => {
      const part = score.score.parts[c.partIndex]
      if (!part) return c
      const lenAt = (mi: number) =>
        part.measures[mi]?.voices[c.voiceIndex]?.length ?? 0
      let mi = c.measureIndex
      let ei = Math.min(c.elementIndex, lenAt(mi)) + delta
      if (ei > lenAt(mi)) {
        if (mi + 1 < part.measures.length) {
          mi += 1
          ei = 0
        } else ei = lenAt(mi)
      } else if (ei < 0) {
        if (mi > 0) {
          mi -= 1
          ei = lenAt(mi)
        } else ei = 0
      }
      return { ...c, measureIndex: mi, elementIndex: ei }
    })
  }
  // Jump to the previous/next measure (cursor lands at that measure's end).
  function moveMeasure(delta: number) {
    input.setCursor((c) => {
      const part = score.score.parts[c.partIndex]
      if (!part) return c
      const mi = Math.max(
        0,
        Math.min(part.measures.length - 1, c.measureIndex + delta),
      )
      const vi = Math.min(c.voiceIndex, (part.measures[mi]?.voices.length ?? 1) - 1)
      const len = part.measures[mi]?.voices[vi]?.length ?? 0
      return { ...c, measureIndex: mi, voiceIndex: vi, elementIndex: len }
    })
  }

  // ── Selection + clipboard ─────────────────────────────────────────────────
  const normSelection = useMemo(
    () => (input.selection ? normalizeSelection(input.selection) : null),
    [input.selection],
  )

  function toggleSelect() {
    input.setMode((m) => (m === 'select' ? 'normal' : 'select'))
  }
  function clearSelection() {
    input.setSelection(null)
  }

  // Resolve a marquee's note hits into a single-part/voice contiguous range
  // (the part+voice group with the most hits wins).
  function handleSelectRect(
    hits: {
      partIndex: number
      measureIndex: number
      voiceIndex: number
      elementIndex: number
    }[],
  ) {
    if (hits.length === 0) {
      input.setSelection(null)
      return
    }
    const groups = new Map<string, typeof hits>()
    for (const h of hits) {
      const k = `${h.partIndex}:${h.voiceIndex}`
      const arr = groups.get(k)
      if (arr) arr.push(h)
      else groups.set(k, [h])
    }
    const best = [...groups.values()].reduce((a, b) =>
      b.length > a.length ? b : a,
    )

    const before = (
      p: { measureIndex: number; elementIndex: number },
      q: { measureIndex: number; elementIndex: number },
    ) =>
      p.measureIndex < q.measureIndex ||
      (p.measureIndex === q.measureIndex && p.elementIndex <= q.elementIndex)
    let min = best[0]
    let max = best[0]
    for (const h of best) {
      if (before(h, min)) min = h
      if (before(max, h)) max = h
    }
    input.setSelection({
      partIndex: best[0].partIndex,
      voiceIndex: best[0].voiceIndex,
      anchor: { measureIndex: min.measureIndex, elementIndex: min.elementIndex },
      focus: { measureIndex: max.measureIndex, elementIndex: max.elementIndex },
    })
    input.setCursor({
      partIndex: best[0].partIndex,
      measureIndex: max.measureIndex,
      voiceIndex: best[0].voiceIndex,
      elementIndex: max.elementIndex,
    })
  }
  function copySelection() {
    if (!normSelection) return
    const els = collectRange(
      score.score,
      normSelection.partIndex,
      normSelection.voiceIndex,
      normSelection.startMeasure,
      normSelection.startEl,
      normSelection.endMeasure,
      normSelection.endEl,
    )
    if (els.length > 0) input.setClipboard(cloneElements(els))
  }
  function cutSelection() {
    if (!normSelection) return
    const n = normSelection
    const els = collectRange(
      score.score,
      n.partIndex,
      n.voiceIndex,
      n.startMeasure,
      n.startEl,
      n.endMeasure,
      n.endEl,
    )
    if (els.length === 0) return
    input.setClipboard(cloneElements(els))
    score.mutate((s) =>
      deleteRange(
        s,
        n.partIndex,
        n.voiceIndex,
        n.startMeasure,
        n.startEl,
        n.endMeasure,
        n.endEl,
      ),
    )
    input.setSelection(null)
    input.setCursor({
      partIndex: n.partIndex,
      measureIndex: n.startMeasure,
      voiceIndex: n.voiceIndex,
      elementIndex: n.startEl,
    })
  }
  function pasteClipboard() {
    const clip = input.clipboard
    if (!clip || clip.length === 0) return
    const cur = input.cursor
    const els = cloneElements(clip)
    score.mutate((s) =>
      insertElements(
        s,
        cur.partIndex,
        cur.measureIndex,
        cur.voiceIndex,
        cur.elementIndex,
        els,
      ),
    )
    input.setCursor((c) => ({ ...c, elementIndex: c.elementIndex + els.length }))
  }

  // ── Expression marks (apply to selection, else cursor note) ───────────────
  function applyToTargets(fn: (el: NoteElement) => NoteElement) {
    if (normSelection) {
      const n = normSelection
      score.mutate((s) => {
        let next: Score = s
        for (let mi = n.startMeasure; mi <= n.endMeasure; mi++) {
          const voice = next.parts[n.partIndex]?.measures[mi]?.voices[n.voiceIndex]
          if (!voice) continue
          const from = mi === n.startMeasure ? n.startEl : 0
          const to = mi === n.endMeasure ? n.endEl : voice.length - 1
          for (let i = from; i <= to && i < voice.length; i++) {
            next = updateElement(next, n.partIndex, mi, n.voiceIndex, i, fn)
          }
        }
        return next
      })
      return
    }
    const cur = input.cursor
    const voice =
      score.score.parts[cur.partIndex]?.measures[cur.measureIndex]?.voices[
        cur.voiceIndex
      ]
    if (!voice || voice.length === 0) return
    const idx =
      cur.elementIndex < voice.length ? cur.elementIndex : voice.length - 1
    score.mutate((s) =>
      updateElement(s, cur.partIndex, cur.measureIndex, cur.voiceIndex, idx, fn),
    )
  }
  function articulate(code: string) {
    applyToTargets((el) => toggleArticulation(el, code))
  }
  function toggleTie() {
    applyToTargets((el) =>
      el.kind === 'note' ? { ...el, tieStart: !el.tieStart } : el,
    )
  }

  // Dynamics attach to a single note (selection start, else cursor note).
  function setDynamic(code: string) {
    let pi: number
    let mi: number
    let vi: number
    let ei: number
    if (normSelection) {
      pi = normSelection.partIndex
      vi = normSelection.voiceIndex
      mi = normSelection.startMeasure
      ei = normSelection.startEl
    } else {
      pi = input.cursor.partIndex
      mi = input.cursor.measureIndex
      vi = input.cursor.voiceIndex
      const voice = score.score.parts[pi]?.measures[mi]?.voices[vi]
      if (!voice || voice.length === 0) return
      ei =
        input.cursor.elementIndex < voice.length
          ? input.cursor.elementIndex
          : voice.length - 1
    }
    score.mutate((s) =>
      updateElement(s, pi, mi, vi, ei, (el) =>
        el.kind === 'note'
          ? { ...el, dynamic: el.dynamic === code ? undefined : code }
          : el,
      ),
    )
  }

  // Slur the selected range (start on first, stop on last).
  function addSlur() {
    if (!normSelection) return
    const n = normSelection
    score.mutate((s) => {
      let next = updateElement(
        s,
        n.partIndex,
        n.startMeasure,
        n.voiceIndex,
        n.startEl,
        (el) => (el.kind === 'note' ? { ...el, slurStart: true } : el),
      )
      next = updateElement(
        next,
        n.partIndex,
        n.endMeasure,
        n.voiceIndex,
        n.endEl,
        (el) => (el.kind === 'note' ? { ...el, slurStop: true } : el),
      )
      return next
    })
  }

  // ── Ensemble (score manager) ──────────────────────────────────────────────
  function handleAddPart(preset: InstrumentPreset) {
    score.mutate((s) => addPart(s, preset))
  }
  function handleRemovePart(index: number) {
    if (score.score.parts.length <= 1) return
    score.mutate((s) => removePart(s, index))
    const newLen = score.score.parts.length - 1
    input.setCursor((c) => {
      let pi = c.partIndex
      if (index < pi) pi -= 1
      else if (index === pi) pi = Math.min(pi, newLen - 1)
      pi = Math.max(0, Math.min(pi, newLen - 1))
      return { ...c, partIndex: pi, elementIndex: 0 }
    })
  }
  function handleMovePart(from: number, to: number) {
    score.mutate((s) => movePart(s, from, to))
    input.setCursor((c) => {
      let pi = c.partIndex
      if (pi === from) pi = to
      else if (from < pi && pi <= to) pi -= 1
      else if (to <= pi && pi < from) pi += 1
      return { ...c, partIndex: pi }
    })
  }

  const measureCount = Math.max(
    1,
    ...score.score.parts.map((p) => p.measures.length),
  )

  // ── Voices (per current measure) ──────────────────────────────────────────
  const cursorMeasure =
    score.score.parts[input.cursor.partIndex]?.measures[
      input.cursor.measureIndex
    ]
  const cursorVoiceCount = cursorMeasure ? cursorMeasure.voices.length : 1

  function setActiveVoice(voiceIndex: number) {
    const vi = Math.max(0, Math.min(voiceIndex, cursorVoiceCount - 1))
    const voice = cursorMeasure?.voices[vi]
    input.setCursor((c) => ({
      ...c,
      voiceIndex: vi,
      elementIndex: voice ? voice.length : 0,
    }))
  }
  function addVoice() {
    score.addVoiceAt(input.cursor.partIndex, input.cursor.measureIndex)
    // Move to the newly added (last) voice.
    input.setCursor((c) => ({
      ...c,
      voiceIndex: cursorVoiceCount, // old count = new last index
      elementIndex: 0,
    }))
  }
  function removeVoice() {
    if (cursorVoiceCount <= 1) return
    score.removeVoiceAt(
      input.cursor.partIndex,
      input.cursor.measureIndex,
      input.cursor.voiceIndex,
    )
    input.setCursor((c) => ({
      ...c,
      voiceIndex: Math.max(0, Math.min(c.voiceIndex, cursorVoiceCount - 2)),
      elementIndex: 0,
    }))
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

  function exportPdf() {
    try {
      exportPDF(score.score, `${safeName()}.pdf`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`PDF書き出しに失敗しました: ${msg}`)
    }
  }

  const [rendering, setRendering] = useState(false)
  async function exportAudio(kind: 'wav' | 'mp3') {
    if (rendering) return
    setRendering(true)
    try {
      const buffer = await renderScore(score.score)
      if (kind === 'wav') {
        downloadBytes(`${safeName()}.wav`, encodeWav(buffer), 'audio/wav')
      } else {
        downloadBytes(`${safeName()}.mp3`, encodeMp3(buffer), 'audio/mpeg')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`音声の書き出しに失敗しました: ${msg}`)
    } finally {
      setRendering(false)
    }
  }

  function importXML(file: File) {
    file
      .text()
      .then((text) => {
        const imported = importMusicXML(text)
        score.setScore(imported)
        input.setCursor({
          partIndex: 0,
          measureIndex: 0,
          voiceIndex: 0,
          elementIndex: 0,
        })
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
      icon: (
        <ClefKeyIcon color={settings.theme === 'dark' ? '#e8eaee' : '#16181d'} />
      ),
      content: (
        <SymbolDrawer
          score={score.score}
          cursorPartIndex={input.cursor.partIndex}
          cursorMeasureIndex={input.cursor.measureIndex}
          onSetClef={(pi, clef: Clef) => score.updatePartMeta(pi, { clef })}
          onSetMeasureClef={(pi, mi, clef: Clef) =>
            score.mutate((s) => setMeasureClef(s, pi, mi, clef))
          }
          onSetKey={(keyFifths) => score.updateMeta({ keyFifths })}
          onSetMeasureKey={(mi, fifths) =>
            score.mutate((s) => setMeasureKey(s, mi, fifths))
          }
          onSetTime={(time: TimeSignature) => score.updateMeta({ time })}
          onSetMeasureTime={(mi, time: TimeSignature) =>
            score.mutate((s) => setMeasureTime(s, mi, time))
          }
          onTranspose={(semi) => score.mutate((s) => transposeScore(s, semi))}
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
          onAppendMany={(n) => score.addMeasures(n)}
          onInsertAfter={insertMeasure}
          onDelete={deleteMeasure}
          voiceCount={cursorVoiceCount}
          activeVoice={input.cursor.voiceIndex}
          onSetVoice={setActiveVoice}
          onAddVoice={addVoice}
          onRemoveVoice={removeVoice}
        />
      ),
    },
    {
      id: 'selection',
      label: '選択',
      icon: '✂',
      content: (
        <SelectionDrawer
          mode={input.mode}
          onToggleSelect={toggleSelect}
          hasSelection={input.selection !== null}
          hasClipboard={!!input.clipboard && input.clipboard.length > 0}
          onCopy={copySelection}
          onCut={cutSelection}
          onPaste={pasteClipboard}
          onClearSelection={clearSelection}
        />
      ),
    },
    {
      id: 'expression',
      label: '表現',
      icon: '＞',
      content: (
        <ExpressionDrawer
          onArticulate={articulate}
          onTie={toggleTie}
          onSlur={addSlur}
          onDynamic={setDynamic}
          hasSelection={input.selection !== null}
        />
      ),
    },
    {
      id: 'zoom',
      label: '表示',
      icon: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
      content: (
        <ZoomDrawer
          zoomY={settings.zoomY}
          zoomX={settings.zoomX}
          onSetZoomY={(z) => update({ zoomY: z })}
          onSetZoomX={(z) => update({ zoomX: z })}
          onReset={() => update({ zoomY: 1, zoomX: 1 })}
          layoutMode={settings.layoutMode}
          onSetLayoutMode={(m) => update({ layoutMode: m })}
          onPreview={() => setShowPreview(true)}
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
          cursorMeasureIndex={input.cursor.measureIndex}
          cursorTempo={
            tempoTimeline(score.score)[input.cursor.measureIndex] ??
            score.score.tempo
          }
          hasMeasureTempo={
            cursorMeasure?.tempo !== undefined
          }
          onSetMeasureTempo={(bpm) =>
            score.mutate((s) =>
              setMeasureTempo(s, input.cursor.measureIndex, bpm),
            )
          }
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
          input.setCursor({
          partIndex: 0,
          measureIndex: 0,
          voiceIndex: 0,
          elementIndex: 0,
        })
        }}
        onExportXML={exportXML}
        onExportMIDI={exportMidi}
        onExportPDF={exportPdf}
        onExportWav={() => exportAudio('wav')}
        onExportMp3={() => exportAudio('mp3')}
        audioBusy={rendering}
        onImportXML={() => fileInputRef.current?.click()}
        onOpenManager={() => setShowManager(true)}
        onUndo={score.undo}
        onRedo={score.redo}
        canUndo={score.canUndo}
        canRedo={score.canRedo}
        eraser={input.mode === 'eraser'}
        onToggleEraser={() =>
          input.setMode((m) => (m === 'eraser' ? 'normal' : 'eraser'))
        }
      />

      <StaffArea
        score={score.score}
        zoomY={settings.zoomY}
        zoomX={settings.zoomX}
        layoutMode={settings.layoutMode}
        dark={settings.theme === 'dark'}
        onZoomY={(z) => update({ zoomY: z })}
        cursor={input.cursor}
        preview={input.method === 'picker' ? input.previewNote : null}
        previewOverflow={previewOverflow}
        onCellClick={handleCellClick}
        selectMode={input.mode === 'select'}
        onSelectRect={handleSelectRect}
        eraser={input.mode === 'eraser'}
        selection={normSelection}
        playMeasure={playback.playMeasure}
        fontToken={activeFont}
      >
        <DrawerRail drawers={drawers} />
      </StaffArea>

      <CursorBar
        measureIndex={input.cursor.measureIndex}
        measureCount={
          score.score.parts[input.cursor.partIndex]?.measures.length ??
          measureCount
        }
        elementIndex={input.cursor.elementIndex}
        elementCount={
          cursorMeasure?.voices[input.cursor.voiceIndex]?.length ?? 0
        }
        voiceIndex={input.cursor.voiceIndex}
        voiceCount={cursorVoiceCount}
        method={input.method}
        onStep={moveStep}
        onMeasure={moveMeasure}
        onSwitchMethod={switchMethod}
      />

      <InputArea
        method={input.method}
        picker={input.picker}
        patch={input.patchPicker}
        onCommitNote={commitNote}
        onCommitRest={commitRest}
        onCommitMidi={commitMidi}
        onCommitDelete={commitDelete}
        overflow={previewOverflow}
      />

      {showPreview && (
        <PrintPreview
          score={score.score}
          fileName={`${safeName()}.pdf`}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showManager && (
        <ScoreManager
          parts={score.score.parts}
          onClose={() => setShowManager(false)}
          onAdd={handleAddPart}
          onRemove={handleRemovePart}
          onMove={handleMovePart}
          onUpdate={(i, patch) => score.updatePartMeta(i, patch)}
        />
      )}
    </div>
  )
}
