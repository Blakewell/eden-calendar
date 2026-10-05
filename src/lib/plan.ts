import type { Check, Fun, Goal, Rec, Routine, Settings, Task } from './types'
import { DEFAULT_SETTINGS } from './types'
import { addDays, fromMinutes, toMinutes, weekday } from './dates'

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
    else if (r.kind === 'task') data.tasks.push({ ...r, at: r.at ?? null })
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

// Tasks show on the day they're planned for. Unfinished ones from
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

// A goal's start on a given day: where it was put that day, else its usual time
// (null for an anytime goal that isn't scheduled that day).
export function goalStartOn(goal: Goal, date: string): string | null {
  return goal.moved[date] ?? goal.start
}

// A task's start on a given day, if it's been scheduled for that day.
export function taskStartOn(task: Task, date: string): string | null {
  return task.at?.date === date ? task.at.start : null
}

// Anything with a set time on the day's calendar.
export type Block = { rec: Routine | Fun | Goal | Task; start: string; end: string }

export type Slot = { type: 'block'; block: Block } | { type: 'free'; start: string; end: string; minutes: number }

export function blocksOn(data: Data, date: string, today: string): Block[] {
  const blocks: Block[] = routinesOn(data.routines, date).map((r) => ({ rec: r, start: r.start, end: r.end }))
  for (const f of funOn(data.fun, date)) {
    if (f.start) blocks.push({ rec: f, start: f.start, end: f.end && f.end > f.start ? f.end : f.start })
  }
  for (const g of goalsOn(data.goals, date)) {
    const start = goalStartOn(g, date)
    if (start) blocks.push({ rec: g, start, end: endAfter(start, g.minutes) })
  }
  for (const t of tasksOn(data.tasks, date, today)) {
    const start = taskStartOn(t, date)
    if (start) blocks.push({ rec: t, start, end: endAfter(start, t.minutes) })
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start))
}

// The calendar splits each hour into 10-minute chunks.
export const CHUNK = 10
// Lengths, times and drags move in 5-minute steps, so things like a
// 15-minute goal fit. The calendar still draws 10-minute chunks.
export const STEP = 5
const DAY = 24 * 60
const endAfter = (start: string, minutes: number) => fromMinutes(Math.min(toMinutes(start) + minutes, DAY))

// The first free gap (between blocks, within awake hours, from `after` on)
// with room for `minutes`, starting on a 5-minute mark. Null if none.
export function findSlot(blocks: Block[], hours: [string, string], minutes: number, after: string): string | null {
  const earliest = Math.ceil(Math.max(toMinutes(after), toMinutes(hours[0])) / STEP) * STEP
  for (const slot of timeline(blocks, hours).slots) {
    if (slot.type !== 'free') continue
    const start = Math.max(Math.ceil(toMinutes(slot.start) / STEP) * STEP, earliest)
    if (start + minutes <= toMinutes(slot.end)) return fromMinutes(start)
  }
  return null
}
// The earliest a goal or task that isn't done yet can be scheduled on `date`:
// from now on (to the next 5 minutes) today, any time on a later day, and
// not at all on a day that's gone. Planning work into time that has already
// passed would only be pretend. Null means it can't be scheduled.
export function earliestStart(date: string, today: string, now: string): string | null {
  if (date < today) return null
  if (date > today) return '00:00'
  return fromMinutes(Math.min(Math.ceil(toMinutes(now) / STEP) * STEP, DAY))
}

// Goals and tasks that aren't done can only go from `earliestStart` on.
export const keepsToFuture = (rec: Block['rec'], done: boolean) => (rec.kind === 'goal' || rec.kind === 'task') && !done

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

// Things on the calendar that can be moved; routines are fixed.
export type Movable = Goal | Fun | Task
export const isMovable = (rec: Block['rec']): rec is Movable => rec.kind !== 'routine'

// The record after putting it at `start` on `date` (by dragging or scheduling).
// Fun keeps its length. A goal or task goes there for that day only.
// Past days' goal moves are dropped as they no longer matter, and putting a
// goal back at its usual time clears the exception.
export function moveTo<T extends Movable>(rec: T, date: string, start: string, today: string): T {
  if (rec.kind === 'fun') {
    if (!rec.start) return rec
    const end = rec.end && fromMinutes(toMinutes(rec.end) + toMinutes(start) - toMinutes(rec.start))
    return { ...rec, start, end }
  }
  if (rec.kind === 'task') return { ...rec, at: { date, start } }
  const moved = pruneMoves(rec.moved, date, today)
  if (start !== rec.start) moved[date] = start
  return { ...rec, moved }
}

