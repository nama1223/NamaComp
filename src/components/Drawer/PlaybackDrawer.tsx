interface PlaybackDrawerProps {
  tempo: number
  onTempo: (bpm: number) => void
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
}

export function PlaybackDrawer({
  tempo,
  onTempo,
  isPlaying,
  onPlay,
  onStop,
}: PlaybackDrawerProps) {
  return (
    <div className="drawer-content playback">
      <button
        className="play-btn"
        aria-label={isPlaying ? '一時停止' : '再生'}
        onClick={onPlay}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button className="play-btn" aria-label="停止" onClick={onStop}>
        ■
      </button>

      <div className="tempo">
        <span>♩=</span>
        <button onClick={() => onTempo(Math.max(20, tempo - 5))}>◀</button>
        <span className="tempo-val">{tempo}</span>
        <button onClick={() => onTempo(Math.min(300, tempo + 5))}>▶</button>
      </div>
    </div>
  )
}
