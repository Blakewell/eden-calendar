import type { Data } from '../lib/plan'
import type { Settings } from '../lib/types'
import { formatDays, formatTime, fromISODate, today } from '../lib/dates'
import type { Editable } from './Editor'

const shortDate = (s: string) =>
  fromISODate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

type Props = {
  data: Data
  onEdit: (rec: Editable) => void
  onSettings: (s: Settings) => void
  readOnly?: boolean // someone else's week, shared with you
}

export function WeekSetup({ data, onEdit, onSettings, readOnly = false }: Props) {
  const { settings } = data
  const repeating = data.routines.filter((r) => !r.date)
  const upcoming = [
    ...data.routines.filter((r) => r.date && r.date >= today()),
    ...data.fun.filter((f) => f.date >= today()),
  ].sort((a, b) => `${a.date}${a.start ?? ''}`.localeCompare(`${b.date}${b.start ?? ''}`))

  return (
    <>
      <header className="day-header">
        <h1>My week</h1>
        <p className="muted">
          {readOnly ? 'Their set times and awake hours.' : 'Your set times and awake hours. Tap anything to change it.'}
        </p>
      </header>

      <section>
        <h3>Awake hours</h3>
        <p className="muted small">Free time is counted between these. Leave bedtime empty for midnight.</p>
        {(
          [
            ['Weekdays', 'dayStart', 'dayEnd'],
            ['Weekends', 'weekendStart', 'weekendEnd'],
          ] as const
        ).map(([label, startKey, endKey]) => (
          <div key={label}>
            <h4>{label}</h4>
            <div className="row">
              <label>
                <span>Up at</span>
                <input
                  type="time"
                  disabled={readOnly}
                  value={settings[startKey]}
                  onChange={(e) => e.target.value && onSettings({ ...settings, [startKey]: e.target.value })}
                />
              </label>
              <label>
                <span>Bed at</span>
                <input
                  type="time"
                  disabled={readOnly}
                  value={settings[endKey]}
                  onChange={(e) => onSettings({ ...settings, [endKey]: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h3>Routines</h3>
        {repeating.length === 0 && (
          <p className="muted small">Nothing yet. Add school, practice, and other set times.</p>
        )}
        <ul className="list">
          {repeating.map((r) => (
            <li key={r.id}>
              <button
                className="card kind-routine"
                aria-disabled={readOnly || undefined}
                onClick={() => !readOnly && onEdit(r)}
              >
                <span className="title">{r.title}</span>
                <span className="meta">
                  {formatDays(r.days)} · {formatTime(r.start)} – {formatTime(r.end)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <section>
          <h3>Coming up</h3>
          <ul className="list">
            {upcoming.map((u) => (
              <li key={u.id}>
                <button
                  className={`card kind-${u.kind}`}
                  aria-disabled={readOnly || undefined}
                  onClick={() => !readOnly && onEdit(u)}
                >
                  <span className="title">{u.title}</span>
                  <span className="meta">
                    {u.date && shortDate(u.date)}
                    {u.start && ` · ${formatTime(u.start)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
