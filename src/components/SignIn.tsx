import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function SignIn({ db }: { db: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <main className="page signin">
      <h1>Eden's Day</h1>
      {sent ? (
        <p className="muted">Check your email for a sign-in link. You can close this tab.</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <button type="submit" className="primary">
            Send me a link
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </main>
  )
}
