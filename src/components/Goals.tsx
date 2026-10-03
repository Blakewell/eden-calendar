import type { Data, GoalStatus } from '../lib/plan'
import { goalStatus } from '../lib/plan'
import type { Goal } from '../lib/types'
import { formatDays, formatDuration, formatTime, fromISODate, today } from '../lib/dates'

const shortDate = (s: string) => fromISODate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const GROUPS: [GoalStatus, string][] = [
  ['active', 'Going now'],
  ['upcoming', 'Starting later'],
  ['ended', 'Finished'],
]

function dateRange(g: Goal): string {
  if (g.from && g.until) return `${shortDate(g.from)} – ${shortDate(g.until)}`
  if (g.from) return `from ${shortDate(g.from)}`
  if (g.until) return `until ${shortDate(g.until)}`
  return ''
}

type Props = {
  data: Data
  readOnly?: boolean // someone else's goals, shared with you
  onEdit: (goal: Goal) => void
  onAdd: () => void
}

export function Goals({ data, readOnly = false, onEdit, onAdd }: Props) {
  const todayStr = today()
  return (
    <>
      <header className="day-header">
        <h1>Daily goals</h1>
        <p className="muted">
          {readOnly ? 'Time they want to spend on things.' : 'Time you want to spend on things. Tap one to change it.'}
        </p>
      </header>

      {data.goals.length === 0 && (
        <section className="kind-goal empty">
          <p className="muted">{readOnly ? 'No goals yet.' : 'Nothing yet. Add things like reading or practice.'}</p>
          {!readOnly && (
            <button className="primary" onClick={onAdd}>
              Add a goal
            </button>
          )}
        </section>
      )}

      {GROUPS.map(([status, heading]) => {
        const goals = data.goals.filter((g) => goalStatus(g, todayStr) === status)
        if (goals.length === 0) return null
        return (
          <section key={status}>
            <h3>{heading}</h3>
            <ul className="list">
              {goals.map((g) => (
                <li key={g.id}>
                  <button
                    className={`card kind-goal${status === 'ended' ? ' done' : ''}`}
                    aria-disabled={readOnly || undefined}
                    onClick={() => !readOnly && onEdit(g)}
                  >
                    <span className="title">{g.title}</span>
                    <span className="meta">
                      {formatDuration(g.minutes)} · {g.start ? formatTime(g.start) : 'Anytime'} · {formatDays(g.days)}
                      {dateRange(g) && ` · ${dateRange(g)}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
