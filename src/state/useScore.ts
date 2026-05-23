import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NoteElement, Score } from '../types/score'
import type { Cursor } from '../types/editor'
import type { Part } from '../types/score'
import {
  appendMeasure,
  createDefaultScore,
  deleteElement,
  deleteMeasure,
  insertElement,
  insertMeasureAfter,
  setScoreMeta,
  updatePart,
} from '../model/score'

const KEY = 'namacomp_score_v1'

function load(): Score {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Score
  } catch {
    /* fall through to a fresh score */
  }
  return createDefaultScore()
}

const HISTORY_LIMIT = 100

export function useScore() {
  const [present, setPresent] = useState<Score>(load)
  const [past, setPast] = useState<Score[]>([])
  const [future, setFuture] = useState<Score[]>([])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(present))
    } catch {
      /* storage may be unavailable */
    }
  }, [present])

  const commit = useCallback(
    (updater: (s: Score) => Score) => {
      setPast((p) => {
        const next = [...p, present]
        return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next
      })
      setFuture([])
      setPresent(updater(present))
    },
    [present],
  )

  const undo = useCallback(() => {
    if (past.length === 0) return
    const prev = past[past.length - 1]
    setPast(past.slice(0, -1))
    setFuture((f) => [present, ...f])
    setPresent(prev)
  }, [past, present])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setFuture(future.slice(1))
    setPast((p) => [...p, present])
    setPresent(next)
  }, [future, present])

  const insertAt = useCallback(
    (cursor: Cursor, element: NoteElement) => {
      commit((s) =>
        insertElement(
          s,
          cursor.partIndex,
          cursor.measureIndex,
          cursor.elementIndex,
          element,
        ),
      )
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
          cursor.elementIndex,
        ),
      )
    },
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

  const resetScore = useCallback(() => {
    setPast([])
    setFuture([])
    setPresent(createDefaultScore())
  }, [])

  return useMemo(
    () => ({
      score: present,
      setScore: setPresent,
      insertAt,
      removeAt,
      addMeasure,
      insertMeasure,
      removeMeasure,
      updateMeta,
      updatePartMeta,
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      resetScore,
    }),
    [
      present,
      insertAt,
      removeAt,
      addMeasure,
      insertMeasure,
      removeMeasure,
      updateMeta,
      updatePartMeta,
      undo,
      redo,
      past.length,
      future.length,
      resetScore,
    ],
  )
}
