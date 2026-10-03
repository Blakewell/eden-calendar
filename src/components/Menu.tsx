import { useEffect, useRef } from 'react'

export type View = 'day' | 'goals' | 'week'

export type Account = { email: string | undefined; onSignOut: () => void }

const ITEMS: [View, string, string][] = [
  ['day', 'Today', 'Your day at a glance'],
  ['goals', 'Daily goals', 'Add, change or remove goals'],
  ['week', 'My week', 'Routines and awake hours'],
]

type Props = {
  view: View
  account?: Account
  onView: (view: View) => void
  onClose: () => void
}

// A small sheet for getting around and signing out. Mounted only while open.
export function Menu({ view, account, onView, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)

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
          {ITEMS.map(([v, label, hint]) => (
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

      <div className="menu-account">
        {account ? (
          <>
            <p className="muted small">Signed in as {account.email}</p>
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
