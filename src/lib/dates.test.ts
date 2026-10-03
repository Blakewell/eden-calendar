import { describe, expect, it } from 'vitest'
import {
  addDays,
  dueLabel,
  formatDays,
  formatDuration,
  fromMinutes,
  roundUp,
  toISODate,
  toMinutes,
  weekday,
} from './dates'
import { FRI, MON, SAT, SUN } from '../test/fixtures'

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('adds days across a daylight-saving change without skipping', () => {
    // US DST ends Nov 1 2026.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
  })

  it('rounds a time up to the next 10 minutes, staying within the day', () => {
    expect(roundUp('13:12', 10)).toBe('13:20')
    expect(roundUp('13:20', 10)).toBe('13:20')
    expect(roundUp('23:55', 10)).toBe('23:50')
  })

  it('formats local dates as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('knows the weekday', () => {
    expect(weekday(SAT)).toBe(6)
    expect(weekday(SUN)).toBe(0)
    expect(weekday(MON)).toBe(1)
  })

  it('converts between HH:MM and minutes', () => {
    expect(toMinutes('07:45')).toBe(465)
    expect(fromMinutes(465)).toBe('07:45')
    expect(fromMinutes(toMinutes('23:05'))).toBe('23:05')
  })

  it('formats durations simply', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(95)).toBe('1h 35m')
  })

  it('names common day sets', () => {
    expect(formatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day')
    expect(formatDays([5, 1, 2, 3, 4])).toBe('Weekdays')
    expect(formatDays([6, 0])).toBe('Weekends')
    expect(formatDays([2, 4])).toBe('Tue, Thu')
  })

  it('labels due dates relative to the day being viewed', () => {
    expect(dueLabel(FRI, SAT)).toBe('overdue')
    expect(dueLabel(SAT, SAT)).toBe('due today')
    expect(dueLabel(SUN, SAT)).toBe('due tomorrow')
    expect(dueLabel(MON, SAT)).toMatch(/^due Mon/)
    expect(dueLabel('2026-10-20', SAT)).toMatch(/^due Oct 20/)
  })
})
