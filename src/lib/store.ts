import type { SupabaseClient } from '@supabase/supabase-js'
import type { Rec, Store } from './types'

// ---------- Local (this browser only) ----------

const KEY = 'eden-calendar:records'

export function readLocal(): Rec[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeAll(recs: Rec[]) {
  localStorage.setItem(KEY, JSON.stringify(recs))
}

export function clearLocal() {
  localStorage.removeItem(KEY)
}

export const localStore: Store = {
  async loadAll() {
    return readLocal()
  },
  async put(rec) {
    writeAll([...readLocal().filter((r) => r.id !== rec.id), rec])
  },
  async remove(id) {
    writeAll(readLocal().filter((r) => r.id !== id))
  },
}

// ---------- Supabase (synced) ----------
// One `records` table: (user_id, id) key, a `kind`, and the rest as JSON.
// Row-level security also lets people read days shared with them, so always
// load one person's records: your own, or (read-only) someone who shared theirs.

type Row = { id: string; kind: Rec['kind']; data: Record<string, unknown> }

export function supabaseStore(db: SupabaseClient, userId: string): Store {
  const table = () => db.from('records')
  return {
    async loadAll() {
      const { data, error } = await table().select('id, kind, data').eq('user_id', userId)
      if (error) throw error
      return (data as Row[]).map((r) => ({ ...r.data, id: r.id, kind: r.kind }) as Rec)
    },
    async put(rec) {
      const { id, kind, ...data } = rec
      const { error } = await table().upsert(
        { id, kind, data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,id' },
      )
      if (error) throw error
    },
    async remove(id) {
      const { error } = await table().delete().eq('user_id', userId).eq('id', id)
      if (error) throw error
    },
  }
}

// Someone else's day, shared with you: view only.
export function sharedStore(db: SupabaseClient, ownerId: string): Store {
  const viewOnly = async () => {
    throw new Error('This day is shared with you to view only.')
  }
  return { loadAll: supabaseStore(db, ownerId).loadAll, put: viewOnly, remove: viewOnly }
}
