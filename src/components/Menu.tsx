import { useEffect, useRef, useState } from 'react'
import { readTheme, saveTheme, type Theme } from '../lib/theme'
import type { Profile } from '../lib/profile'
import { ownerLabel } from '../lib/sharing'
import type { SharingUI } from './Planner'

export type View = 'day' | 'goals' | 'week' | 'share'

export type Account = Profile & { onSignOut: () => void }

const THEMES: [Theme, string][] = [
  ['auto', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

const SHARE_ITEM: [View, string, string][] = [['share', 'Share my day', 'Invite someone to see your day']]

const ITEMS: [View, string, string][] = [
  ['day', 'Today', 'Your day at a glance'],
  ['goals', 'Daily goals', 'Add, change or remove goals'],
  ['week', 'My week', 'Routines and awake hours'],
]

type Props = {
  view: View
  account?: Account
  sharing?: SharingUI
  onView: (view: View) => void
  onClose: () => void
}

// A small sheet for getting around and signing out. Mounted only while open.
export function Menu({ view, account, sharing, onView, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="menu"
      aria-label="Menu"
      onClose={onClose}
      // Tapping the dimmed backdrop closes it.
      onClick={(e) => e.target === dialog.current && onClose()}
    >
      <nav aria-label="Pages">
        <ul className="menu-items">
          {sharing?.viewing && (
            <li>
              <button
                className="menu-item"
                onClick={() => {
                  sharing.onViewDay(null)
                  onClose()
                }}
              >
                <span>Back to my day</span>
                <span className="muted small">You're viewing {ownerLabel(sharing.viewing)}'s day</span>
              </button>
            </li>
          )}
          {[...ITEMS, ...(sharing && !sharing.viewing ? SHARE_ITEM : [])].map(([v, label, hint]) => (
            <li key={v}>
              <button
                className="menu-item"
                aria-current={v === view ? 'page' : undefined}
                onClick={() => {
                  onView(v)
                  onClose()
                }}
              >
                <span>{label}</span>
                <span className="muted small">{hint}</span>
              </button>
            </li>
          ))}
        </ul>
        {sharing && sharing.received.some((s) => s.status === 'accepted') && (
          <>
            <p className="menu-label muted small">Shared with you</p>
            <ul className="menu-items">
              {sharing.received
                .filter((s) => s.status === 'accepted')
                .map((s) => (
                  <li key={s.id}>
                    <button
                      className="menu-item"
                      aria-current={sharing.viewing?.id === s.id ? 'page' : undefined}
                      onClick={() => {
                        sharing.onViewDay(s)
                        onView('day')
                        onClose()
                      }}
                    >
                      <span>{ownerLabel(s)}'s day</span>
                      <span className="muted small">View only</span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </nav>

      <div className="menu-theme">
        <span className="muted small" id="appearance">
          Appearance
        </span>
        <div className="segmented" role="radiogroup" aria-labelledby="appearance">
          {THEMES.map(([t, label]) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              className={theme === t ? 'on' : ''}
              onClick={() => {
                saveTheme(t)
                setTheme(t)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="menu-account">
        {account ? (
          <>
            <div className="who">
              <Avatar account={account} />
              <span>
                {account.name && <span className="who-name">{account.name}</span>}
                <span className="muted small">Signed in as {account.email}</span>
              </span>
            </div>
            <button className="quiet" onClick={account.onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <p className="muted small">Saved on this device</p>
        )}
      </div>
    </dialog>
  )
}

// Their Google photo, or their initial if there isn't one (or it won't load).
function Avatar({ account }: { account: Account }) {
  const [broken, setBroken] = useState(false)
  const initial = (account.name ?? account.email ?? '?').charAt(0).toUpperCase()
  if (!account.avatarUrl || broken)
    return (
      <span className="avatar" aria-hidden="true">
        {initial}
      </span>
    )
  return (
    <img
      className="avatar"
      src={account.avatarUrl}
      alt=""
      // Google's photo links refuse requests that send a referrer.
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}
