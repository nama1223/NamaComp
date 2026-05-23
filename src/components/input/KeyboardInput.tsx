import { useState } from 'react'

// Placeholder for the keyboard-style input method. The one decided feature is a
// transpose control; the playable keyboard + entry wiring come in a later pass.
export function KeyboardInput() {
  const [transpose, setTranspose] = useState(0)
  const sign = transpose > 0 ? '+' : ''

  return (
    <div className="kbd-input">
      <div className="kbd-transpose">
        <span>移調</span>
        <button onClick={() => setTranspose((t) => t - 1)}>◀</button>
        <span className="kbd-transpose-val">
          {sign}
          {transpose}
        </span>
        <button onClick={() => setTranspose((t) => t + 1)}>▶</button>
      </div>
      <p className="kbd-note">キーボード式入力は準備中です（移調対応予定）。</p>
    </div>
  )
}
