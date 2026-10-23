import type { NotificationAccess } from '../notifications'
import { Badge, Segmented } from './controls'
import { FaceIcon, MoonIcon, ShareIcon } from './icons'
import { babyAge, type Unit } from './time'

interface Props {
  now: number
  baby: string
  birth: string
  caregiver: string
  unit: Unit
  persistent: boolean
  reminders: boolean
  notifAccess: NotificationAccess
  onSetting: (key: 'baby' | 'birth' | 'caregiver', value: string) => void
  onUnit: (u: Unit) => void
  onToggleReminders: () => void
  onTestReminder: () => void
  onHandoff: () => void
}

export function Profile(p: Props) {
  const age = p.birth ? babyAge(p.birth, p.now) : undefined
  return (
    <div className="stack">
      <div className="page-head">
        <span className="round-icon lilac big">
          <FaceIcon />
        </span>
        <div>
          <h2 className="page-title">{p.baby}</h2>
          <p className="muted">{age ? `${age} old` : 'Add a birth date to see age'}</p>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Baby</h3>
        </div>
        <label className="field">
          <span className="field-label">Name</span>
          <input defaultValue={p.baby} onBlur={(e) => e.target.value.trim() && p.onSetting('baby', e.target.value.trim())} />
        </label>
        <label className="field">
          <span className="field-label">Birth date</span>
          <input type="date" defaultValue={p.birth} max={new Date(p.now).toISOString().slice(0, 10)} onChange={(e) => p.onSetting('birth', e.target.value)} />
        </label>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Caregiver on this phone</h3>
        </div>
        <label className="field">
          <span className="field-label">Your name (shown on each log)</span>
          <input defaultValue={p.caregiver} onBlur={(e) => e.target.value.trim() && p.onSetting('caregiver', e.target.value.trim())} />
        </label>
        <button type="button" className="pill quiet wide" onClick={p.onHandoff}>
          <ShareIcon width={18} height={18} /> Hand off to the next caregiver
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>
            <MoonIcon width={18} height={18} /> Smart Reminders
          </h3>
          <Badge tone={p.reminders && p.notifAccess === 'granted' ? 'sage' : 'oat'}>
            {p.notifAccess === 'unsupported'
              ? 'Unavailable'
              : p.notifAccess === 'denied'
                ? 'Blocked'
                : p.reminders
                  ? 'On'
                  : 'Off'}
          </Badge>
        </div>
        <p className="muted">
          Notifies you for {p.baby}'s predicted naps (15m wind-down &amp; due time), expected wake-ups, upcoming feeds, and diaper checks deduced from your logs.
          {p.notifAccess === 'denied' ? ' Allow notifications in your device or browser settings to turn this on.' : ''}
        </p>
        <div className="card-foot">
          <button
            type="button"
            className={p.reminders ? 'pill quiet' : 'pill primary'}
            disabled={p.notifAccess === 'unsupported'}
            onClick={p.onToggleReminders}
          >
            {p.reminders ? 'Turn off reminders' : 'Enable smart reminders'}
          </button>
          {p.reminders && p.notifAccess === 'granted' && (
            <button type="button" className="link strong" onClick={p.onTestReminder}>
              Test alert
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Units</h3>
          <Segmented
            variant="mini"
            value={p.unit}
            onChange={p.onUnit}
            options={[
              { value: 'oz', label: 'oz' },
              { value: 'ml', label: 'mL' },
            ]}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Data</h3>
        </div>
        <p className="muted">
          {p.persistent
            ? 'Everything is stored in a private database on this device. Nothing leaves it unless you share it.'
            : 'This browser could not open persistent storage, so logs disappear when the tab closes. Open the app over https or localhost to keep them.'}
        </p>
      </section>
    </div>
  )
}
