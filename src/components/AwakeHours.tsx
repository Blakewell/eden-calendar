import type { Settings } from '../lib/types'

type Props = {
  settings: Settings
  onSettings: (s: Settings) => void
  readOnly?: boolean // someone else's, shared with you
}

// When you're up and in bed, weekdays and weekends. A setting, so it lives in the menu.
export function AwakeHours({ settings, onSettings, readOnly = false }: Props) {
  return (
    <>
      <header className="day-header">
        <h1>Awake hours</h1>
        <p className="muted">Free time is counted between these. Leave bedtime empty for midnight.</p>
      </header>

      <section>
        {(
          [
            ['Weekdays', 'dayStart', 'dayEnd'],
            ['Weekends', 'weekendStart', 'weekendEnd'],
          ] as const
        ).map(([label, startKey, endKey]) => (
          <div key={label}>
            <h4>{label}</h4>
            <div className="row">
              <label>
                <span>Up at</span>
                <input
                  type="time"
                  disabled={readOnly}
                  value={settings[startKey]}
                  onChange={(e) => e.target.value && onSettings({ ...settings, [startKey]: e.target.value })}
                />
              </label>
              <label>
                <span>Bed at</span>
                <input
                  type="time"
                  disabled={readOnly}
                  value={settings[endKey]}
                  onChange={(e) => onSettings({ ...settings, [endKey]: e.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
