export type ScheduleItem = {
  id: string
  date: string // YYYY-MM-DD
  start: string // HH:MM (24h)
  end: string | null // HH:MM, optional
  title: string
  notes: string
  done: boolean
}

export type NewItem = Omit<ScheduleItem, 'id' | 'done'>

export interface ScheduleStore {
  list(date: string): Promise<ScheduleItem[]>
  add(item: NewItem): Promise<ScheduleItem>
  update(id: string, patch: Partial<Omit<ScheduleItem, 'id'>>): Promise<void>
  remove(id: string): Promise<void>
}
