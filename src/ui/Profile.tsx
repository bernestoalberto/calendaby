import type { FeatureRow } from '../domain/features'
import type { NotificationAccess } from '../notifications'
import { Account } from './Account'
import { Badge, Segmented } from './controls'
import { FaceIcon, MoonIcon, ShareIcon } from './icons'
import { babyAge, type Unit } from './time'

interface Props {
  features: FeatureRow[]
  handoffOn: boolean
  onToggleFeature: (id: string, enabled: boolean) => void
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

function reminderStatusLabel(reminders: boolean, access: NotificationAccess): string {
  if (access === 'unsupported') return 'Unavailable'
  if (access === 'denied') return 'Blocked'
  return reminders ? 'On' : 'Off'
}

export function Profile(p: Readonly<Props>) {
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

      {import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ? <Account /> : null}

      <section className="card">
        <div className="card-head">
          <h3>Caregiver on this phone</h3>
        </div>
        <label className="field">
          <span className="field-label">Your name (shown on each log)</span>
          <input defaultValue={p.caregiver} onBlur={(e) => e.target.value.trim() && p.onSetting('caregiver', e.target.value.trim())} />
        </label>
        {p.handoffOn && (
          <button type="button" className="pill quiet wide" onClick={p.onHandoff}>
            <ShareIcon width={18} height={18} /> Hand off to the next caregiver
          </button>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>
            <MoonIcon width={18} height={18} /> Smart Reminders
          </h3>
          <Badge tone={p.reminders && p.notifAccess === 'granted' ? 'sage' : 'oat'}>
            {reminderStatusLabel(p.reminders, p.notifAccess)}
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
          <h3>Features</h3>
        </div>
        <p className="muted">Turn off anything you do not use. Your logs are kept either way.</p>
        {[...new Set(p.features.map((f) => f.group))].map((group) => (
          <fieldset key={group} className="feature-group">
            <legend className="field-label">{group}</legend>
            {p.features
              .filter((f) => f.group === group)
              .map((f) => (
                <label key={f.id} className="feature-row">
                  <span>
                    <b>{f.label}</b>
                    <small className="muted">{f.hint}</small>
                  </span>
                  <input type="checkbox" role="switch" checked={f.enabled} onChange={() => p.onToggleFeature(f.id, !f.enabled)} />
                </label>
              ))}
          </fieldset>
        ))}
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
