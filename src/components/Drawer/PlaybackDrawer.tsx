interface PlaybackDrawerProps {
  tempo: number
  onTempo: (bpm: number) => void
  isPlaying: boolean
  onPlay: () => void
  onStop: () => void
  cursorMeasureIndex: number
  cursorTempo: number
  hasMeasureTempo: boolean
  onSetMeasureTempo: (bpm: number | undefined) => void
}

export function PlaybackDrawer({
  tempo,
  onTempo,
  isPlaying,
  onPlay,
  onStop,
  cursorMeasureIndex,
  cursorTempo,
  hasMeasureTempo,
  onSetMeasureTempo,
}: PlaybackDrawerProps) {
  return (
    <div className="drawer-content">
      <div className="playback">
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
          <span>全体 ♩=</span>
          <button onClick={() => onTempo(Math.max(20, tempo - 5))}>◀</button>
          <span className="tempo-val">{tempo}</span>
          <button onClick={() => onTempo(Math.min(300, tempo + 5))}>▶</button>
        </div>
      </div>

      <div className="sym-group">
        <span className="sym-label">
          曲中テンポ（{cursorMeasureIndex + 1}小節目から）
        </span>
        <div className="sym-row">
          <button
            onClick={() => onSetMeasureTempo(Math.max(20, cursorTempo - 5))}
          >
            ◀
          </button>
          <span className="sym-value">♩={cursorTempo}</span>
          <button
            onClick={() => onSetMeasureTempo(Math.min(300, cursorTempo + 5))}
          >
            ▶
          </button>
          <button
            className="danger"
            disabled={!hasMeasureTempo}
            onClick={() => onSetMeasureTempo(undefined)}
          >
            解除
          </button>
        </div>
      </div>
    </div>
  )
}
