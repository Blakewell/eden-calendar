import type { ReactNode } from 'react'
import type { Data } from '../lib/plan'
import { funAhead, goalStatus, openTasks, recentlyDone, routinesAhead } from '../lib/plan'
import type { EditableKind, Goal } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { addDays, dueLabel, formatDays, formatDuration, formatTime, fromISODate, today } from '../lib/dates'
import type { Editable } from './Editor'

type Props = {
  data: Data
  readOnly?: boolean // someone else's plans, shared with you
  onEdit: (rec: Editable) => void
  onAdd: (kind: EditableKind) => void
}

// Everything that repeats or is coming up, one section per kind in the
// legend's order. Tap anything to change it.
export function Plans({ data, readOnly = false, onEdit, onAdd }: Props) {
  const todayStr = today()
  const day = (s: string) =>
    s === todayStr
      ? 'Today'
      : s === addDays(todayStr, 1)
        ? 'Tomorrow'
        : fromISODate(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const goals = (status: ReturnType<typeof goalStatus>) => data.goals.filter((g) => goalStatus(g, todayStr) === status)
  const card = (rec: Editable, meta: ReactNode, done = false) => (
    <li key={rec.id}>
      <button
        className={`card kind-${rec.kind}${done ? ' done' : ''}`}
        aria-disabled={readOnly || undefined}
        onClick={() => !readOnly && onEdit(rec)}
      >
        <span className="title">{rec.title}</span>
        <span className="meta">{meta}</span>
      </button>
    </li>
  )
  const goalCard = (g: Goal, done = false) =>
    card(
      g,
      <>
        {formatDuration(g.minutes)} · {g.start ? formatTime(g.start) : 'Anytime'} · {formatDays(g.days)}
        {g.from && g.from > todayStr && ` · from ${day(g.from)}`}
        {g.until && ` · until ${day(g.until)}`}
      </>,
      done,
    )

  const weekly = data.routines.filter((r) => !r.date)
  const once = routinesAhead(data.routines, todayStr)
  const tasks = openTasks(data.tasks, todayStr)
  const done = recentlyDone(data.tasks, todayStr)
  const fun = funAhead(data.fun, todayStr)

  return (
    <>
      <header className="day-header">
        <h1>Plans</h1>
        <p className="muted">
          {readOnly
            ? 'What repeats and what’s coming up.'
            : 'What repeats and what’s coming up. Tap anything to change it.'}
        </p>
      </header>

      <Section kind="routine" readOnly={readOnly} onAdd={onAdd}>
        {weekly.length + once.length === 0 && <Empty>Nothing yet. Add school, practice and other set times.</Empty>}
        <ul className="list">
          {weekly.map((r) => card(r, `${formatTime(r.start)} – ${formatTime(r.end)} · ${formatDays(r.days)}`))}
        </ul>
        {once.length > 0 && (
          <>
            <h4 className="plans-sub">Just once, coming up</h4>
            <ul className="list">
              {once.map((r) => card(r, `${day(r.date!)} · ${formatTime(r.start)} – ${formatTime(r.end)}`))}
            </ul>
          </>
        )}
      </Section>

      <Section kind="goal" readOnly={readOnly} onAdd={onAdd}>
        {data.goals.length === 0 && <Empty>Nothing yet. Add things like reading or practice.</Empty>}
        <ul className="list">{goals('active').map((g) => goalCard(g))}</ul>
        <Fold label="Starting later" count={goals('upcoming').length}>
          {goals('upcoming').map((g) => goalCard(g))}
        </Fold>
        <Fold label="Finished" count={goals('ended').length}>
          {goals('ended').map((g) => goalCard(g, true))}
        </Fold>
      </Section>

      <Section kind="task" readOnly={readOnly} onAdd={onAdd}>
        {tasks.length === 0 && <Empty>Nothing open. Add homework, chores and other things to get done.</Empty>}
        <ul className="list">
          {tasks.map((t) =>
            card(
              t,
              <>
                {formatDuration(t.minutes)} · {t.date < todayStr ? `from ${day(t.date)}` : day(t.date)}
                {t.due && <span className={t.due < todayStr ? 'overdue' : ''}> · {dueLabel(t.due, todayStr)}</span>}
              </>,
            ),
          )}
        </ul>
        <Fold label="Done lately" count={done.length}>
          {done.map((t) =>
            card(t, `${formatDuration(t.minutes)} · done ${t.doneOn === todayStr ? 'today' : day(t.doneOn!)}`, true),
          )}
        </Fold>
      </Section>

      <Section kind="fun" readOnly={readOnly} onAdd={onAdd}>
        {fun.length === 0 && <Empty>Nothing in the next two weeks.</Empty>}
        <ul className="list">
          {fun.map((f) =>
            card(
              f,
              `${day(f.date)} · ${f.start ? `${formatTime(f.start)}${f.end ? ` – ${formatTime(f.end)}` : ''}` : 'sometime'}`,
            ),
          )}
        </ul>
      </Section>
    </>
  )
}

const PLURAL: Record<EditableKind, string> = { routine: 'Routines', goal: 'Daily goals', task: 'Tasks', fun: 'Fun' }

function Section({
  kind,
  readOnly,
  onAdd,
  children,
}: {
  kind: EditableKind
  readOnly: boolean
  onAdd: (kind: EditableKind) => void
  children: ReactNode
}) {
  const id = `plans-${kind}`
  return (
    <section className={`plans-section kind-${kind}`} aria-labelledby={id}>
      <div className="plans-head">
        <h3 id={id}>
          <span className="dot" aria-hidden="true" /> {PLURAL[kind]}
        </h3>
        {!readOnly && (
          <button
            className="quiet small"
            aria-label={`Add ${KIND_LABEL[kind].toLowerCase()}`}
            onClick={() => onAdd(kind)}
          >
            + Add
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

// Less-used groups, folded away until tapped.
export function Fold({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  if (count === 0) return null
  return (
    <details className="fold">
      <summary className="muted small">
        {label} ({count})
      </summary>
      <ul className="list">{children}</ul>
    </details>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <p className="muted small">{children}</p>
