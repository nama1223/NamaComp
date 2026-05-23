import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NoteElement, Score } from '../types/score'
import type { Cursor } from '../types/editor'
import type { Part } from '../types/score'
import {
  addVoice,
  appendMeasure,
  createDefaultScore,
  deleteElement,
  deleteMeasure,
  insertElement,
  insertMeasureAfter,
  migrateScore,
  removeVoice,
  setScoreMeta,
  updatePart,
} from '../model/score'

const KEY = 'namacomp_score_v1'

function load(): Score {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrateScore(JSON.parse(raw) as Score)
  } catch {
    /* fall through to a fresh score */
  }
  return createDefaultScore()
}

const HISTORY_LIMIT = 100

interface History {
  past: Score[]
  present: Score
  future: Score[]
}

export function useScore() {
  // Single atomic history object so multiple commits in one event handler
  // compose correctly (functional updates run in order).
  const [hist, setHist] = useState<History>(() => ({
    past: [],
    present: load(),
    future: [],
  }))
  const present = hist.present

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(present))
    } catch {
      /* storage may be unavailable */
    }
  }, [present])

  const commit = useCallback((updater: (s: Score) => Score) => {
    setHist((h) => {
      const next = updater(h.present)
      if (next === h.present) return h
      const past = [...h.past, h.present]
      return {
        past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past,
        present: next,
        future: [],
      }
    })
  }, [])

  const undo = useCallback(() => {
    setHist((h) => {
      if (h.past.length === 0) return h
      const prev = h.past[h.past.length - 1]
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [h.present, ...h.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHist((h) => {
      if (h.future.length === 0) return h
      const next = h.future[0]
      return {
        past: [...h.past, h.present],
        present: next,
        future: h.future.slice(1),
      }
    })
  }, [])

  const setScore = useCallback((s: Score) => {
    setHist((h) => ({
      past: [...h.past, h.present].slice(-HISTORY_LIMIT),
      present: s,
      future: [],
    }))
  }, [])

  const insertAt = useCallback(
    (cursor: Cursor, element: NoteElement) => {
      commit((s) =>
        insertElement(
          s,
          cursor.partIndex,
          cursor.measureIndex,
          cursor.voiceIndex,
          cursor.elementIndex,
          element,
        ),
      )
    },
    [commit],
  )

  /** Insert, and when `full` and the cursor is in the last measure, also append
   *  a fresh measure — all in one undoable commit (auto measure advance). */
  const insertAtAutoExpand = useCallback(
    (cursor: Cursor, element: NoteElement, full: boolean) => {
      commit((s) => {
        let next = insertElement(
          s,
          cursor.partIndex,
          cursor.measureIndex,
          cursor.voiceIndex,
          cursor.elementIndex,
          element,
        )
        const count = Math.max(0, ...next.parts.map((p) => p.measures.length))
        if (full && cursor.measureIndex >= count - 1) {
          next = appendMeasure(next)
        }
        return next
      })
    },
    [commit],
  )

  const removeAt = useCallback(
    (cursor: Cursor) => {
      commit((s) =>
        deleteElement(
          s,
          cursor.partIndex,
          cursor.measureIndex,
          cursor.voiceIndex,
          cursor.elementIndex,
        ),
      )
    },
    [commit],
  )

  const addVoiceAt = useCallback(
    (partIndex: number, measureIndex: number) =>
      commit((s) => addVoice(s, partIndex, measureIndex)),
    [commit],
  )

  const removeVoiceAt = useCallback(
    (partIndex: number, measureIndex: number, voiceIndex: number) =>
      commit((s) => removeVoice(s, partIndex, measureIndex, voiceIndex)),
    [commit],
  )

  const addMeasure = useCallback(() => commit((s) => appendMeasure(s)), [commit])

  const insertMeasure = useCallback(
    (measureIndex: number) =>
      commit((s) => insertMeasureAfter(s, measureIndex)),
    [commit],
  )

  const removeMeasure = useCallback(
    (measureIndex: number) => commit((s) => deleteMeasure(s, measureIndex)),
    [commit],
  )

  const updateMeta = useCallback(
    (patch: Partial<Score>) => commit((s) => setScoreMeta(s, patch)),
    [commit],
  )

  const updatePartMeta = useCallback(
    (partIndex: number, patch: Partial<Part>) =>
      commit((s) => updatePart(s, partIndex, patch)),
    [commit],
  )

  // Generic escape hatch for callers that need a custom transform (e.g. the
  // score manager and mid-piece clef/key edits).
  const mutate = useCallback(
    (updater: (s: Score) => Score) => commit(updater),
    [commit],
  )

  const resetScore = useCallback(() => {
    setHist({ past: [], present: createDefaultScore(), future: [] })
  }, [])

  return useMemo(
    () => ({
      score: present,
      setScore,
      insertAt,
      insertAtAutoExpand,
      removeAt,
      addVoiceAt,
      removeVoiceAt,
      addMeasure,
      insertMeasure,
      removeMeasure,
      updateMeta,
      updatePartMeta,
      mutate,
      undo,
      redo,
      canUndo: hist.past.length > 0,
      canRedo: hist.future.length > 0,
      resetScore,
    }),
    [
      present,
      setScore,
      insertAt,
      insertAtAutoExpand,
      removeAt,
      addVoiceAt,
      removeVoiceAt,
      addMeasure,
      insertMeasure,
      removeMeasure,
      updateMeta,
      updatePartMeta,
      mutate,
      undo,
      redo,
      hist.past.length,
      hist.future.length,
      resetScore,
    ],
  )
}
