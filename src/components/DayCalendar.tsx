import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { Block, Slot } from '../lib/plan'
import { CHUNK, MIN_BLOCK, calendarRange, isMovable, placeBlocks } from '../lib/plan'
import type { Fun, Goal } from '../lib/types'
import { formatDuration, formatTime, fromMinutes, toMinutes } from '../lib/dates'
import type { Editable } from './Editor'

// Height of one 10-minute chunk, in px. Keep in sync with --chunk in index.css.
const CHUNK_PX = 14
// On a touch screen, hold this long before dragging so normal scrolling still works.
const HOLD_MS = 300
// Movement (px) that turns a mouse press into a drag, or cancels a touch hold (it's a scroll).
const SLOP = 6
const DAY = 24 * 60

type Gesture = {
  rec: Goal | Fun
  target: HTMLElement
  pointerId: number
  touch: boolean
  startY: number
  start: number // minutes
  length: number
  active: boolean
  shift: number // minutes moved so far, in whole chunks
  timer?: number
}

type Props = {
  blocks: Block[]
  free: Slot[]
  hours: [string, string]
  now: string | null // set only when viewing today
  isDone: (rec: Editable) => boolean
  onEdit: (rec: Editable) => void
  onAddAt: (start: string) => void
  onMove: (rec: Goal | Fun, start: string) => void
}

// The day as a calendar: hours down the side, each split into 10-minute
// chunks, with blocks placed at their real times and free gaps labelled.
export function DayCalendar({ blocks, free, hours, now, isDone, onEdit, onAddAt, onMove }: Props) {
  const grid = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const lastDragEnd = useRef(-Infinity)
  const [drag, setDrag] = useState<{ id: string; shift: number } | null>(null)

  // While dragging on a touch screen, stop the page from scrolling. The
  // listener has to be non-passive and in place before the touch starts.
  useEffect(() => {
    const el = grid.current
    if (!el) return
    const hold = (e: TouchEvent) => gesture.current?.active && e.preventDefault()
    el.addEventListener('touchmove', hold, { passive: false })
    return () => el.removeEventListener('touchmove', hold)
  }, [])

  function activate(g: Gesture) {
    g.active = true
    g.target.setPointerCapture?.(g.pointerId)
    setDrag({ id: g.rec.id, shift: 0 })
    navigator.vibrate?.(10)
  }

  function startGesture(e: PointerEvent<HTMLButtonElement>, block: Block) {
    if (!isMovable(block.rec) || e.button !== 0) return
    const start = toMinutes(block.start)
    const g: Gesture = {
      rec: block.rec,
      target: e.currentTarget,
      pointerId: e.pointerId,
      touch: e.pointerType === 'touch',
      startY: e.clientY,
      start,
      length: Math.max(toMinutes(block.end) - start, CHUNK),
      active: false,
      shift: 0,
    }
    gesture.current = g
    if (g.touch) g.timer = window.setTimeout(() => activate(g), HOLD_MS)
  }

  function moveGesture(e: PointerEvent) {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    const dy = e.clientY - g.startY
    if (!g.active) {
      if (Math.abs(dy) <= SLOP) return
      if (g.touch) endGesture(e, false)
      else activate(g)
      return
    }
    // Snap to whole chunks and stay within the day.
    const shift = Math.min(Math.max(Math.round(dy / CHUNK_PX) * CHUNK, -g.start), DAY - g.length - g.start)
    if (shift !== g.shift) {
      g.shift = shift
      setDrag({ id: g.rec.id, shift })
    }
  }

  function endGesture(e: PointerEvent, drop: boolean) {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    clearTimeout(g.timer)
    gesture.current = null
    if (!g.active) return
    lastDragEnd.current = performance.now()
    setDrag(null)
    if (drop && g.shift) onMove(g.rec, fromMinutes(g.start + g.shift))
  }

  // A drag ends with a click on the block; that shouldn't open the editor.
  function tap(rec: Editable) {
    if (performance.now() - lastDragEnd.current > 400) onEdit(rec)
  }

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

      <div ref={grid} className="grid" style={{ height: y(to) }} onClick={addHere}>
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
            const dragging = drag?.id === block.rec.id
            const start = toMinutes(block.start) + (dragging ? drag.shift : 0)
            const shownStart = fromMinutes(start)
            const shownEnd = fromMinutes(toMinutes(block.end) + (dragging ? drag.shift : 0))
            const movable = isMovable(block.rec)
            const length = Math.max(toMinutes(shownEnd) - start, MIN_BLOCK)
            const isNow = !dragging && nowMin !== null && start <= nowMin && nowMin < toMinutes(shownEnd)
            const short = length < 40
            return (
              <li
                key={block.rec.id}
                className={dragging ? 'dragging' : undefined}
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
                  }${movable ? ' movable' : ''}`}
                  onClick={() => tap(block.rec)}
                  onPointerDown={(e) => startGesture(e, block)}
                  onPointerMove={moveGesture}
                  onPointerUp={(e) => endGesture(e, true)}
                  onPointerCancel={(e) => endGesture(e, false)}
                  onContextMenu={(e) => movable && e.preventDefault()}
                >
                  <span className="title">{block.rec.title}</span>
                  <span className="time">
                    {formatTime(shownStart)}
                    {shownEnd > shownStart && ` – ${formatTime(shownEnd)}`}
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
