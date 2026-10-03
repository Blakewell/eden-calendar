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
    else if (r.kind === 'goal') data.goals.push(r)
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

// Anything with a set time on the day's timeline.
export type Block = { rec: Routine | Fun; start: string; end: string }

export type Slot = { type: 'block'; block: Block } | { type: 'free'; start: string; end: string; minutes: number }

export function blocksOn(data: Data, date: string): Block[] {
  const blocks: Block[] = routinesOn(data.routines, date).map((r) => ({ rec: r, start: r.start, end: r.end }))
  for (const f of funOn(data.fun, date)) {
    if (f.start) blocks.push({ rec: f, start: f.start, end: f.end && f.end > f.start ? f.end : f.start })
  }
  return blocks.sort((a, b) => a.start.localeCompare(b.start))
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
    if (minutes >= 15) slots.push({ type: 'free', start: fromMinutes(cursor), end: fromMinutes(stop), minutes })
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
