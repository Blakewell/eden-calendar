import { useEffect, useState, type ReactNode } from 'react'
import type { Data, Movable } from '../lib/plan'
import {
  MIDNIGHT,
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
  untilBedtime,
} from '../lib/plan'
import type { Goal, Task } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { addDays, dueLabel, formatDay, formatDuration, formatTime, greeting, nowHHMM, today } from '../lib/dates'
import type { Editable } from './Editor'
import { DayCalendar } from './DayCalendar'

export type DayTab = 'calendar' | 'todo'

type Props = {
  data: Data
  date: string
  tab: DayTab
  onScheduled: () => void // after one-tap Schedule places something: show the calendar
  name: string | null // first name of whoever's signed in, for the greeting
  owner?: string | null // set when viewing someone else's shared day (view only)
  onDate: (date: string) => void
  onEdit: (rec: Editable) => void
  onAddAt: (start: string) => void
  onMove: (rec: Movable, start: string) => void
  onToggleGoal: (goal: Goal) => void
  onToggleTask: (task: Task) => void
}

export function DayView({
  data,
  date,
  tab,
  onScheduled,
  name,
  owner = null,
  onDate,
  onEdit,
  onAddAt,
  onMove,
  onToggleGoal,
  onToggleTask,
}: Props) {
  const [now, setNow] = useState(nowHHMM)
  // A short line after tapping Schedule: where it went, or that nothing fits.
  const [note, setNote] = useState<{ text: string; date: string } | null>(null)
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 30_000)
    return () => clearInterval(t)
  }, [])

  const readOnly = owner !== null
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
    if (start) {
      onMove(rec, start)
      onScheduled()
    }
    setNote({
      date,
      text: start
        ? `${rec.title} is on at ${formatTime(start)}. Drag it to move it.`
        : `No free gap long enough for ${rec.title}${isToday ? ' left today' : ''}. Tap a spot on the calendar to put it there anyway.`,
    })
  }
  const toFit = goalLeft + taskLeft
  const bedtime = hours[1] === MIDNIGHT ? 'midnight' : formatTime(hours[1])
  const toBed = untilBedtime(data.settings, date, now)
  const barTotal = Math.max(freeMinutes, toFit, 1)

  return (
    <>
      <header className="day-header">
        {readOnly ? (
          <p className="greeting">{owner}'s day</p>
        ) : (
          isToday && (
            <p className="greeting">
              {greeting()}
              {name && `, ${name}`}
            </p>
          )
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
        {isToday && (
          <p className="muted small">
            {toBed > 0 ? (
              <>
                <strong>{formatDuration(toBed)}</strong> until bedtime ({bedtime})
              </>
            ) : (
              `Past bedtime (${bedtime}). Sleep well.`
            )}
          </p>
        )}
      </section>

      {note?.date === date && (
        <p className="note muted small" role="status">
          {note.text}
        </p>
      )}

      {tab === 'calendar' ? (
        <>
          <section aria-labelledby="schedule">
            <h3 id="schedule">Schedule</h3>
            <p className="legend" aria-label="Colors">
              {(['routine', 'goal', 'task', 'fun'] as const).map((k) => (
                <span key={k} className={`legend-item kind-${k}`}>
                  <span className="dot" /> {KIND_LABEL[k]}
                </span>
              ))}
            </p>
            {!readOnly && blocks.some((b) => b.rec.kind !== 'routine') && (
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
              readOnly={readOnly}
            />
          </section>
        </>
      ) : (
        <>
          {goals.length + tasks.length + maybe.length === 0 && (
            <p className="muted empty-todo">Nothing to check off{isToday ? ' today' : ''}.</p>
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
                      aria-disabled={readOnly || undefined}
                      onClick={() => !readOnly && onToggleGoal(g)}
                    />
                    <CardBody readOnly={readOnly} onClick={() => onEdit(g)}>
                      <span className="title">{g.title}</span>
                      <span className="meta">
                        {formatDuration(g.minutes)}
                        {goalStartOn(g, date) && ` · ${formatTime(goalStartOn(g, date)!)}`}
                      </span>
                    </CardBody>
                    {!readOnly && !goalStartOn(g, date) && !goalDone(g) && (
                      <ScheduleButton rec={g} onSchedule={schedule} />
                    )}
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
                      aria-disabled={readOnly || undefined}
                      onClick={() => !readOnly && onToggleTask(t)}
                    />
                    <CardBody readOnly={readOnly} onClick={() => onEdit(t)}>
                      <span className="title">{t.title}</span>
                      <span className="meta">
                        {formatDuration(t.minutes)}
                        {taskStartOn(t, date) && ` · ${formatTime(taskStartOn(t, date)!)}`}
                        {!t.doneOn && t.date < date && ' · from earlier'}
                        {t.due && !t.doneOn && (
                          <span className={t.due < date ? 'overdue' : ''}> · {dueLabel(t.due, date)}</span>
                        )}
                      </span>
                    </CardBody>
                    {!readOnly && !taskStartOn(t, date) && !t.doneOn && (
                      <ScheduleButton rec={t} onSchedule={schedule} />
                    )}
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
                    <CardBody readOnly={readOnly} onClick={() => onEdit(f)}>
                      <span className="title">{f.title}</span>
                    </CardBody>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
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

// A card's text: tappable to edit, or plain on a day shared with you.
function CardBody({ readOnly, onClick, children }: { readOnly: boolean; onClick: () => void; children: ReactNode }) {
  if (readOnly) return <span className="card-body">{children}</span>
  return (
    <button className="card-body" onClick={onClick}>
      {children}
    </button>
  )
}
