import { useEffect, useState, type ReactNode } from 'react'
import type { Data, Movable } from '../lib/plan'
import {
  MIDNIGHT,
  awakeHours,
  blocksOn,
  checkId,
  earliestStart,
  findSlot,
  freeFrom,
  funOn,
  goalStartOn,
  goalsOn,
  taskStartOn,
  tasksOn,
  timeline,
  toFitIn,
  untilBedtime,
} from '../lib/plan'
import type { Goal, Task } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { addDays, dueLabel, formatDay, formatDuration, formatTime, greeting, nowHHMM, today } from '../lib/dates'
import type { Editable } from './Editor'
import { DayCalendar } from './DayCalendar'
import { Fold } from './Plans'

export type DayTab = 'calendar' | 'todo'

// How long the Undo after checking something off stays up.
export const UNDO_MS = 5000

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
  // After checking something off: a few seconds to undo it.
  const [undo, setUndo] = useState<{ date: string; kind: 'goal' | 'task'; id: string; title: string } | null>(null)
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(t)
  }, [undo])
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
  const { slots, freeMinutes: dayFree } = timeline(blocks, hours)
  // On today, only what's left of the day counts as free.
  const freeMinutes = isToday ? freeFrom(blocks, hours, now) : dayFree
  const goals = goalsOn(data.goals, date)
  const tasks = tasksOn(data.tasks, date, todayStr)
  const maybe = funOn(data.fun, date).filter((f) => !f.start)

  const goalDone = (g: Goal) => data.checks.has(checkId(g.id, date))
  // Unfinished goals and tasks only go into time that hasn't passed yet.
  const earliest = earliestStart(date, todayStr, now)
  // Anything with a slot on the calendar is already fitted in.
  const unscheduled = toFitIn(data, date, todayStr)
  const toFit = unscheduled.reduce((n, r) => n + r.minutes, 0)
  // On To do, what's left comes first and finished things fold away.
  const goalsOpen = goals.filter((g) => !goalDone(g))
  const goalsDone = goals.filter(goalDone)
  const tasksOpen = tasks.filter((t) => !t.doneOn)
  const tasksDone = tasks.filter((t) => t.doneOn)

  // One tap: put it in the next free gap that fits (from now, when it's today).
  function schedule(rec: Goal | Task) {
    const start = earliest && findSlot(blocks, hours, rec.minutes, earliest)
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
  const bedtime = hours[1] === MIDNIGHT ? 'midnight' : formatTime(hours[1])
  const toBed = untilBedtime(data.settings, date, now)
  // The bar fills as goals and tasks are checked off.
  const checklist = goals.length + tasks.length

  // Checking something off folds it away, so offer a moment to take it back.
  // Undo looks the record up again, so it acts on what's saved now.
  function toggle(rec: Goal | Task, done: boolean) {
    if (rec.kind === 'goal') onToggleGoal(rec)
    else onToggleTask(rec)
    setUndo(done ? null : { date, kind: rec.kind, id: rec.id, title: rec.title })
  }
  function undoDone() {
    if (!undo) return
    const goal = undo.kind === 'goal' && data.goals.find((g) => g.id === undo.id)
    const task = undo.kind === 'task' && data.tasks.find((t) => t.id === undo.id)
    if (goal && goalDone(goal)) onToggleGoal(goal)
    if (task && task.doneOn) onToggleTask(task)
    setUndo(null)
  }

  const goalCard = (g: Goal) => (
    <li key={g.id} className={`card kind-goal${goalDone(g) ? ' done' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={goalDone(g)}
        aria-label={`${g.title} done`}
        aria-disabled={readOnly || undefined}
        onClick={() => !readOnly && toggle(g, goalDone(g))}
      />
      <CardBody readOnly={readOnly} onClick={() => onEdit(g)}>
        <span className="title">{g.title}</span>
        <span className="meta">
          {formatDuration(g.minutes)}
          {goalStartOn(g, date) && ` · ${formatTime(goalStartOn(g, date)!)}`}
        </span>
      </CardBody>
      {!readOnly && earliest && !goalStartOn(g, date) && !goalDone(g) && (
        <ScheduleButton rec={g} onSchedule={schedule} />
      )}
    </li>
  )
  const taskCard = (t: Task) => (
    <li key={t.id} className={`card kind-task${t.doneOn ? ' done' : ''}`}>
      <button
        className="check"
        role="checkbox"
        aria-checked={!!t.doneOn}
        aria-label={`${t.title} done`}
        aria-disabled={readOnly || undefined}
        onClick={() => !readOnly && toggle(t, !!t.doneOn)}
      />
      <CardBody readOnly={readOnly} onClick={() => onEdit(t)}>
        <span className="title">{t.title}</span>
        <span className="meta">
          {formatDuration(t.minutes)}
          {taskStartOn(t, date) && ` · ${formatTime(taskStartOn(t, date)!)}`}
          {!t.doneOn && t.date < date && ' · from earlier'}
          {t.due && !t.doneOn && <span className={t.due < date ? 'overdue' : ''}> · {dueLabel(t.due, date)}</span>}
        </span>
      </CardBody>
      {!readOnly && earliest && !taskStartOn(t, date) && !t.doneOn && <ScheduleButton rec={t} onSchedule={schedule} />}
    </li>
  )

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
        {checklist > 0 && (
          <>
            <div className="bar" aria-hidden="true">
              <span className="seg kind-goal" style={{ width: `${(goalsDone.length / checklist) * 100}%` }} />
              <span className="seg kind-task" style={{ width: `${(tasksDone.length / checklist) * 100}%` }} />
            </div>
            <p className="muted small progress">
              {goalsDone.length + tasksDone.length} of {checklist} done
            </p>
          </>
        )}
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

      {undo?.date === date && (
        <div className="toast" role="status">
          <span>{undo.title} done.</span>
          <button className="quiet" onClick={undoDone}>
            Undo
          </button>
        </div>
      )}

      {note?.date === date && (
        <p className="note muted small" role="status">
          {note.text}
        </p>
      )}

      {tab === 'calendar' ? (
        <>
          {unscheduled.length > 0 && earliest && (
            <section className="to-fit" aria-labelledby="to-fit">
              <h3 id="to-fit">Still to fit in</h3>
              <ul className="chips">
                {unscheduled.map((r) => (
                  <li key={r.id}>
                    {readOnly ? (
                      <span className={`chip kind-${r.kind}`}>
                        <ChipText rec={r} />
                      </span>
                    ) : (
                      <button
                        className={`chip kind-${r.kind}`}
                        aria-label={`Schedule ${r.title}`}
                        onClick={() => schedule(r)}
                      >
                        <ChipText rec={r} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!readOnly && <p className="muted small hint">Tap one to put it in the next free gap.</p>}
            </section>
          )}
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
              earliest={earliest}
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

          {goalsOpen.length + tasksOpen.length === 0 && goals.length + tasks.length > 0 && (
            <p className="muted all-done">All done{isToday ? ' for today' : ''}. Nice work.</p>
          )}

          {goals.length > 0 && (
            <ListSection id="todo-goals" title="Daily goals" left={goalsOpen.length}>
              <ul className="list">{goalsOpen.map(goalCard)}</ul>
              <Fold label="Done" count={goalsDone.length}>
                {goalsDone.map(goalCard)}
              </Fold>
            </ListSection>
          )}

          {tasks.length > 0 && (
            <ListSection id="todo-tasks" title="Tasks" left={tasksOpen.length}>
              <ul className="list">{tasksOpen.map(taskCard)}</ul>
              <Fold label="Done" count={tasksDone.length}>
                {tasksDone.map(taskCard)}
              </Fold>
            </ListSection>
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

// A To do checklist, with how many are left beside its heading.
function ListSection({ id, title, left, children }: { id: string; title: string; left: number; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="list-head">
        <h3 id={id}>{title}</h3>
        <span className="muted small">{left === 0 ? 'All done' : `${left} left`}</span>
      </div>
      {children}
    </section>
  )
}

function ChipText({ rec }: { rec: Goal | Task }) {
  return (
    <>
      <span className="dot" aria-hidden="true" />
      {rec.title}
      <span className="meta">{formatDuration(rec.minutes)}</span>
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
