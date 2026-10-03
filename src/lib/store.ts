import type { SupabaseClient } from '@supabase/supabase-js'
import type { NewItem, ScheduleItem, ScheduleStore } from './types'

const byStart = (a: ScheduleItem, b: ScheduleItem) => a.start.localeCompare(b.start)

// ---------- Local (this browser only) ----------

const KEY = 'eden-calendar:items'

function readAll(): ScheduleItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeAll(items: ScheduleItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export const localStore: ScheduleStore = {
  async list(date) {
    return readAll().filter((i) => i.date === date).sort(byStart)
  },
  async add(item) {
    const created: ScheduleItem = { ...item, id: crypto.randomUUID(), done: false }
    writeAll([...readAll(), created])
    return created
  },
  async update(id, patch) {
    writeAll(readAll().map((i) => (i.id === id ? { ...i, ...patch } : i)))
  },
  async remove(id) {
    writeAll(readAll().filter((i) => i.id !== id))
  },
}

// ---------- Supabase (synced) ----------

type Row = {
  id: string
  date: string
  start_time: string // HH:MM:SS
  end_time: string | null
  title: string
  notes: string
  done: boolean
}

const fromRow = (r: Row): ScheduleItem => ({
  id: r.id,
  date: r.date,
  start: r.start_time.slice(0, 5),
  end: r.end_time ? r.end_time.slice(0, 5) : null,
  title: r.title,
  notes: r.notes,
  done: r.done,
})

function toRow(p: Partial<NewItem & { done: boolean }>): Partial<Row> {
  const row: Partial<Row> = {}
  if (p.date !== undefined) row.date = p.date
  if (p.start !== undefined) row.start_time = p.start
  if (p.end !== undefined) row.end_time = p.end
  if (p.title !== undefined) row.title = p.title
  if (p.notes !== undefined) row.notes = p.notes
  if (p.done !== undefined) row.done = p.done
  return row
}

export function supabaseStore(db: SupabaseClient): ScheduleStore {
  const table = () => db.from('schedule_items')
  return {
    async list(date) {
      const { data, error } = await table().select('*').eq('date', date).order('start_time')
      if (error) throw error
      return (data as Row[]).map(fromRow)
    },
    async add(item) {
      const { data, error } = await table().insert(toRow(item)).select().single()
      if (error) throw error
      return fromRow(data as Row)
    },
    async update(id, patch) {
      const { error } = await table().update(toRow(patch)).eq('id', id)
      if (error) throw error
    },
    async remove(id) {
      const { error } = await table().delete().eq('id', id)
      if (error) throw error
    },
  }
}
