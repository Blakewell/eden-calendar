import { useState, type FormEvent } from 'react'
import type { Share } from '../lib/sharing'
import { inviteProblem, ownerLabel } from '../lib/sharing'
import type { SharingUI } from './Planner'

const SENT_STATUS: Record<Share['status'], string> = {
  pending: 'Invite sent',
  accepted: 'Can see your day',
  declined: 'Said no thanks',
}

// Invite people to see your day, see who can, and answer invites from others.
export function SharePage({ sharing }: { sharing: SharingUI }) {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(e: FormEvent) {
    e.preventDefault()
    const problem = inviteProblem(email, sharing.myEmail, sharing.sent)
    if (problem) return setNote({ text: problem, error: true })
    setBusy(true)
    const ok = await sharing.invite(email)
    setBusy(false)
    if (ok) {
      setEmail('')
      setNote({ text: "Invite sent. They'll see it next time they open the app.", error: false })
    } else setNote(null)
  }

  const accepted = sharing.received.filter((s) => s.status === 'accepted')
  const waiting = sharing.received.filter((s) => s.status === 'pending')

  return (
    <>
      <header className="day-header">
        <h1>Share my day</h1>
        <p className="muted">People you invite can see your day. They can't change anything.</p>
      </header>

      <section>
        <form className="invite-form" onSubmit={send}>
          <label>
            <span>Their email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              required
            />
          </label>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {note && (
          <p className={note.error ? 'error' : 'muted small'} role="status">
            {note.text}
          </p>
        )}
        {sharing.error && <p className="error">{sharing.error}</p>}
      </section>

      {sharing.sent.length > 0 && (
        <section>
          <h3>Who can see your day</h3>
          <ul className="list">
            {sharing.sent.map((s) => (
              <li key={s.id} className="card person">
                <span className="card-body">
                  <span className="title">{s.inviteeEmail}</span>
                  <span className="meta">{SENT_STATUS[s.status]}</span>
                </span>
                <button className="quiet" onClick={() => sharing.remove(s.id)}>
                  {s.status === 'pending' ? 'Cancel' : 'Stop sharing'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(accepted.length > 0 || waiting.length > 0) && (
        <section>
          <h3>Shared with you</h3>
          <ul className="list">
            {waiting.map((s) => (
              <li key={s.id} className="card person">
                <span className="card-body">
                  <span className="title">{ownerLabel(s)}</span>
                  <span className="meta">Wants to share their day with you</span>
                </span>
                <button className="quiet" onClick={() => sharing.respond(s.id, true)}>
                  Accept
                </button>
              </li>
            ))}
            {accepted.map((s) => (
              <li key={s.id} className="card person">
                <span className="card-body">
                  <span className="title">{ownerLabel(s)}</span>
                  <span className="meta">{s.ownerEmail}</span>
                </span>
                <button className="quiet" onClick={() => sharing.onViewDay(s)}>
                  View
                </button>
                <button
                  className="quiet"
                  aria-label={`Remove ${ownerLabel(s)}'s day`}
                  onClick={() => sharing.remove(s.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// A calm notice for a new invite, shown at the top of your own pages until answered.
export function InviteAlerts({ sharing }: { sharing: SharingUI }) {
  const pending = sharing.received.filter((s) => s.status === 'pending')
  if (pending.length === 0) return null
  return (
    <ul className="invite-alerts" aria-label="Invites">
      {pending.map((s) => (
        <li key={s.id} className="invite-alert" role="alert">
          <p>
            <strong>{ownerLabel(s)}</strong> wants to share their day with you.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => sharing.respond(s.id, true)}>
              Accept
            </button>
            <button className="quiet" onClick={() => sharing.respond(s.id, false)}>
              No thanks
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
