import type { FeatureRow } from '../domain/features'
import type { Theme } from '../domain/theme'
import type { NotificationAccess } from '../notifications'
import { Account } from './Account'
import { Appearance } from './Appearance'
import { Customize } from './Customize'
import type { ListId } from '../domain/options'
import { Badge, Segmented } from './controls'
import { Family } from './Family'
import type { SyncStatus } from './useSync'
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
  lists: Record<ListId, string[]>
  sleepGoalHours: number
  onSleepGoal: (hours: number) => void
  onAddOption: (list: ListId, value: string) => Promise<string | undefined>
  onRemoveOption: (list: ListId, value: string) => void
  onRestoreOptions: (list: ListId) => void
  syncStatus: SyncStatus
  onSyncNow: () => void
  onMembership: () => void
  /** An invite code from a link, filled into the join box. */
  joinCode?: string
  theme: Theme
  onTheme: (t: Theme) => void
  persistent: boolean
  reminders: boolean
  briefingTime: string
  notifAccess: NotificationAccess
  onSetting: (key: 'baby' | 'birth' | 'caregiver' | 'briefingTime', value: string) => void
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
  const alerts = p.features.filter((f) => f.group === 'Notifications')
  const screens = p.features.filter((f) => f.group !== 'Notifications')
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
      <Family caregiver={p.caregiver} status={p.syncStatus} onSyncNow={p.onSyncNow} onMembership={p.onMembership} joinCode={p.joinCode} />

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
          A wind-down note before {p.baby}'s nap and one morning briefing. Add more below if you want them.
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
        {p.reminders && (
          <>
            <FeatureGroup rows={alerts} onToggle={p.onToggleFeature} />
            <label className="field">
              <span className="field-label">Morning briefing at</span>
              <input type="time" defaultValue={p.briefingTime} onChange={(e) => e.target.value && p.onSetting('briefingTime', e.target.value)} />
            </label>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Features</h3>
        </div>
        <p className="muted">Turn off anything you do not use. Your logs are kept either way.</p>
        {[...new Set(screens.map((f) => f.group))].map((group) => (
          <FeatureGroup key={group} rows={screens.filter((f) => f.group === group)} onToggle={p.onToggleFeature} />
        ))}
      </section>

      <Appearance theme={p.theme} swatches={p.lists.swatches} onTheme={p.onTheme} />
      <Customize
        lists={p.lists}
        sleepGoalHours={p.sleepGoalHours}
        onSleepGoal={p.onSleepGoal}
        onAdd={p.onAddOption}
        onRemove={p.onRemoveOption}
        onRestore={p.onRestoreOptions}
      />

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

function FeatureGroup(p: { rows: FeatureRow[]; onToggle: (id: string, enabled: boolean) => void }) {
  return (
    <fieldset className="feature-group">
      <legend className="field-label">{p.rows[0]?.group}</legend>
      {p.rows.map((f) => (
        <label key={f.id} className="feature-row">
          <span>
            <b>{f.label}</b>
            <small className="muted">{f.hint}</small>
          </span>
          <input type="checkbox" role="switch" checked={f.enabled} onChange={() => p.onToggle(f.id, !f.enabled)} />
        </label>
      ))}
    </fieldset>
  )
}
