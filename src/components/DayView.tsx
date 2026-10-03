import { useCallback, useEffect, useState } from 'react'
import type { NewItem, ScheduleItem, ScheduleStore } from '../lib/types'
import { addDays, formatDay, formatTime, greeting, nowHHMM, today } from '../lib/dates'
import { ItemEditor } from './ItemEditor'

type Props = {
  store: ScheduleStore
  footer: React.ReactNode
}

// The item happening right now: started already, and either hasn't ended or
// (with no end time) is the latest one that has started.
function currentId(items: ScheduleItem[], now: string): string | null {
  let current: ScheduleItem | null = null
  for (const i of items) {
    if (i.start <= now && (!i.end || i.end > now)) current = i
  }
  return current?.id ?? null
}

export function DayView({ store, footer }: Props) {
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<ScheduleItem | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [now, setNow] = useState(nowHHMM)

  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 30_000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    try {
      setItems(await store.list(date))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your day.')
    } finally {
      setLoadedDate(date)
    }
  }, [store, date])

  useEffect(() => {
    load()
  }, [load])

  // Pick up changes made on another device when the tab comes back into view.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onFocus)
    return () => document.removeEventListener('visibilitychange', onFocus)
  }, [load])

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
    await load()
  }

  function openNew() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(item: ScheduleItem) {
    setEditing(item)
    setEditorOpen(true)
  }

  function save(values: NewItem) {
    setEditorOpen(false)
    run(() => (editing ? store.update(editing.id, values) : store.add(values)))
  }

  function remove(id: string) {
    setEditorOpen(false)
    run(() => store.remove(id))
  }

  function toggle(item: ScheduleItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
    run(() => store.update(item.id, { done: !item.done }))
  }

  const loading = loadedDate !== date
  const isToday = date === today()
  const { weekday, date: dateLabel } = formatDay(date)
  const doneCount = items.filter((i) => i.done).length
  const nowId = isToday ? currentId(items, now) : null

  return (
    <main className="page">
      <header className="day-header">
        {isToday && <p className="greeting">{greeting()}, Eden</p>}
        <h1>{weekday}</h1>
        <p className="muted">{dateLabel}</p>

        <nav className="day-nav" aria-label="Change day">
          <button className="quiet" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ←
          </button>
          <button className="quiet" onClick={() => setDate(today())} disabled={isToday}>
            Today
          </button>
          <button className="quiet" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
            →
          </button>
        </nav>
      </header>

      {error && <p className="error">{error}</p>}

      {!loading && items.length > 0 && (
        <p className="progress muted">
          {doneCount === items.length ? 'All done. Nice work.' : `${doneCount} of ${items.length} done`}
        </p>
      )}

      {!loading && items.length === 0 && (
        <p className="empty muted">A clear day. Add something when you're ready.</p>
      )}

      <ol className="timeline">
        {items.map((item) => (
          <li
            key={item.id}
            className={`item${item.done ? ' done' : ''}${item.id === nowId ? ' now' : ''}`}
          >
            <button
              className="check"
              role="checkbox"
              aria-checked={item.done}
              aria-label={`Mark ${item.title} ${item.done ? 'not done' : 'done'}`}
              onClick={() => toggle(item)}
            />
            <button className="item-body" onClick={() => openEdit(item)}>
              <span className="time">
                {formatTime(item.start)}
                {item.end && ` – ${formatTime(item.end)}`}
                {item.id === nowId && <span className="now-tag">now</span>}
              </span>
              <span className="title">{item.title}</span>
              {item.notes && <span className="notes">{item.notes}</span>}
            </button>
          </li>
        ))}
      </ol>

      <button className="add primary" onClick={openNew}>
        + Add
      </button>

      <footer className="muted small">{footer}</footer>

      {editorOpen && (
        <ItemEditor
          key={editing?.id ?? 'new'}
          date={date}
          item={editing}
          defaultStart={isToday ? nowHHMM() : '09:00'}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </main>
  )
}
