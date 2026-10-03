import { useEffect, useState } from 'react'
import type { Data, Movable } from '../lib/plan'
import {
  awakeHours,
  blocksOn,
  checkId,
  findSlot,
  funOn,
  goalStartOn,
  goalsOn,
  taskStartOn,
  tasksOn,
  timeline,
} from '../lib/plan'
import type { Goal, Task } from '../lib/types'
import { addDays, dueLabel, formatDay, formatDuration, formatTime, greeting, nowHHMM, today } from '../lib/dates'
import type { Editable } from './Editor'
import { DayCalendar } from './DayCalendar'

type Props = {
  data: Data
  date: string
  name: string | null // first name of whoever's signed in, for the greeting
  onDate: (date: string) => void
  onEdit: (rec: Editable) => void
  onAddAt: (start: string) => void
  onMove: (rec: Movable, start: string) => void
  onToggleGoal: (goal: Goal) => void
  onToggleTask: (task: Task) => void
}

export function DayView({ data, date, name, onDate, onEdit, onAddAt, onMove, onToggleGoal, onToggleTask }: Props) {
  const [now, setNow] = useState(nowHHMM)
  // A short line after tapping Schedule: where it went, or that nothing fits.
  const [note, setNote] = useState<{ text: string; date: string } | null>(null)
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 30_000)
    return () => clearInterval(t)
  }, [])

  const todayStr = today()
  const isToday = date === todayStr
  const { weekday, date: dateLabel } = formatDay(date)

  const blocks = blocksOn(data, date, todayStr)
  const hours = awakeHours(data.settings, date)
  const { slots, freeMinutes } = timeline(blocks, hours)
  const goals = goalsOn(data.goals, date)
  const tasks = tasksOn(data.tasks, date, todayStr)
  const maybe = funOn(data.fun, date).filter((f) => !f.start)

  const goalDone = (g: Goal) => data.checks.has(checkId(g.id, date))
  // Anything with a slot on the calendar is already fitted in.
  const goalLeft = goals.filter((g) => !goalStartOn(g, date) && !goalDone(g)).reduce((n, g) => n + g.minutes, 0)
  const taskLeft = tasks.filter((t) => !t.doneOn && !taskStartOn(t, date)).reduce((n, t) => n + t.minutes, 0)

  // One tap: put it in the next free gap that fits (from now, when it's today).
  function schedule(rec: Goal | Task) {
    const start = findSlot(blocks, hours, rec.minutes, isToday ? now : '00:00')
    if (start) onMove(rec, start)
    setNote({
      date,
      text: start
        ? `${rec.title} is on at ${formatTime(start)}. Drag it to move it.`
        : `No free gap long enough for ${rec.title}${isToday ? ' left today' : ''}. Tap a spot on the calendar to put it there anyway.`,
    })
  }
  const toFit = goalLeft + taskLeft
  const barTotal = Math.max(freeMinutes, toFit, 1)

  return (
    <>
      <header className="day-header">
        {isToday && (
          <p className="greeting">
            {greeting()}
            {name && `, ${name}`}
          </p>
        )}
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
          isDone={(rec) => (rec.kind === 'goal' && goalDone(rec)) || (rec.kind === 'task' && !!rec.doneOn)}
          onEdit={onEdit}
          onAddAt={onAddAt}
          onMove={onMove}
        />
      </section>

      {note?.date === date && (
        <p className="note muted small" role="status">
          {note.text}
        </p>
      )}

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
                    {goalStartOn(g, date) && ` · ${formatTime(goalStartOn(g, date)!)}`}
                  </span>
                </button>
                {!goalStartOn(g, date) && !goalDone(g) && <ScheduleButton rec={g} onSchedule={schedule} />}
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
                    {taskStartOn(t, date) && ` · ${formatTime(taskStartOn(t, date)!)}`}
                    {!t.doneOn && t.date < date && ' · from earlier'}
                    {t.due && !t.doneOn && (
                      <span className={t.due < date ? 'overdue' : ''}> · {dueLabel(t.due, date)}</span>
                    )}
                  </span>
                </button>
                {!taskStartOn(t, date) && !t.doneOn && <ScheduleButton rec={t} onSchedule={schedule} />}
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

function ScheduleButton({ rec, onSchedule }: { rec: Goal | Task; onSchedule: (rec: Goal | Task) => void }) {
  return (
    <button className="quiet schedule" aria-label={`Schedule ${rec.title}`} onClick={() => onSchedule(rec)}>
      Schedule
    </button>
  )
}
