import { formatDuration } from '../lib/dates'

type Props = {
  minutes: number
  step: number
  onChange: (minutes: number) => void
}

export function Stepper({ minutes, step, onChange }: Props) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="quiet round"
        onClick={() => onChange(Math.max(step, minutes - step))}
        aria-label={`${step} minutes less`}
      >
        −
      </button>
      <span className="stepper-value">{formatDuration(minutes)}</span>
      <button
        type="button"
        className="quiet round"
        onClick={() => onChange(Math.min(600, minutes + step))}
        aria-label={`${step} minutes more`}
      >
        +
      </button>
    </div>
  )
}
