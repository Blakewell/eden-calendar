import { useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { localStore, readLocal, supabaseStore } from './lib/store'
import { Planner } from './components/Planner'
import { SignIn } from './components/SignIn'
import { ImportLocal } from './components/ImportLocal'
import { profileFrom } from './lib/profile'
import { supabaseSharing, type Share } from './lib/sharing'
import { useShares } from './lib/useShares'
import type { Store } from './lib/types'

function SyncedApp({ db }: { db: NonNullable<typeof supabase> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [hasLocal, setHasLocal] = useState(() => readLocal().length > 0)
  const userId = session?.user.id
  const store = useMemo(() => (userId ? supabaseStore(db, userId) : null), [db, userId])

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [db])

  if (!ready) return null
  if (!session || !store) return <SignIn db={db} />
  if (hasLocal) return <ImportLocal store={store} onDone={() => setHasLocal(false)} />

  return <SignedIn db={db} session={session} store={store} />
}

// Your own day, or (view only) someone else's that they shared with you.
function SignedIn({ db, session, store }: { db: SupabaseClient; session: Session; store: Store }) {
  const sharing = useMemo(() => supabaseSharing(db), [db])
  const shares = useShares(sharing, session.user.id)
  const [viewingId, setViewingId] = useState<string | null>(null)
  // If they stop sharing while it's on screen, this falls back to your own day.
  const viewing = shares.received.find((s) => s.id === viewingId && s.status === 'accepted') ?? null
  const ownerId = viewing?.ownerId
  const shownStore = useMemo(() => (ownerId ? sharing.storeFor(ownerId) : store), [ownerId, sharing, store])

  return (
    <Planner
      // A fresh planner per day shown, so one person's data never flashes up as another's.
      key={viewing?.id ?? 'mine'}
      store={shownStore}
      account={{ ...profileFrom(session.user), onSignOut: () => db.auth.signOut() }}
      sharing={{
        ...shares,
        myEmail: session.user.email,
        viewing,
        onViewDay: (s: Share | null) => setViewingId(s?.id ?? null),
      }}
    />
  )
}

export default function App() {
  if (supabase) return <SyncedApp db={supabase} />
  return <Planner store={localStore} />
}
