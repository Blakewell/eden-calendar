// A fixed block at set times: repeats on chosen weekdays, or happens once on `date`.
export type Routine = {
  kind: 'routine'
  id: string
  title: string
  start: string // HH:MM
  end: string // HH:MM
  days: number[] // 0 = Sunday … 6 = Saturday; used when date is null
  date: string | null // YYYY-MM-DD for a one-off block
}

// Something to spend a set amount of time on, on chosen days, optionally
// only between two dates (e.g. a summer reading goal). With a start time it
// takes a slot on the day's calendar; without one it's "anytime".
export type Goal = {
  kind: 'goal'
  id: string
  title: string
  minutes: number
  start: string | null // HH:MM; older goals saved before this field have none
  // date -> HH:MM: where it goes that day instead (dragged, or an anytime goal scheduled for that day)
  moved: Record<string, string>
  days: number[]
  from: string | null
  until: string | null
}

// Flexible work (homework, chores…) planned for a day, with an estimated
// time. If it isn't finished, it carries over to today.
export type Task = {
  kind: 'task'
  id: string
  title: string
  minutes: number
  date: string // the day she plans to work on it
  due: string | null
  doneOn: string | null
  at: { date: string; start: string } | null // scheduled on the calendar for one day
}

// Something optional and fun on a given day; a time is optional.
export type Fun = {
  kind: 'fun'
  id: string
  title: string
  date: string
  start: string | null
  end: string | null
}

// A goal checked off on a given day.
export type Check = {
  kind: 'check'
  id: string // `${goalId}@${date}`
  goal: string
  date: string
}

export type Settings = {
  kind: 'settings'
  id: 'settings'
  // Awake hours, used to count free time. Weekends get their own.
  dayStart: string // HH:MM
  dayEnd: string
  weekendStart: string
  weekendEnd: string
}

export type Rec = Routine | Goal | Task | Fun | Check | Settings
export type Kind = Rec['kind']
export type EditableKind = 'routine' | 'goal' | 'task' | 'fun'

export interface Store {
  loadAll(): Promise<Rec[]>
  put(rec: Rec): Promise<void>
  remove(id: string): Promise<void>
}

export const DEFAULT_SETTINGS: Settings = {
  kind: 'settings',
  id: 'settings',
  dayStart: '06:30',
  dayEnd: '21:30',
  weekendStart: '09:00',
  weekendEnd: '22:30',
}

export const KIND_LABEL: Record<EditableKind, string> = {
  routine: 'Routine',
  goal: 'Daily goal',
  task: 'Task',
  fun: 'Fun',
}
