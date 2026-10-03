import type { Check, Fun, Goal, Rec, Routine, Settings, Task } from './types'
import { DEFAULT_SETTINGS } from './types'
import { fromMinutes, toMinutes, weekday } from './dates'

export type Data = {
  routines: Routine[]
  goals: Goal[]
  tasks: Task[]
  fun: Fun[]
  checks: Set<string>
  settings: Settings
}

export function split(recs: Rec[]): Data {
  const data: Data = { routines: [], goals: [], tasks: [], fun: [], checks: new Set(), settings: DEFAULT_SETTINGS }
  for (const r of recs) {
    if (r.kind === 'routine') data.routines.push(r)
    else if (r.kind === 'goal') data.goals.push({ ...r, start: r.start ?? null, moved: r.moved ?? {} })
    else if (r.kind === 'task') data.tasks.push(r)
    else if (r.kind === 'fun') data.fun.push(r)
    else if (r.kind === 'check') data.checks.add(r.id)
    else if (r.kind === 'settings') data.settings = { ...DEFAULT_SETTINGS, ...r }
  }
  data.routines.sort((a, b) => a.start.localeCompare(b.start))
  data.goals.sort((a, b) => a.title.localeCompare(b.title))
  return data
}

export const checkId = (goalId: string, date: string) => `${goalId}@${date}`

export function makeCheck(goal: string, date: string): Check {
  return { kind: 'check', id: checkId(goal, date), goal, date }
}

export function routinesOn(routines: Routine[], date: string): Routine[] {
  const wd = weekday(date)
  return routines.filter((r) => (r.date ? r.date === date : r.days.includes(wd)))
}

export function goalsOn(goals: Goal[], date: string): Goal[] {
  const wd = weekday(date)
  return goals.filter((g) => g.days.includes(wd) && (!g.from || g.from <= date) && (!g.until || date <= g.until))
}

export function funOn(fun: Fun[], date: string): Fun[] {
  return fun.filter((f) => f.date === date)
}

// Assignments show on the day they're planned for. Unfinished ones from
// earlier days carry over to today; finished ones show on the day they were done.
export function tasksOn(tasks: Task[], date: string, today: string): Task[] {
  return tasks
    .filter((t) => {
      if (t.doneOn) return t.doneOn === date
      return t.date === date || (date === today && t.date < today)
    })
    .sort((a, b) => {
      if (!!a.doneOn !== !!b.doneOn) return a.doneOn ? 1 : -1
      return (a.due ?? '9999').localeCompare(b.due ?? '9999')
    })
}

// A timed goal's start on a given day: where it was dragged that day, or its usual time.
export function goalStartOn(goal: Goal, date: string): string | null {
  return goal.start ? (goal.moved[date] ?? goal.start) : null
}

// Anything with a set time on the day's calendar.
export type Block = { rec: Routine | Fun | Goal; start: string; end: string }

export type Slot = { type: 'block'; block: Block } | { type: 'free'; start: string; end: string; minutes: number }

export function blocksOn(data: Data, date: string): Block[] {
  const blocks: Block[] = routinesOn(data.routines, date).map((r) => ({ rec: r, start: r.start, end: r.end }))
  for (const f of funOn(data.fun, date)) {
    if (f.start) blocks.push({ rec: f, start: f.start, end: f.end && f.end > f.start ? f.end : f.start })
  }
  for (const g of goalsOn(data.goals, date)) {
    const start = goalStartOn(g, date)
    if (start) blocks.push({ rec: g, start, end: fromMinutes(Math.min(toMinutes(start) + g.minutes, DAY)) })
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start))
}

// The calendar splits each hour into 10-minute chunks.
export const CHUNK = 10
const DAY = 24 * 60
// Short or open-ended blocks still get enough room to tap and read.
export const MIN_BLOCK = 2 * CHUNK

export type Placed = { block: Block; lane: number; lanes: number }

