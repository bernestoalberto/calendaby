import { useEffect, useState } from 'react'
import { z } from 'zod'
import { callBackend } from '../agents/remote'
import { inviteMessage } from '../domain/invite'
import { shareText } from '../share'
import { useAccount } from './accountContext'
import { Badge } from './controls'
import { ShareIcon } from './icons'
import type { SyncStatus } from './useSync'

const Info = z.object({
  familyId: z.string().optional(),
  role: z.enum(['owner', 'member']),
  members: z.array(z.object({ userId: z.string(), name: z.string(), role: z.enum(['owner', 'member']), you: z.boolean() })),
})
const Invite = z.object({ code: z.string(), expiresAt: z.number() })
const Preview = z.object({ ownerName: z.string() })

interface Props {
  caregiver: string
  status: SyncStatus
  onSyncNow: () => void
  /** Called after joining, leaving or removing someone, so this phone syncs against the right household. */
  onMembership: () => void
}

function statusText(s: SyncStatus): string {
  if (s.state === 'syncing') return 'Syncing…'
  if (s.state === 'error') return s.error ?? 'Could not sync'
  if (s.lastAt) return `Synced ${new Date(s.lastAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return 'Waiting to sync'
}

/** Only shown when signed in: the household is tied to the account. */
export function Family({ caregiver, status, onSyncNow, onMembership }: Readonly<Props>) {
  const { signedIn } = useAccount()
  const [info, setInfo] = useState<z.infer<typeof Info>>()
  const [invite, setInvite] = useState<z.infer<typeof Invite>>()
  const [typed, setTyped] = useState('')
  const [preview, setPreview] = useState<{ code: string; ownerName: string }>()
  const [confirm, setConfirm] = useState<string>()
  const [message, setMessage] = useState<string>()
  const [note, setNote] = useState<string>()
  const [busy, setBusy] = useState(false)

  // Bumping this asks the effect below to fetch the household again.
  const [fresh, setFresh] = useState(0)
  const load = () => setFresh((n) => n + 1)
  const asName = caregiver.trim().slice(0, 40) || 'Parent'
  // Before the name is known, the server keeps whatever name it has instead of being told "Parent".
  const named = caregiver.trim().length > 0

  useEffect(() => {
    if (!signedIn) return
    let current = true
    callBackend('householdInfo', named ? { name: asName } : {}).then(
      (raw) => {
        if (!current) return
        setInfo(Info.parse(raw))
        setMessage(undefined)
      },
      (err: unknown) => current && setMessage(err instanceof Error ? err.message : 'Could not load your household'),
    )
    return () => {
      current = false
    }
  }, [signedIn, asName, named, fresh])

  if (!signedIn) return null

  /** Runs one action, shows the server's own message when it says no, and refreshes the card. */
  async function act(work: () => Promise<void>) {
    setBusy(true)
    setMessage(undefined)
    try {
      await work()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const sendInvite = async (made: z.infer<typeof Invite>) => {
    const result = await shareText('Join my family on Calendaby', inviteMessage(made.code, made.expiresAt, asName))
    if (result === 'copied') setNote('Invite copied. Paste it into a message.')
  }

  const makeInvite = () =>
    act(async () => {
      const made = Invite.parse(await callBackend('createInvite', {}))
      setInvite(made)
      setNote(undefined)
      await sendInvite(made)
    })

  const shareAgain = () => act(() => (invite ? sendInvite(invite) : Promise.resolve()))

  const lookUp = () =>
    act(async () => {
      const found = Preview.parse(await callBackend('previewInvite', { code: typed }))
      setPreview({ code: typed, ownerName: found.ownerName })
    })

  const join = () =>
    act(async () => {
      if (!preview) return
      await callBackend('joinHousehold', { code: preview.code, name: asName })
      setPreview(undefined)
      setTyped('')
      onMembership()
      load()
    })

  const remove = (userId: string) =>
    act(async () => {
      await callBackend('removeMember', { userId })
      setConfirm(undefined)
      load()
    })

  const leave = () =>
    act(async () => {
      await callBackend('leaveHousehold', {})
      setConfirm(undefined)
      onMembership()
      load()
    })

  const owner = info?.role === 'owner'
  const alone = info !== undefined && info.members.length === 1

  return (
    <section className="card">
      <div className="card-head">
        <h3>Family</h3>
        <Badge tone={status.state === 'error' ? 'oat' : 'sage'}>{statusText(status)}</Badge>
      </div>
      <p className="muted">
        Everyone in your family sees the same log, each with their own sign-in. Changes appear on the other phones within about half a minute.
      </p>

      {info?.members.map((m) => (
        <div key={m.userId} className="card-foot">
          <span>
            <b>{m.name}</b>
            {m.you ? ' (you)' : ''} <small className="muted">{m.role === 'owner' ? 'Owner' : 'Member'}</small>
          </span>
          {owner && !m.you && (
            <button type="button" className="link" disabled={busy} onClick={() => (confirm === m.userId ? void remove(m.userId) : setConfirm(m.userId))}>
              {confirm === m.userId ? 'Tap again to remove' : 'Remove'}
            </button>
          )}
          {!owner && m.you && (
            <button type="button" className="link" disabled={busy} onClick={() => (confirm === m.userId ? void leave() : setConfirm(m.userId))}>
              {confirm === m.userId ? 'Tap again to leave' : 'Leave'}
            </button>
          )}
        </div>
      ))}

      {owner && (
        <div className="stack">
          <button type="button" className="pill quiet" disabled={busy} onClick={() => void makeInvite()}>
            <ShareIcon width={18} height={18} /> Invite someone
          </button>
          {invite && (
            <>
              <p>
                Code: <b className="invite-code">{invite.code}</b>
                <br />
                <small className="muted">
                  Works once, until {new Date(invite.expiresAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
                </small>
              </p>
              <button type="button" className="pill quiet" disabled={busy} onClick={() => void shareAgain()}>
                <ShareIcon width={18} height={18} /> Share again
              </button>
              {note && <small className="muted">{note}</small>}
            </>
          )}
        </div>
      )}

      {info && (
        <div className="stack">
          <label className="field">
            <span className="field-label">{alone ? 'Have a code from someone else?' : 'Join a different family with a code'}</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="ABC-123" autoCapitalize="characters" maxLength={12} />
          </label>
          {!preview && (
            <button type="button" className="pill quiet" disabled={busy || typed.trim().length < 4} onClick={() => void lookUp()}>
              Check code
            </button>
          )}
          {preview && (
            <>
              <p>
                Join <b>{preview.ownerName}</b>&apos;s family? Your logs on this phone are added to theirs, and you will see theirs.
                {!alone && ' You will leave your current family and stop seeing its log.'}
                {owner && !alone && ' The person who has been in it longest becomes its owner.'}
              </p>
              <button type="button" className="pill primary" disabled={busy} onClick={() => void join()}>
                Join
              </button>
            </>
          )}
        </div>
      )}

      {message && <p className="warning">{message}</p>}
      <div className="card-foot">
        <button type="button" className="link" disabled={status.state === 'syncing'} onClick={onSyncNow}>
          Sync now
        </button>
        {info?.familyId && <small className="muted">Family ID {info.familyId}</small>}
      </div>
    </section>
  )
}
