import { useState } from 'react'
import type { EditableKind, Goal, Store, Task } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { CHUNK, checkId, goalStartOn, goalsOn, makeCheck, moveTo, taskStartOn, tasksOn, unschedule } from '../lib/plan'
import { formatTime, nowHHMM, roundUp, today } from '../lib/dates'
import { useData } from '../lib/useData'
import { DayView } from './DayView'
import { Editor, type Editable } from './Editor'
import { WeekSetup } from './WeekSetup'
import { Goals } from './Goals'
import { Menu, type Account, type View } from './Menu'

// `start` is set when adding by tapping an empty spot on the calendar.
type EditorState = { record: Editable | null; newKind?: EditableKind; start?: string } | null

// `account` is set when signed in (synced); local mode has none.
export function Planner({ store, account }: { store: Store; account?: Account }) {
  const { data, loaded, error, put, remove } = useData(store)
  const [view, setView] = useState<View>('day')
  const [menuOpen, setMenuOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [editor, setEditor] = useState<EditorState>(null)

  function toggleGoal(goal: Goal) {
    const id = checkId(goal.id, date)
    if (data.checks.has(id)) remove(id)
    else put(makeCheck(goal.id, date))
  }

  function toggleTask(task: Task) {
    put({ ...task, doneOn: task.doneOn ? null : date })
  }

  // Goals and assignments for the day that are still waiting for a time.
  const unscheduled: (Goal | Task)[] = [
    ...goalsOn(data.goals, date).filter((g) => !goalStartOn(g, date) && !data.checks.has(checkId(g.id, date))),
    ...tasksOn(data.tasks, date, today()).filter((t) => !t.doneOn && !taskStartOn(t, date)),
  ]

  // Editing something that's on the calendar for this day only: offer to take it back off.
  const rec = editor?.record
  const scheduledToday =
    (rec?.kind === 'goal' && rec.moved[date] !== undefined) || (rec?.kind === 'task' && rec.at?.date === date)
  const unscheduleLabel =
    rec?.kind === 'goal' && rec.start
      ? `Back to its usual time (${formatTime(rec.start)})`
      : 'Take it off the calendar for this day'

  return (
    <main className="page">
      <div className="topbar">
        <span className="legend">
          {(['routine', 'goal', 'task', 'fun'] as const).map((k) => (
            <span key={k} className={`legend-item kind-${k}`}>
              <span className="dot" /> {KIND_LABEL[k]}
            </span>
          ))}
        </span>
        <button className="quiet round menu-button" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loaded &&
        (view === 'goals' ? (
          <Goals
            data={data}
            onEdit={(record) => setEditor({ record })}
            onAdd={() => setEditor({ record: null, newKind: 'goal' })}
          />
        ) : view === 'day' ? (
          <DayView
            data={data}
            date={date}
            name={account?.firstName ?? null}
            onDate={setDate}
            onEdit={(record) => setEditor({ record })}
            onAddAt={(start) => setEditor({ record: null, start })}
            onMove={(rec, start) => put(moveTo(rec, date, start, today()))}
            onToggleGoal={toggleGoal}
            onToggleTask={toggleTask}
          />
        ) : (
          <WeekSetup data={data} onEdit={(record) => setEditor({ record })} onSettings={put} />
        ))}

      {view === 'goals' ? (
        <button className="add primary kind-goal" onClick={() => setEditor({ record: null, newKind: 'goal' })}>
          + Add goal
        </button>
      ) : (
        <button className="add primary" onClick={() => setEditor({ record: null })}>
          + Add
        </button>
      )}

      {menuOpen && <Menu view={view} account={account} onView={setView} onClose={() => setMenuOpen(false)} />}

      {editor && (
        <Editor
          key={editor.record?.id ?? 'new'}
          date={date}
          defaultStart={editor.start ?? (date === today() ? roundUp(nowHHMM(), CHUNK) : '15:00')}
          record={editor.record}
          newKind={editor.newKind}
          candidates={editor.start && !editor.record ? unscheduled : []}
          onPlace={(c) => {
            setEditor(null)
            put(moveTo(c, date, editor.start!, today()))
          }}
          unscheduleLabel={unscheduleLabel}
          onUnschedule={
            scheduledToday && (rec?.kind === 'goal' || rec?.kind === 'task')
              ? () => {
                  setEditor(null)
                  put(unschedule(rec, date, today()))
                }
              : undefined
          }
          onSave={(rec) => {
            setEditor(null)
            put(rec)
          }}
          onDelete={(id) => {
            setEditor(null)
            remove(id)
          }}
          onClose={() => setEditor(null)}
        />
      )}
    </main>
  )
}
