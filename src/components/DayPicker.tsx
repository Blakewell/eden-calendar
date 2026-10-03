import { WEEKDAYS_SHORT } from '../lib/dates'

const PRESETS: [string, number[]][] = [
  ['Weekdays', [1, 2, 3, 4, 5]],
  ['Weekends', [0, 6]],
  ['Every day', [0, 1, 2, 3, 4, 5, 6]],
]

const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function DayPicker({ days, onChange }: { days: number[]; onChange: (days: number[]) => void }) {
  function toggle(d: number) {
    onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort())
  }
  const key = [...days].sort().join()
  return (
    <>
      <div className="presets">
        {PRESETS.map(([label, set]) => (
          <button
            key={label}
            type="button"
            className={`link${key === set.join() ? ' on' : ''}`}
            onClick={() => onChange(set)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="day-picker">
        {WEEKDAYS_SHORT.map((label, d) => (
          <button
            key={d}
            type="button"
            className={days.includes(d) ? 'on' : ''}
            aria-pressed={days.includes(d)}
            aria-label={LONG[d]}
            onClick={() => toggle(d)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
