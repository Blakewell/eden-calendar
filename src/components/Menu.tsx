import { useEffect, useRef, useState } from 'react'
import { readTheme, saveTheme, type Theme } from '../lib/theme'
import type { Profile } from '../lib/profile'
import type { SharingUI } from './Planner'

// Calendar, To do and Plans are the tabs; Awake hours and Share my day are in the menu.
export type View = 'calendar' | 'todo' | 'plans' | 'hours' | 'share'

export type Account = Profile & { onSignOut: () => void }

const THEMES: [Theme, string][] = [
  ['auto', 'Auto'],
  ['light', 'Light'],
  ['dark', 'Dark'],
]

const SHARE_ITEM: [View, string, string][] = [['share', 'Share my day', 'Invite someone to see your day']]

const ITEMS: [View, string, string][] = [['hours', 'Awake hours', 'When you get up and go to bed']]

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
