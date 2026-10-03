export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = fromISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function today(): string {
  return toISODate(new Date())
}

export function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDay(s: string): { weekday: string; date: string } {
  const d = fromISODate(s)
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    date: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
  }
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function weekday(s: string): number {
  return fromISODate(s).getDay()
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAYS_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatDays(days: number[]): string {
  const set = [...days].sort()
  if (set.length === 7) return 'Every day'
  if (set.join() === '1,2,3,4,5') return 'Weekdays'
  if (set.join() === '0,6') return 'Weekends'
  return set.map((d) => WEEKDAYS_NAME[d]).join(', ')
}

export function dueLabel(due: string, viewing: string): string {
  if (due < viewing) return 'overdue'
  if (due === viewing) return 'due today'
  if (due === addDays(viewing, 1)) return 'due tomorrow'
  const d = fromISODate(due)
  const days = (d.getTime() - fromISODate(viewing).getTime()) / 86_400_000
  return days < 7
    ? `due ${d.toLocaleDateString(undefined, { weekday: 'short' })}`
    : `due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}
