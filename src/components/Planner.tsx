import { useState, type ReactNode } from 'react'
import type { Goal, Store, Task } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { checkId, makeCheck } from '../lib/plan'
import { nowHHMM, today } from '../lib/dates'
import { useData } from '../lib/useData'
import { DayView } from './DayView'
import { Editor, type Editable } from './Editor'
import { WeekSetup } from './WeekSetup'

type EditorState = { record: Editable | null } | null

export function Planner({ store, footer }: { store: Store; footer: ReactNode }) {
  const { data, loaded, error, put, remove } = useData(store)
  const [view, setView] = useState<'day' | 'week'>('day')
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
        <button className="link" onClick={() => setView(view === 'day' ? 'week' : 'day')}>
          {view === 'day' ? 'My week' : '← Back to day'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loaded &&
        (view === 'day' ? (
          <DayView
            data={data}
            date={date}
            onDate={setDate}
            onEdit={(record) => setEditor({ record })}
            onToggleGoal={toggleGoal}
            onToggleTask={toggleTask}
          />
        ) : (
          <WeekSetup data={data} onEdit={(record) => setEditor({ record })} onSettings={put} />
        ))}

      <button className="add primary" onClick={() => setEditor({ record: null })}>
        + Add
      </button>

      <footer className="muted small">{footer}</footer>

      {editor && (
        <Editor
          key={editor.record?.id ?? 'new'}
          date={date}
          defaultStart={date === today() ? nowHHMM() : '15:00'}
          record={editor.record}
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
