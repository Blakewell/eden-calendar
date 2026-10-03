import { ownerLabel } from '../lib/sharing'
import type { SharingUI } from './Planner'

// Whose day is on screen: always yours to begin with, or (view only) a day
// someone shared with you. A plain label until someone has shared theirs.
export function PersonSwitcher({ sharing }: { sharing?: SharingUI }) {
  const shared = sharing?.received.filter((s) => s.status === 'accepted') ?? []
  const viewing = sharing?.viewing ?? null
  if (!sharing || shared.length === 0) return <span className="whose">Your day</span>

  return (
    <span className="whose">
      <span className="switcher">
        <select
          aria-label="Whose day"
          value={viewing?.id ?? ''}
          onChange={(e) => sharing.onViewDay(shared.find((s) => s.id === e.target.value) ?? null)}
        >
          <option value="">Your day</option>
          {shared.map((s) => (
            <option key={s.id} value={s.id}>
              {ownerLabel(s)}'s day
            </option>
          ))}
        </select>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {viewing && <span className="view-only">view only</span>}
    </span>
  )
}
