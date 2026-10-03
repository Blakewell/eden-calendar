import { describe, expect, it } from 'vitest'
import { awakeHours, blocksOn, checkId, goalsOn, makeCheck, routinesOn, split, tasksOn, timeline } from './plan'
import { DEFAULT_SETTINGS, type Settings } from './types'
import { FRI, MON, SAT, SUN, fun, goal, routine, task } from '../test/fixtures'

describe('routinesOn', () => {
  it('shows repeating routines only on their weekdays', () => {
    const school = routine({ days: [1, 2, 3, 4, 5] })
    const band = routine({ title: 'Band', days: [2, 4] })
    expect(routinesOn([school, band], MON)).toEqual([school])
    expect(routinesOn([school, band], SAT)).toEqual([])
  })

  it('shows one-off routines only on their date, ignoring weekdays', () => {
    const dentist = routine({ title: 'Dentist', date: MON, days: [] })
    expect(routinesOn([dentist], MON)).toEqual([dentist])
    expect(routinesOn([dentist], addWeek(MON))).toEqual([])
  })
})

describe('goalsOn', () => {
  it('respects chosen days', () => {
    const clarinet = goal({ days: [1, 2, 3, 4, 5] })
    expect(goalsOn([clarinet], MON)).toEqual([clarinet])
    expect(goalsOn([clarinet], SAT)).toEqual([])
  })

  it('respects an optional start and end date (inclusive)', () => {
    const summer = goal({ from: SAT, until: MON })
    expect(goalsOn([summer], FRI)).toEqual([])
    expect(goalsOn([summer], SAT)).toEqual([summer])
    expect(goalsOn([summer], MON)).toEqual([summer])
    expect(goalsOn([summer], addWeek(MON))).toEqual([])
  })

  it('treats a missing start or end as open-ended', () => {
    expect(goalsOn([goal({ until: MON })], FRI)).toHaveLength(1)
    expect(goalsOn([goal({ from: SAT })], addWeek(MON))).toHaveLength(1)
  })
})

describe('tasksOn (assignments)', () => {
  const today = SAT

  it('shows an assignment on the day it is planned for', () => {
    const t = task({ date: MON })
    expect(tasksOn([t], MON, today)).toEqual([t])
    expect(tasksOn([t], SUN, today)).toEqual([])
  })

  it('carries unfinished past assignments over to today only', () => {
    const late = task({ date: FRI })
    expect(tasksOn([late], today, today)).toEqual([late])
    expect(tasksOn([late], MON, today)).toEqual([])
  })

  it('shows finished assignments only on the day they were finished', () => {
    const done = task({ date: FRI, doneOn: SAT })
    expect(tasksOn([done], SAT, today)).toEqual([done])
    expect(tasksOn([done], FRI, today)).toEqual([])
  })

  it('lists open work first, soonest due first', () => {
    const a = task({ title: 'no due' })
    const b = task({ title: 'due mon', due: MON })
    const c = task({ title: 'due sun', due: SUN })
    const d = task({ title: 'done', doneOn: SAT })
    expect(tasksOn([a, b, c, d], SAT, today).map((t) => t.title)).toEqual(['due sun', 'due mon', 'no due', 'done'])
  })
})

describe('awakeHours', () => {
  const s: Settings = {
    ...DEFAULT_SETTINGS,
    dayStart: '06:30',
    dayEnd: '21:30',
    weekendStart: '09:00',
    weekendEnd: '23:00',
  }
  it('uses weekend hours on Saturday and Sunday', () => {
    expect(awakeHours(s, SAT)).toEqual(['09:00', '23:00'])
    expect(awakeHours(s, SUN)).toEqual(['09:00', '23:00'])
    expect(awakeHours(s, MON)).toEqual(['06:30', '21:30'])
  })
})

describe('timeline', () => {
  it('finds the free gaps between blocks within awake hours', () => {
    const school = routine({ start: '08:00', end: '15:00' })
    const band = routine({ title: 'Band', start: '15:30', end: '17:00' })
    const blocks = [school, band].map((r) => ({ rec: r, start: r.start, end: r.end }))
    const { slots, freeMinutes } = timeline(blocks, ['07:00', '21:00'])

    expect(slots.map((s) => (s.type === 'free' ? `free ${s.start}-${s.end}` : s.block.rec.title))).toEqual([
      'free 07:00-08:00',
      'School',
      'free 15:00-15:30',
      'Band',
      'free 17:00-21:00',
    ])
    expect(freeMinutes).toBe(60 + 30 + 240)
  })

  it('handles overlapping blocks without double counting', () => {
    const a = routine({ start: '09:00', end: '12:00' })
    const b = routine({ start: '11:00', end: '13:00' })
    const blocks = [a, b].map((r) => ({ rec: r, start: r.start, end: r.end }))
    expect(timeline(blocks, ['09:00', '14:00']).freeMinutes).toBe(60)
  })

  it('ignores time outside awake hours and hides tiny gaps', () => {
    const early = routine({ start: '05:00', end: '07:10' })
    const late = routine({ start: '20:00', end: '23:00' })
    const blocks = [early, late].map((r) => ({ rec: r, start: r.start, end: r.end }))
    const { slots, freeMinutes } = timeline(blocks, ['07:00', '21:00'])
    expect(freeMinutes).toBe(12 * 60 + 50)
    expect(slots.filter((s) => s.type === 'free')).toHaveLength(1)
  })

  it('treats a day with no blocks as all free', () => {
    expect(timeline([], ['09:00', '22:30']).freeMinutes).toBe(13 * 60 + 30)
  })
})

describe('blocksOn', () => {
  it('puts timed fun on the timeline but not untimed fun', () => {
    const data = split([
      routine({ title: 'Soccer', days: [6], start: '10:00', end: '11:30' }),
      fun({ title: "Maya's", start: '14:00', end: '17:00' }),
      fun({ title: 'Movie?' }),
    ])
    expect(blocksOn(data, SAT).map((b) => b.rec.title)).toEqual(['Soccer', "Maya's"])
  })

  it('gives a fun block with no end time zero length', () => {
    const data = split([fun({ start: '14:00', end: null })])
    expect(blocksOn(data, SAT)[0]).toMatchObject({ start: '14:00', end: '14:00' })
  })
})

describe('split', () => {
  it('sorts records by kind and fills missing settings with defaults', () => {
    const g = goal()
    const data = split([
      g,
      makeCheck(g.id, SAT),
      { kind: 'settings', id: 'settings', dayStart: '07:00', dayEnd: '21:00' } as unknown as Settings,
    ])
    expect(data.goals).toEqual([g])
    expect(data.checks.has(checkId(g.id, SAT))).toBe(true)
    expect(data.settings.dayStart).toBe('07:00')
    expect(data.settings.weekendStart).toBe(DEFAULT_SETTINGS.weekendStart)
  })
})

function addWeek(date: string) {
  const d = new Date(`${date}T12:00`)
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}
