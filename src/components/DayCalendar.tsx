import type { MouseEvent } from 'react'
import type { Block, Slot } from '../lib/plan'
import { CHUNK, MIN_BLOCK, calendarRange, placeBlocks } from '../lib/plan'
import { formatDuration, formatTime, fromMinutes, toMinutes } from '../lib/dates'
import type { Editable } from './Editor'

// Height of one 10-minute chunk, in px. Keep in sync with --chunk in index.css.
const CHUNK_PX = 14

type Props = {
  blocks: Block[]
  free: Slot[]
  hours: [string, string]
  now: string | null // set only when viewing today
  isDone: (rec: Editable) => boolean
  onEdit: (rec: Editable) => void
  onAddAt: (start: string) => void
}

// The day as a calendar: hours down the side, each split into 10-minute
// chunks, with blocks placed at their real times and free gaps labelled.
export function DayCalendar({ blocks, free, hours, now, isDone, onEdit, onAddAt }: Props) {
  const [from, to] = calendarRange(blocks, hours)
  const y = (min: number) => ((min - from) / CHUNK) * CHUNK_PX
  const hourMarks: number[] = []
  for (let m = from; m < to; m += 60) hourMarks.push(m)

  // Tapping an empty chunk adds something starting there.
  function addHere(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const offset = e.clientY - e.currentTarget.getBoundingClientRect().top
    onAddAt(fromMinutes(from + Math.floor(offset / CHUNK_PX) * CHUNK))
  }

  const nowMin = now ? toMinutes(now) : null

  return (
    <div className="calendar">
      <ol className="hours" aria-hidden="true" style={{ height: y(to) }}>
        {hourMarks.map((m) => (
          <li key={m} style={{ top: y(m) }}>
            {formatTime(fromMinutes(m))}
          </li>
        ))}
      </ol>

      <div className="grid" style={{ height: y(to) }} onClick={addHere}>
        {free.map(
          (slot) =>
            slot.type === 'free' &&
            slot.minutes >= 30 && (
              <p
                key={slot.start}
                className="free"
                style={{ top: y(toMinutes(slot.start)), height: y(toMinutes(slot.end)) - y(toMinutes(slot.start)) }}
              >
                Free · {formatDuration(slot.minutes)}
              </p>
            ),
        )}

        <ol className="blocks">
          {placeBlocks(blocks).map(({ block, lane, lanes }) => {
            const start = toMinutes(block.start)
            const length = Math.max(toMinutes(block.end) - start, MIN_BLOCK)
            const isNow = nowMin !== null && start <= nowMin && nowMin < toMinutes(block.end)
            const short = length < 40
            return (
              <li
                key={block.rec.id}
                style={{
                  top: y(start),
                  height: (length / CHUNK) * CHUNK_PX,
                  left: `${(lane / lanes) * 100}%`,
                  width: `${100 / lanes}%`,
                }}
              >
                <button
                  className={`card kind-${block.rec.kind}${isNow ? ' now' : ''}${short ? ' short' : ''}${
                    isDone(block.rec) ? ' done' : ''
                  }`}
                  onClick={() => onEdit(block.rec)}
                >
                  <span className="title">{block.rec.title}</span>
                  <span className="time">
                    {formatTime(block.start)}
                    {block.end > block.start && ` – ${formatTime(block.end)}`}
                    {isNow && <span className="now-tag">now</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {nowMin !== null && nowMin >= from && nowMin < to && (
          <div className="now-line" style={{ top: y(nowMin) }} aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
