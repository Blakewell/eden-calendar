import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { localStore, readLocal, supabaseStore } from './lib/store'
import { Planner } from './components/Planner'
import { SignIn } from './components/SignIn'
import { ImportLocal } from './components/ImportLocal'

function SyncedApp({ db }: { db: NonNullable<typeof supabase> }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [hasLocal, setHasLocal] = useState(() => readLocal().length > 0)
  const store = useMemo(() => supabaseStore(db), [db])

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = db.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [db])

  if (!ready) return null
  if (!session) return <SignIn db={db} />
  if (hasLocal) return <ImportLocal store={store} onDone={() => setHasLocal(false)} />

  return (
    <Planner
      store={store}
      footer={
        <>
          Synced · {session.user.email} ·{' '}
          <button className="link" onClick={() => db.auth.signOut()}>
            Sign out
          </button>
        </>
      }
    />
  )
}

export default function App() {
  if (supabase) return <SyncedApp db={supabase} />
  return <Planner store={localStore} footer="Saved on this device" />
}
