import type { ReactNode } from 'react'

interface WheelProps<T> {
  items: T[]
  index: number
  onIndex: (i: number) => void
  render: (item: T) => ReactNode
  wrap?: boolean
  className?: string
}

// A compact 3-row vertical "picker roll": higher value on top, current in the
// middle, lower below. Tapping a neighbour selects it. Used for pitch + length.
export function Wheel<T>({
  items,
  index,
  onIndex,
  render,
  wrap = false,
  className = '',
}: WheelProps<T>) {
  const n = items.length
  const hiIdx = wrap ? (index + 1) % n : index + 1
  const loIdx = wrap ? (index - 1 + n) % n : index - 1
  const hi = items[hiIdx]
  const lo = items[loIdx]

  return (
    <div className={`wheel ${className}`}>
      <button
        className="wheel-cell hi"
        disabled={hi === undefined}
        onClick={() => hi !== undefined && onIndex(hiIdx)}
      >
        {hi !== undefined ? render(hi) : ''}
      </button>
      <div className="wheel-cell cur">{render(items[index])}</div>
      <button
        className="wheel-cell lo"
        disabled={lo === undefined}
        onClick={() => lo !== undefined && onIndex(loIdx)}
      >
        {lo !== undefined ? render(lo) : ''}
      </button>
    </div>
  )
}
