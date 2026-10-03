import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { clearLocal, localStore, readLocal, sharedStore, supabaseStore } from './store'
import { goal, task } from '../test/fixtures'

describe('localStore', () => {
  it('adds, replaces and removes records by id', async () => {
    const g = goal()
    await localStore.put(g)
    await localStore.put({ ...g, minutes: 45 })
    expect(await localStore.loadAll()).toEqual([{ ...g, minutes: 45 }])

    await localStore.remove(g.id)
    expect(await localStore.loadAll()).toEqual([])
  })

  it('survives corrupt storage', async () => {
    localStorage.setItem('eden-calendar:records', '{not json')
    expect(await localStore.loadAll()).toEqual([])
  })

  it('can be read and cleared for moving into an account', async () => {
    await localStore.put(task())
    expect(readLocal()).toHaveLength(1)
    clearLocal()
    expect(readLocal()).toEqual([])
  })
})

// A minimal stand-in for the Supabase query builder.
function fakeDb(result: { data?: unknown; error?: unknown } = {}) {
  const calls: Record<string, unknown[]> = {}
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'upsert', 'delete', 'eq']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      calls[m] = [...(calls[m] ?? []), ...args]
      return builder
    })
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: result.data ?? null, error: result.error ?? null })
  const db = { from: vi.fn(() => builder) } as unknown as SupabaseClient
  return { db, calls }
}

describe('supabaseStore', () => {
  it('turns rows back into records', async () => {
    const { db } = fakeDb({ data: [{ id: 'g1', kind: 'goal', data: { title: 'Reading', minutes: 30 } }] })
    expect(await supabaseStore(db, 'me').loadAll()).toEqual([{ id: 'g1', kind: 'goal', title: 'Reading', minutes: 30 }])
  })

  it('loads and removes only the signed-in person’s records, not days shared with them', async () => {
    const { db, calls } = fakeDb({ data: [] })
    await supabaseStore(db, 'me').loadAll()
    expect(calls.eq).toEqual(['user_id', 'me'])
    const removal = fakeDb()
    await supabaseStore(removal.db, 'me').remove('g1')
    expect(removal.calls.eq).toEqual(['user_id', 'me', 'id', 'g1'])
  })

  it('upserts id and kind as columns and the rest as data', async () => {
    const { db, calls } = fakeDb()
    const g = goal({ id: 'g1' })
    await supabaseStore(db, 'me').put(g)
    const [row, opts] = calls.upsert as [Record<string, unknown>, unknown]
    expect(row).toMatchObject({ id: 'g1', kind: 'goal' })
    expect(row.data).not.toHaveProperty('id')
    expect(row.data).toMatchObject({ title: g.title, minutes: g.minutes })
    expect(opts).toEqual({ onConflict: 'user_id,id' })
  })

  it('surfaces errors', async () => {
    const { db } = fakeDb({ error: new Error('nope') })
    await expect(supabaseStore(db, 'me').loadAll()).rejects.toThrow('nope')
    await expect(supabaseStore(db, 'me').remove('x')).rejects.toThrow('nope')
  })
})

describe('sharedStore', () => {
  it('loads the owner’s records and never writes', async () => {
    const { db, calls } = fakeDb({ data: [] })
    const store = sharedStore(db, 'owner')
    await store.loadAll()
    expect(calls.eq).toEqual(['user_id', 'owner'])
    await expect(store.put(goal())).rejects.toThrow('view only')
    await expect(store.remove('g1')).rejects.toThrow('view only')
    expect(calls.upsert).toBeUndefined()
    expect(calls.delete).toBeUndefined()
  })
})
