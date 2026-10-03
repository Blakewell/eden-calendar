import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Rec, Store } from './types'
import { split } from './plan'

// Loads every record once, applies edits optimistically, and re-syncs when
// the tab comes back into view (to pick up changes from other devices).
export function useData(store: Store) {
  const [recs, setRecs] = useState<Rec[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setRecs(await store.loadAll())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your schedule.')
    } finally {
      setLoaded(true)
    }
  }, [store])

  useEffect(() => {
    reload()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const attempt = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
        reload()
      }
    },
    [reload],
  )

  const put = useCallback(
    (rec: Rec) => {
      setRecs((prev) => [...prev.filter((r) => r.id !== rec.id), rec])
      attempt(() => store.put(rec))
    },
    [store, attempt],
  )

  const remove = useCallback(
    (id: string) => {
      // Removing a goal also clears its check-offs.
      const doomed = new Set([id])
      setRecs((prev) => {
        for (const r of prev) if (r.kind === 'check' && r.goal === id) doomed.add(r.id)
        return prev.filter((r) => !doomed.has(r.id))
      })
      attempt(async () => {
        for (const d of doomed) await store.remove(d)
      })
    },
    [store, attempt],
  )

  const data = useMemo(() => split(recs), [recs])
  return { data, loaded, error, put, remove }
}
