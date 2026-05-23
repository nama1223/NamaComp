import { useCallback, useEffect, useRef, useState } from 'react'
import type { Score } from '../types/score'
import { Player } from '../audio/player'

export function usePlayback() {
  const playerRef = useRef<Player | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  if (playerRef.current === null) {
    playerRef.current = new Player()
  }

  useEffect(() => {
    const player = playerRef.current!
    player.onEnded = () => setIsPlaying(false)
    return () => player.stop()
  }, [])

  const play = useCallback((score: Score) => {
    playerRef.current!.play(score)
    setIsPlaying(true)
  }, [])

  const stop = useCallback(() => {
    playerRef.current!.stop()
    setIsPlaying(false)
  }, [])

  const toggle = useCallback(
    (score: Score) => {
      if (playerRef.current!.isPlaying) {
        playerRef.current!.stop()
        setIsPlaying(false)
      } else {
        playerRef.current!.play(score)
        setIsPlaying(true)
      }
    },
    [],
  )

  return { isPlaying, play, stop, toggle }
}
