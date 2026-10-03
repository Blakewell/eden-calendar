import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { NewItem, ScheduleItem } from '../lib/types'

type Props = {
  date: string
  item: ScheduleItem | null // null = adding a new item
  defaultStart: string
  onSave: (values: NewItem) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export function ItemEditor({ date, item, defaultStart, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState(item?.title ?? '')
  const [start, setStart] = useState(item?.start ?? defaultStart)
  const [end, setEnd] = useState(item?.end ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')

  // Mounted only while open; show as a modal so focus and Escape behave.
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSave({ date, title: title.trim(), start, end: end || null, notes: notes.trim() })
  }

  return (
    <dialog ref={dialog} className="editor" onClose={onClose} onCancel={onClose}>
      <form onSubmit={submit}>
        <h2>{item ? 'Edit' : 'Add to your day'}</h2>

        <label>
          <span>What</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Homework, practice, hang out…"
            autoFocus
            required
          />
        </label>

        <div className="row">
          <label>
            <span>Starts</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            <span>Ends <em>(optional)</em></span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>

        <label>
          <span>Notes <em>(optional)</em></span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <div className="actions">
          {item && (
            <button type="button" className="quiet danger" onClick={() => onDelete(item.id)}>
              Remove
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  )
}
