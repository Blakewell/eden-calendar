import { useCallback, useEffect, useState } from 'react'
import type { Share, Sharing } from './sharing'
import { splitShares } from './sharing'

// Keeps the list of invites fresh: on open, when the app comes back into
// view, and every minute while it's open (so new invites show up).
export function useShares(sharing: Sharing, myId: string) {
  const [shares, setShares] = useState<Share[]>([])
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setShares(await sharing.list())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load invites.')
    }
  }, [sharing])

  useEffect(() => {
    // Fetching from the server is the external sync this effect exists for.
    // oxlint-disable-next-line react/set-state-in-effect
    reload()
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => document.visibilityState === 'visible' && reload(), 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [reload])

  // Runs an action, then refreshes the list; errors are shown, not thrown.
  const act = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action()
        setError('')
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.')
        return false
      } finally {
        await reload()
      }
    },
    [reload],
  )

  return {
    ...splitShares(shares, myId),
    error,
    invite: (email: string) => act(() => sharing.invite(email)),
    respond: (id: string, accept: boolean) => act(() => sharing.respond(id, accept)),
    remove: (id: string) => act(() => sharing.remove(id)),
  }
}

export type SharesState = ReturnType<typeof useShares>
