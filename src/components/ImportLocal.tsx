import { useState } from 'react'
import type { Store } from '../lib/types'
import { clearLocal, readLocal } from '../lib/store'

// Shown once after signing in when this browser still has things saved from
// local mode, so nothing gets left behind.
export function ImportLocal({ store, onDone }: { store: Store; onDone: () => void }) {
  const [recs] = useState(readLocal)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const count = recs.filter((r) => r.kind !== 'check' && r.kind !== 'settings').length

  async function move() {
    setBusy(true)
    try {
      await Promise.all(recs.map((r) => store.put(r)))
      clearLocal()
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move everything.')
      setBusy(false)
    }
  }

  function skip() {
    clearLocal()
    onDone()
  }

  return (
    <main className="page signin">
      <h1>Welcome back</h1>
      <p className="muted import-text">
        This device has {count} {count === 1 ? 'thing' : 'things'} saved from before you signed in. Move them to your
        account so they show up everywhere?
      </p>
      <div className="signin-options">
        <button className="primary" onClick={move} disabled={busy}>
          {busy ? 'Moving…' : 'Move them'}
        </button>
        <button className="link" onClick={skip} disabled={busy}>
          No thanks, start fresh
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  )
}
