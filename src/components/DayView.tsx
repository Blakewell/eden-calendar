import { useEffect, useState } from 'react'
import type { Data } from '../lib/plan'
import { awakeHours, blocksOn, checkId, funOn, goalStartOn, goalsOn, tasksOn, timeline } from '../lib/plan'
import type { Fun, Goal, Task } from '../lib/types'
import { addDays, dueLabel, formatDay, formatDuration, formatTime, greeting, nowHHMM, today } from '../lib/dates'
import type { Editable } from './Editor'
import { DayCalendar } from './DayCalendar'

type Props = {
  data: Data
  date: string
  onDate: (date: string) => void
  onEdit: (rec: Editable) => void
  onAddAt: (start: string) => void
  onMove: (rec: Goal | Fun, start: string) => void
  onToggleGoal: (goal: Goal) => void
  onToggleTask: (task: Task) => void
}

export function DayView({ data, date, onDate, onEdit, onAddAt, onMove, onToggleGoal, onToggleTask }: Props) {
  const [now, setNow] = useState(nowHHMM)
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 30_000)
    return () => clearInterval(t)
  }, [])

  const todayStr = today()
  const isToday = date === todayStr
  const { weekday, date: dateLabel } = formatDay(date)

  const blocks = blocksOn(data, date)
  const hours = awakeHours(data.settings, date)
  const { slots, freeMinutes } = timeline(blocks, hours)
  const goals = goalsOn(data.goals, date)
  const tasks = tasksOn(data.tasks, date, todayStr)
  const maybe = funOn(data.fun, date).filter((f) => !f.start)

  const goalDone = (g: Goal) => data.checks.has(checkId(g.id, date))
  // Goals with a time already have their slot on the calendar, so only anytime ones still need fitting in.
  const goalLeft = goals.filter((g) => !g.start && !goalDone(g)).reduce((n, g) => n + g.minutes, 0)
  const taskLeft = tasks.filter((t) => !t.doneOn).reduce((n, t) => n + t.minutes, 0)
  const toFit = goalLeft + taskLeft
  const barTotal = Math.max(freeMinutes, toFit, 1)

  return (
    <>
      <header className="day-header">
        {isToday && <p className="greeting">{greeting()}, Eden</p>}
        <h1>{weekday}</h1>
        <p className="muted">{dateLabel}</p>

        <nav className="day-nav" aria-label="Change day">
          <button className="quiet" onClick={() => onDate(addDays(date, -1))} aria-label="Previous day">
            ←
          </button>
          <button className="quiet" onClick={() => onDate(todayStr)} disabled={isToday}>
            Today
          </button>
          <button className="quiet" onClick={() => onDate(addDays(date, 1))} aria-label="Next day">
            →
          </button>
        </nav>
      </header>

      <section className="summary" aria-label="Time today">
        <div className="bar" aria-hidden="true">
          <span className="seg kind-goal" style={{ width: `${(goalLeft / barTotal) * 100}%` }} />
          <span className="seg kind-task" style={{ width: `${(taskLeft / barTotal) * 100}%` }} />
        </div>
        <p>
          <strong>{formatDuration(freeMinutes)}</strong> <span className="muted">free</span>
          {toFit > 0 && (
            <>
              {' · '}
              <strong>{formatDuration(toFit)}</strong> <span className="muted">to fit in</span>
            </>
          )}
        </p>
        <p className="muted small">
          {toFit === 0
            ? 'Nothing left to fit in. Enjoy it.'
            : toFit <= freeMinutes
              ? `Fits, with ${formatDuration(freeMinutes - toFit)} to spare.`
              : `That's ${formatDuration(toFit - freeMinutes)} more than your free time. Maybe move something?`}
        </p>
      </section>

      <section aria-labelledby="schedule">
        <h3 id="schedule">Schedule</h3>
        {blocks.some((b) => b.rec.kind !== 'routine') && (
          <p className="muted small hint">Hold and drag a goal or fun plan to move it.</p>
        )}
        <DayCalendar
          blocks={blocks}
          free={slots}
          hours={hours}
          now={isToday ? now : null}
          isDone={(rec) => rec.kind === 'goal' && goalDone(rec)}
          onEdit={onEdit}
          onAddAt={onAddAt}
          onMove={onMove}
        />
      </section>

      {goals.length > 0 && (
        <section>
          <h3>Daily goals</h3>
          <ul className="list">
            {goals.map((g) => (
              <li key={g.id} className={`card kind-goal${goalDone(g) ? ' done' : ''}`}>
                <button
                  className="check"
                  role="checkbox"
                  aria-checked={goalDone(g)}
                  aria-label={`${g.title} done`}
                  onClick={() => onToggleGoal(g)}
                />
                <button className="card-body" onClick={() => onEdit(g)}>
                  <span className="title">{g.title}</span>
                  <span className="meta">
                    {formatDuration(g.minutes)}
                    {g.start && ` · ${formatTime(goalStartOn(g, date)!)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tasks.length > 0 && (
        <section>
          <h3>Assignments</h3>
          <ul className="list">
            {tasks.map((t) => (
              <li key={t.id} className={`card kind-task${t.doneOn ? ' done' : ''}`}>
                <button
                  className="check"
                  role="checkbox"
                  aria-checked={!!t.doneOn}
                  aria-label={`${t.title} done`}
                  onClick={() => onToggleTask(t)}
                />
                <button className="card-body" onClick={() => onEdit(t)}>
                  <span className="title">{t.title}</span>
                  <span className="meta">
                    {formatDuration(t.minutes)}
                    {!t.doneOn && t.date < date && ' · from earlier'}
                    {t.due && !t.doneOn && (
                      <span className={t.due < date ? 'overdue' : ''}> · {dueLabel(t.due, date)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {maybe.length > 0 && (
        <section>
          <h3>Maybe today</h3>
          <ul className="list">
            {maybe.map((f) => (
              <li key={f.id} className="card kind-fun">
                <button className="card-body" onClick={() => onEdit(f)}>
                  <span className="title">{f.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
