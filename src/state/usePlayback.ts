import { useCallback, useEffect, useRef, useState } from 'react'
import type { Score } from '../types/score'
import { Player, measureStartTimes } from '../audio/player'

export function usePlayback() {
  const playerRef = useRef<Player | null>(null)
  const rafRef = useRef<number | null>(null)
  const startsRef = useRef<number[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [playMeasure, setPlayMeasure] = useState<number | null>(null)

  if (playerRef.current === null) {
    playerRef.current = new Player()
  }

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const tick = useCallback(() => {
    const player = playerRef.current!
    const t = player.currentTime
    if (t === null) return
    const starts = startsRef.current
    // Last measure whose start time has been reached.
    let m = 0
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= t) m = i
      else break
    }
    setPlayMeasure(m)
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const stop = useCallback(() => {
    stopRaf()
    playerRef.current!.stop()
    setIsPlaying(false)
    setPlayMeasure(null)
  }, [stopRaf])

  const play = useCallback(
    (score: Score) => {
      stopRaf()
      startsRef.current = measureStartTimes(score)
      playerRef.current!.play(score)
      setIsPlaying(true)
      setPlayMeasure(0)
      rafRef.current = requestAnimationFrame(tick)
    },
    [stopRaf, tick],
  )

  useEffect(() => {
    const player = playerRef.current!
    player.onEnded = () => {
      stopRaf()
      setIsPlaying(false)
      setPlayMeasure(null)
    }
    return () => {
      stopRaf()
      player.stop()
    }
  }, [stopRaf])

  const toggle = useCallback(
    (score: Score) => {
      if (playerRef.current!.isPlaying) stop()
      else play(score)
    },
    [play, stop],
  )

  return { isPlaying, playMeasure, play, stop, toggle }
}
