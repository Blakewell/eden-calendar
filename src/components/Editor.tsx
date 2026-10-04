import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { EditableKind, Fun, Goal, Routine, Task } from '../lib/types'
import { KIND_LABEL } from '../lib/types'
import { formatDuration, formatTime, weekday } from '../lib/dates'
import { STEP } from '../lib/plan'
import { DayPicker } from './DayPicker'
import { Stepper } from './Stepper'

export type Editable = Routine | Goal | Task | Fun

type Props = {
  date: string // the day being viewed; default for new one-off blocks
  defaultStart: string
  record: Editable | null // null = adding something new
  newKind?: EditableKind // when adding, skip the "what kind" step
  // Adding at a tapped time: the day's unscheduled goals and assignments to put there instead.
  candidates?: (Goal | Task)[]
  onPlace?: (rec: Goal | Task) => void
  // Set when this goal or assignment is on the calendar for `date` only; takes it back off.
  unscheduleLabel?: string
  onUnschedule?: () => void
  onSave: (rec: Editable) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const PLACEHOLDER: Record<EditableKind, string> = {
  routine: 'School, band practice…',
  goal: 'Reading, piano…',
  task: 'Math worksheet, essay…',
  fun: "Friend's house, movie night…",
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

const HINT: Record<EditableKind, string> = {
  routine: 'Set times, like school or band',
  goal: 'Time to spend every day, like reading',
  task: 'Flexible work, like an assignment',
  fun: "Optional plans, like a friend's house",
}

export function Editor({
  date,
  defaultStart,
  record,
  newKind,
  candidates = [],
  onPlace,
  unscheduleLabel,
  onUnschedule,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [kind, setKind] = useState<EditableKind | null>(record?.kind ?? newKind ?? null)

  const r = record
  const [title, setTitle] = useState(r?.title ?? '')
  const [minutes, setMinutes] = useState(
    r && (r.kind === 'goal' || r.kind === 'task') ? r.minutes : newKind === 'task' ? 40 : 30,
  )
  const [days, setDays] = useState<number[]>(
    r && (r.kind === 'routine' || r.kind === 'goal') ? r.days : newKind === 'goal' ? EVERY_DAY : [weekday(date)],
  )
  const [once, setOnce] = useState(r?.kind === 'routine' ? r.date !== null : false)
  const [onceDate, setOnceDate] = useState(r && (r.kind === 'routine' || r.kind === 'fun') && r.date ? r.date : date)
  // Fun and goals can have a time or not; new goals start with one so they land on the calendar.
  const [timed, setTimed] = useState(r?.kind === 'fun' || r?.kind === 'goal' ? r.start !== null : newKind !== 'fun')
  const [start, setStart] = useState(r && r.kind !== 'task' && r.start ? r.start : defaultStart)
  const [end, setEnd] = useState(r && (r.kind === 'routine' || r.kind === 'fun') && r.end ? r.end : '')
  const [due, setDue] = useState(r?.kind === 'task' ? (r.due ?? '') : '')
  const [workOn, setWorkOn] = useState(r?.kind === 'task' ? r.date : date)
  const [from, setFrom] = useState(r?.kind === 'goal' ? (r.from ?? '') : '')
  const [until, setUntil] = useState(r?.kind === 'goal' ? (r.until ?? '') : '')

  // Mounted only while open; show as a modal so focus and Escape behave.
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  function choose(k: EditableKind) {
    setKind(k)
    if (k === 'goal') setDays(EVERY_DAY)
    if (k === 'task') setMinutes(40)
    if (k === 'goal') setMinutes(30)
    setTimed(k !== 'fun')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!kind || !title.trim()) return
    const id = record?.id ?? crypto.randomUUID()
    const t = title.trim()
    if (kind === 'routine') {
      if (!once && days.length === 0) return
      onSave({ kind, id, title: t, start, end: end > start ? end : start, days, date: once ? onceDate : null })
    } else if (kind === 'goal') {
      if (days.length === 0) return
      const newStart = timed ? start : null
      // Changing the usual time resets any days it was dragged elsewhere.
      const keepMoves = record?.kind === 'goal' && record.start === newStart
      onSave({
        kind,
        id,
        title: t,
        minutes,
        start: newStart,
        moved: keepMoves ? record.moved : {},
        days,
        from: from || null,
        until: until && (!from || until >= from) ? until : null,
      })
    } else if (kind === 'fun') {
      onSave({
        kind,
        id,
        title: t,
        date: onceDate,
        start: timed ? start : null,
        end: timed && end > start ? end : null,
      })
    } else {
      onSave({
        kind,
        id,
        title: t,
        minutes,
        date: workOn,
        due: due || null,
        doneOn: record?.kind === 'task' ? record.doneOn : null,
        // Keep its spot on the calendar unless it's now planned for another day.
        at: record?.kind === 'task' && record.at?.date === workOn ? record.at : null,
      })
    }
  }

  return (
    <dialog ref={dialog} className={`editor${kind ? ` kind-${kind}` : ''}`} onClose={onClose}>
      {!kind ? (
        <div>
          {candidates.length > 0 && onPlace && (
            <>
              <h2>Fit something in at {formatTime(defaultStart)}</h2>
              <div className="kind-choices">
                {candidates.map((c) => (
                  <button key={c.id} type="button" className={`kind-choice kind-${c.kind}`} onClick={() => onPlace(c)}>
                    <span className="dot" />
                    <span>
                      <strong>{c.title}</strong>
                      <span className="muted small">
                        {KIND_LABEL[c.kind]} · {formatDuration(c.minutes)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <h2>{candidates.length > 0 && onPlace ? 'Or add something new' : 'Add to your week'}</h2>
          <div className="kind-choices">
            {(['routine', 'goal', 'task', 'fun'] as const).map((k) => (
              <button key={k} type="button" className={`kind-choice kind-${k}`} onClick={() => choose(k)}>
                <span className="dot" />
                <span>
                  <strong>{KIND_LABEL[k]}</strong>
                  <span className="muted small">{HINT[k]}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="actions">
            <span className="spacer" />
            <button type="button" className="quiet" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="kind-label">
            <span className="dot" /> {KIND_LABEL[kind]}
          </p>
          <h2>{record ? 'Edit' : 'New'}</h2>

          <label>
            <span>What</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={PLACEHOLDER[kind]}
              autoFocus
              required
            />
          </label>

          {kind === 'routine' && (
            <>
              <div className="row">
                <label>
                  <span>Starts</span>
                  <input
                    type="time"
                    step={STEP * 60}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Ends</span>
                  <input type="time" step={STEP * 60} value={end} onChange={(e) => setEnd(e.target.value)} required />
                </label>
              </div>
              <div className="field">
                <div className="segmented">
                  <button type="button" className={!once ? 'on' : ''} onClick={() => setOnce(false)}>
                    Repeats
                  </button>
                  <button type="button" className={once ? 'on' : ''} onClick={() => setOnce(true)}>
                    Just once
                  </button>
                </div>
                {once ? (
                  <input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} required />
                ) : (
                  <DayPicker days={days} onChange={setDays} />
                )}
              </div>
            </>
          )}

          {kind === 'fun' && (
            <>
              <label>
                <span>Day</span>
                <input type="date" value={onceDate} onChange={(e) => setOnceDate(e.target.value)} required />
              </label>
              <div className="field">
                <div className="segmented">
                  <button type="button" className={!timed ? 'on' : ''} onClick={() => setTimed(false)}>
                    Sometime
                  </button>
                  <button type="button" className={timed ? 'on' : ''} onClick={() => setTimed(true)}>
                    At a time
                  </button>
                </div>
                {timed && (
                  <div className="row">
                    <label>
                      <span>From</span>
                      <input
                        type="time"
                        step={STEP * 60}
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>
                        Until <em>(optional)</em>
                      </span>
                      <input type="time" step={STEP * 60} value={end} onChange={(e) => setEnd(e.target.value)} />
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {(kind === 'goal' || kind === 'task') && (
            <div className="field">
              <span className="field-label">{kind === 'goal' ? 'How long' : 'About how long'}</span>
              <Stepper minutes={minutes} step={STEP} onChange={setMinutes} />
            </div>
          )}

          {kind === 'goal' && (
            <div className="field">
              <span className="field-label">When</span>
              <div className="segmented">
                <button type="button" className={!timed ? 'on' : ''} onClick={() => setTimed(false)}>
                  Anytime
                </button>
                <button type="button" className={timed ? 'on' : ''} onClick={() => setTimed(true)}>
                  At a time
                </button>
              </div>
              {timed && (
                <label>
                  <span>Starts</span>
                  <input
                    type="time"
                    step={STEP * 60}
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>
              )}
            </div>
          )}

          {kind === 'goal' && (
            <div className="field">
              <span className="field-label">On these days</span>
              <DayPicker days={days} onChange={setDays} />
            </div>
          )}

          {kind === 'goal' && (
            <div className="row">
              <label>
                <span>
                  Starting <em>(optional)</em>
                </span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                <span>
                  Ending <em>(optional)</em>
                </span>
                <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
              </label>
            </div>
          )}

          {kind === 'task' && (
            <div className="row">
              <label>
                <span>Work on it</span>
                <input type="date" value={workOn} onChange={(e) => setWorkOn(e.target.value)} required />
              </label>
              <label>
                <span>
                  Due <em>(optional)</em>
                </span>
                <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
            </div>
          )}

          {onUnschedule && (
            <button type="button" className="link unschedule" onClick={onUnschedule}>
              {unscheduleLabel}
            </button>
          )}

          <div className="actions">
            {record && (
              <button type="button" className="quiet danger" onClick={() => onDelete(record.id)}>
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
      )}
    </dialog>
  )
}
