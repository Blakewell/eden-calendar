import type { Fun, Goal, Routine, Task } from '../lib/types'

// Saturday, October 3 2026 (weekday 6). Monday the 5th is weekday 1.
export const SAT = '2026-10-03'
export const SUN = '2026-10-04'
export const MON = '2026-10-05'
export const FRI = '2026-10-02'

export const routine = (over: Partial<Routine> = {}): Routine => ({
  kind: 'routine',
  id: 'r-' + Math.random().toString(36).slice(2),
  title: 'School',
  start: '07:45',
  end: '15:00',
  days: [1, 2, 3, 4, 5],
  date: null,
  ...over,
})

export const goal = (over: Partial<Goal> = {}): Goal => ({
  kind: 'goal',
  id: 'g-' + Math.random().toString(36).slice(2),
  title: 'Reading',
  minutes: 30,
  start: null,
  moved: {},
  days: [0, 1, 2, 3, 4, 5, 6],
  from: null,
  until: null,
  ...over,
})

export const task = (over: Partial<Task> = {}): Task => ({
  kind: 'task',
  id: 't-' + Math.random().toString(36).slice(2),
  title: 'Math worksheet',
  minutes: 30,
  date: SAT,
  due: null,
  doneOn: null,
  ...over,
})

export const fun = (over: Partial<Fun> = {}): Fun => ({
  kind: 'fun',
  id: 'f-' + Math.random().toString(36).slice(2),
  title: "Friend's house",
  date: SAT,
  start: null,
  end: null,
  ...over,
})
