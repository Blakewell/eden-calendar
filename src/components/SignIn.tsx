import { useState, type FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

const redirectTo = () => window.location.origin + window.location.pathname

export function SignIn({ db }: { db: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function google() {
    setError('')
    const { error } = await db.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
    if (error) setError(error.message)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
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
        <div className="signin-options">
          <button type="button" className="quiet google" onClick={google}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
              />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="divider muted small">or get a link by email</p>

          <form onSubmit={submit}>
            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit" className="primary">
              Send me a link
            </button>
          </form>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </main>
  )
}
