import type { View } from './Menu'

const TABS = [
  { view: 'calendar', label: 'Calendar', icon: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4' },
  { view: 'todo', label: 'To do', icon: 'M5 12l4 4 10-10' },
  { view: 'plans', label: 'Plans', icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
] as const

// The three main places, along the bottom of the screen. Awake hours and Share
// my day live in the menu, so no tab is current on those pages.
export function TabBar({ view, todo, onView }: { view: View; todo: number; onView: (view: View) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.view} aria-current={view === t.view ? 'page' : undefined} onClick={() => onView(t.view)}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d={t.icon}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {t.label}
            {t.view === 'todo' && todo > 0 && (
              <span className="count" aria-label={`, ${todo} left`}>
                {todo}
              </span>
            )}
          </span>
        </button>
      ))}
    </nav>
  )
}