// Takes a goal or task off the calendar for `date`: an anytime goal or
// task goes back to the checklist; a timed goal goes back to its usual time.
export function unschedule<T extends Goal | Task>(rec: T, date: string, today: string): T {
  if (rec.kind === 'task') return { ...rec, at: null }
  return { ...rec, moved: pruneMoves(rec.moved, date, today) }
}

const pruneMoves = (moved: Record<string, string>, date: string, today: string) =>
  Object.fromEntries(Object.entries(moved).filter(([d]) => d >= today && d !== date))

export function isWeekend(date: string): boolean {
  const wd = weekday(date)
  return wd === 0 || wd === 6
}

// No bedtime set (or one at/after midnight) means midnight, the end of the day.
export const MIDNIGHT = '24:00'

export function awakeHours(settings: Settings, date: string): [string, string] {
  const [start, end] = isWeekend(date)
    ? [settings.weekendStart, settings.weekendEnd]
    : [settings.dayStart, settings.dayEnd]
  return [start, end && toMinutes(end) > toMinutes(start) ? end : MIDNIGHT]
}

// Minutes from `now` until bedtime on `date` (0 once it's past).
export function untilBedtime(settings: Settings, date: string, now: string): number {
  return Math.max(0, toMinutes(awakeHours(settings, date)[1]) - toMinutes(now))
}

// Timed blocks for the day, with the free gaps between them (within waking
// hours) so it's easy to see where goals and tasks can fit.
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
    if (minutes >= STEP) slots.push({ type: 'free', start: fromMinutes(cursor), end: fromMinutes(stop), minutes })
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

// Free minutes from `from` (now, on today) until bedtime. Time that has
// already gone isn't free any more.
export function freeFrom(blocks: Block[], hours: [string, string], from: string): number {
  const start = toMinutes(from) > toMinutes(hours[0]) ? from : hours[0]
  return timeline(blocks, [start, hours[1]]).freeMinutes
}

// Where a goal stands relative to today, for the Plans page.
export type GoalStatus = 'active' | 'upcoming' | 'ended'

export function goalStatus(goal: Goal, today: string): GoalStatus {
  if (goal.until && goal.until < today) return 'ended'
  if (goal.from && goal.from > today) return 'upcoming'
  return 'active'
}

// How many goals and tasks are still to check off on a day (the To do tab's count).
export function todoLeft(data: Data, date: string, today: string): number {
  const goals = goalsOn(data.goals, date).filter((g) => !data.checks.has(checkId(g.id, date)))
  const tasks = tasksOn(data.tasks, date, today).filter((t) => !t.doneOn)
  return goals.length + tasks.length
}

// Goals and tasks on a day that aren't done and have no time on the calendar
// yet: what's still to fit in. Goals first, then tasks (soonest due first).
export function toFitIn(data: Data, date: string, today: string): (Goal | Task)[] {
  return [
    ...goalsOn(data.goals, date).filter((g) => !goalStartOn(g, date) && !data.checks.has(checkId(g.id, date))),
    ...tasksOn(data.tasks, date, today).filter((t) => !t.doneOn && !taskStartOn(t, date)),
  ]
}

// The Plans tab: everything that repeats or is coming up.

// One-off routines from today on, soonest first.
export function routinesAhead(routines: Routine[], today: string): Routine[] {
  return routines
    .filter((r) => r.date && r.date >= today)
    .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
}

// Open tasks on any day: overdue first, then by the day they're planned for.
export function openTasks(tasks: Task[], today: string): Task[] {
  const key = (t: Task) => `${t.due && t.due < today ? 0 : 1}${t.date}${t.due ?? '~'}`
  return tasks.filter((t) => !t.doneOn).sort((a, b) => key(a).localeCompare(key(b)))
}

// How far ahead Plans looks for fun, and back for finished tasks.
export const PLANS_DAYS = 14

// Tasks finished in the last two weeks, most recent first.
export function recentlyDone(tasks: Task[], today: string): Task[] {
  const since = addDays(today, -PLANS_DAYS)
  return tasks.filter((t) => t.doneOn && t.doneOn >= since).sort((a, b) => b.doneOn!.localeCompare(a.doneOn!))
}

// Fun from today through the next two weeks, soonest first.
export function funAhead(fun: Fun[], today: string): Fun[] {
  const last = addDays(today, PLANS_DAYS - 1)
  return fun
    .filter((f) => f.date >= today && f.date <= last)
    .sort((a, b) => `${a.date}${a.start ?? '~'}`.localeCompare(`${b.date}${b.start ?? '~'}`))
}