// Side-by-side lanes for blocks that overlap, so nothing hides behind
// something else. Each group of overlapping blocks shares its lane count.
export function placeBlocks(blocks: Block[]): Placed[] {
  const span = (b: Block) => {
    const s = toMinutes(b.start)
    return [s, Math.max(toMinutes(b.end), s + MIN_BLOCK)]
  }
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))
  const placed: Placed[] = []
  let group: Placed[] = []
  let laneEnds: number[] = []
  let groupEnd = -1

  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length
    group = []
    laneEnds = []
  }

  for (const block of sorted) {
    const [s, e] = span(block)
    if (s >= groupEnd) closeGroup()
    let lane = laneEnds.findIndex((end) => end <= s)
    if (lane < 0) lane = laneEnds.push(e) - 1
    else laneEnds[lane] = e
    const p = { block, lane, lanes: 1 }
    group.push(p)
    placed.push(p)
    groupEnd = Math.max(groupEnd, e)
  }
  closeGroup()
  return placed
}

// Whole hours (in minutes) the calendar covers: awake hours, stretched to
// fit anything earlier or later.
export function calendarRange(blocks: Block[], hours: [string, string]): [number, number] {
  let from = toMinutes(hours[0])
  let to = toMinutes(hours[1])
  for (const b of blocks) {
    from = Math.min(from, toMinutes(b.start))
    to = Math.max(to, toMinutes(b.end), toMinutes(b.start) + MIN_BLOCK)
  }
  return [Math.floor(from / 60) * 60, Math.min(DAY, Math.ceil(to / 60) * 60)]
}

// Things on the calendar that can be dragged; routines are fixed.
export const isMovable = (rec: Block['rec']): rec is Goal | Fun => rec.kind !== 'routine'

// The record after dragging it to `start` on `date`. Fun keeps its length.
// A goal moves for that day only; past days' moves are dropped as they no
// longer matter, and moving it back to its usual time clears the exception.
export function moveTo(rec: Goal | Fun, date: string, start: string, today: string): Goal | Fun {
  if (rec.kind === 'fun') {
    if (!rec.start) return rec
    const end = rec.end && fromMinutes(toMinutes(rec.end) + toMinutes(start) - toMinutes(rec.start))
    return { ...rec, start, end }
  }
  const moved = Object.fromEntries(Object.entries(rec.moved).filter(([d]) => d >= today && d !== date))
  if (start !== rec.start) moved[date] = start
  return { ...rec, moved }
}

export function isWeekend(date: string): boolean {
  const wd = weekday(date)
  return wd === 0 || wd === 6
}

export function awakeHours(settings: Settings, date: string): [string, string] {
  return isWeekend(date) ? [settings.weekendStart, settings.weekendEnd] : [settings.dayStart, settings.dayEnd]
}

// Timed blocks for the day, with the free gaps between them (within waking
// hours) so it's easy to see where goals and assignments can fit.
export function timeline(blocks: Block[], hours: [string, string]): { slots: Slot[]; freeMinutes: number } {
  const dayStart = toMinutes(hours[0])
  const dayEnd = toMinutes(hours[1])
  const slots: Slot[] = []
  let cursor = dayStart
  let freeMinutes = 0

  const addFree = (until: number) => {
    const stop = Math.min(until, dayEnd)
    const minutes = stop - cursor
    if (minutes <= 0) return
    freeMinutes += minutes
    if (minutes >= CHUNK) slots.push({ type: 'free', start: fromMinutes(cursor), end: fromMinutes(stop), minutes })
  }

  for (const block of blocks) {
    const s = toMinutes(block.start)
    if (s > cursor) addFree(s)
    slots.push({ type: 'block', block })
    cursor = Math.max(cursor, toMinutes(block.end))
  }
  addFree(dayEnd)

  return { slots, freeMinutes }
}

// Where a goal stands relative to today, for the Goals page.
export type GoalStatus = 'active' | 'upcoming' | 'ended'

export function goalStatus(goal: Goal, today: string): GoalStatus {
  if (goal.until && goal.until < today) return 'ended'
  if (goal.from && goal.from > today) return 'upcoming'
  return 'active'
}
