import type { InputMethod } from '../../types/editor'

interface CursorBarProps {
  measureIndex: number
  measureCount: number
  elementIndex: number
  elementCount: number
  voiceIndex: number
  voiceCount: number
  method: InputMethod
  /** Move the insert cursor by ±1 element (wraps across measures). */
  onStep: (delta: number) => void
  /** Jump the cursor to the previous/next measure. */
  onMeasure: (delta: number) => void
  onSwitchMethod: () => void
  /** True when the cursor sits on a note that can be re-pitched in place. */
  canNudge: boolean
  /** Re-pitch the note under the cursor by ±1 semitone. */
  onNudge: (delta: number) => void
}

// Thin strip between the staff and the input area. Shows where the insert
// cursor is and lets the user nudge it precisely (which a touch tap can't),
// plus the picker/keyboard input-method toggle in one obvious place.
export function CursorBar({
  measureIndex,
  measureCount,
  elementIndex,
  elementCount,
  voiceIndex,
  voiceCount,
  method,
  onStep,
  onMeasure,
  onSwitchMethod,
  canNudge,
  onNudge,
}: CursorBarProps) {
  return (
    <div className="cursor-bar">
      <div className="cbar-nav">
        <button
          aria-label="前の小節へ"
          title="前の小節へ"
          disabled={measureIndex <= 0}
          onClick={() => onMeasure(-1)}
        >
          ⏮
        </button>
        <button
          aria-label="カーソルを左へ"
          title="カーソルを左へ"
          onClick={() => onStep(-1)}
        >
          ◀
        </button>
        <span className="cbar-pos">
          <b>{measureIndex + 1}</b>
          <span className="cbar-sep">/{measureCount}</span>
          <span className="cbar-unit">小節</span>
          {voiceCount > 1 && (
            <span className="cbar-voice">声部{voiceIndex + 1}</span>
          )}
          <span className="cbar-el">
            {Math.min(elementIndex, elementCount)}/{elementCount}
          </span>
        </span>
        <button
          aria-label="カーソルを右へ"
          title="カーソルを右へ"
          onClick={() => onStep(1)}
        >
          ▶
        </button>
        <button
          aria-label="次の小節へ"
          title="次の小節へ"
          disabled={measureIndex >= measureCount - 1}
          onClick={() => onMeasure(1)}
        >
          ⏭
        </button>
      </div>

      {canNudge && (
        <div className="cbar-pitch" role="group" aria-label="この音の高さ">
          <span className="cbar-pitch-label">音程</span>
          <button
            aria-label="半音上げる"
            title="この音を半音上げる"
            onClick={() => onNudge(1)}
          >
            ▲
          </button>
          <button
            aria-label="半音下げる"
            title="この音を半音下げる"
            onClick={() => onNudge(-1)}
          >
            ▼
          </button>
        </div>
      )}

      <div className="cbar-method" role="group" aria-label="入力方式">
        <button
          className={method === 'picker' ? 'active' : ''}
          onClick={() => method !== 'picker' && onSwitchMethod()}
        >
          ロール
        </button>
        <button
          className={method === 'keyboard' ? 'active' : ''}
          onClick={() => method !== 'keyboard' && onSwitchMethod()}
        >
          鍵盤
        </button>
      </div>
    </div>
  )
}
