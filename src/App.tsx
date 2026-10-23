import { useEffect, useMemo, useState } from 'react'
import { buildHandoff, handoffText } from './agents/handoff'
import { callAgent, HybridCaptureAgent, isoWithOffset } from './agents/remote'
import { openDriver } from './db/open'
import { napForecast } from './domain/analytics'
import type { BabyEvent, DraftEvent } from './domain/events'
import { EMPTY_TIMER, type NursingTimer } from './domain/nursing'
import { DuplicateEventError, SqliteEventStore } from './domain/store'
import { sleepSessions, summarizeDay } from './domain/summary'
import { Analytics } from './ui/Analytics'
import { Agent, type Chat } from './ui/Agent'
import { Sheet } from './ui/controls'
import { ChartIcon, ClockIcon, ListIcon, LogoIcon, PlusIcon, ShareIcon, SparkIcon } from './ui/icons'
import { eventTitle } from './ui/kinds'
import { Logger, type LogTab } from './ui/Logger'
import { Profile } from './ui/Profile'
import { babyAge, type Unit } from './ui/time'
import { Timeline } from './ui/Timeline'
import { Today } from './ui/Today'
import { useSpeech } from './useSpeech'
import './App.css'

const capture = new HybridCaptureAgent()
// Kept out of render so components stay pure.
const nowMs = () => Date.now()
type Tab = 'today' | 'timeline' | 'log' | 'analytics' | 'agent' | 'profile'
type Toast = { text: string; undo?: BabyEvent[] }

let opened: Promise<SqliteEventStore> | undefined
function storeOpen(): Promise<SqliteEventStore> {
  return (opened ??= openDriver().then((driver) => SqliteEventStore.open(driver, localStorage)))
}

export default function App() {
  const [store, setStore] = useState<SqliteEventStore | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    storeOpen().then(setStore, (err: unknown) => setFailed(err instanceof Error ? err.message : String(err)))
  }, [])

  if (failed) return <main className="center">{failed}</main>
  if (!store) return <main className="center">Opening…</main>
  return <Tracker store={store} />
}

function Tracker({ store }: { store: SqliteEventStore }) {
  const [events, setEvents] = useState(() => store.list())
  const [caregiver, setCaregiver] = useState('Dad')
  const [baby, setBaby] = useState('Baby')
  const [birth, setBirth] = useState('')
  const [unit, setUnit] = useState<Unit>('oz')
  const [timer, setTimer] = useState<NursingTimer>(EMPTY_TIMER)
  const [tab, setTab] = useState<Tab>('today')
  const [logTab, setLogTab] = useState<LogTab>('feed')
  const [sheet, setSheet] = useState<'handoff' | null>(null)
  const [text, setText] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [chat, setChat] = useState<Chat[]>([])
  const [asking, setAsking] = useState(false)
  const [online, setOnline] = useState<boolean>()
  const [now, setNow] = useState(nowMs)
  const speech = useSpeech((heard) => setText((t) => (t ? `${t}, ${heard}` : heard)))

  const fastTick = tab === 'log' || timer.running !== undefined
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), fastTick ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [fastTick])

  useEffect(() => {
    void store.getSetting('caregiver').then((v) => v && setCaregiver(v))
    void store.getSetting('baby').then((v) => v && setBaby(v))
    void store.getSetting('birth').then((v) => v && setBirth(v))
    void store.getSetting('unit').then((v) => (v === 'oz' || v === 'ml') && setUnit(v))
    void store.getSetting('nursing').then((v) => v && setTimer(JSON.parse(v) as NursingTimer))
  }, [store])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const brief = useMemo(() => buildHandoff(events, new Date(now)), [events, now])
  const day = useMemo(() => summarizeDay(events, new Date(now)), [events, now])
  const sessions = useMemo(() => sleepSessions(events), [events])
  const forecast = useMemo(() => napForecast(events, now), [events, now])
  const current = sessions.at(-1)
  const asleep = current !== undefined && current.end === undefined
  const lastDone = [...sessions].reverse().find((s) => s.end !== undefined)
  const lastOf = (kind: BabyEvent['kind']) => [...events].reverse().find((e) => e.kind === kind)
  const age = birth ? babyAge(birth, now) : undefined

  function refresh() {
    setEvents(store.list())
    setNow(nowMs())
  }

  async function logAll(drafts: DraftEvent[]): Promise<{ added: BabyEvent[]; problems: string[] }> {
    const added: BabyEvent[] = []
    const problems: string[] = []
    for (const d of drafts) {
      try {
        added.push(await store.append(d, caregiver))
      } catch (err) {
        problems.push(err instanceof DuplicateEventError ? err.message : `Couldn't save a ${d.kind}`)
      }
    }
    refresh()
    return { added, problems }
  }

  async function quickLog(...drafts: DraftEvent[]) {
    const { added, problems } = await logAll(drafts)
    setToast(
      added.length
        ? {
            text: `Logged: ${added.map((e) => eventTitle(e, unit)).join(', ')}`,
            undo: added,
          }
        : { text: problems[0] ?? 'Nothing to log' },
    )
  }

  function toggleSleep() {
    void quickLog({
      kind: 'sleep',
      at: nowMs(),
      phase: asleep ? 'end' : 'start',
    })
  }

  async function logText() {
    if (!text.trim()) return
    const { drafts, unsure } = await capture.capture(text, new Date(nowMs()))
    const { added, problems } = await logAll(drafts)
    const parts = [
      added.length ? `Logged ${added.map((e) => eventTitle(e, unit)).join(', ')}` : '',
      ...problems,
      ...unsure.map((u) => `Not logged: "${u}"`),
    ].filter(Boolean)
    setToast({
      text: parts.join('. ') || 'Nothing to log',
      undo: added.length ? added : undefined,
    })
    setText(unsure.join(', '))
  }

  async function undo(list: BabyEvent[]) {
    for (const e of list) await store.remove(e.id)
    refresh()
    setToast({ text: 'Undone' })
  }

  async function remove(list: BabyEvent[]) {
    for (const e of list) await store.remove(e.id)
    refresh()
    setToast({
      text: list.length > 1 ? 'Deleted sleep' : `Deleted ${eventTitle(list[0], unit)}`,
    })
  }

  async function ask(q: string) {
    setChat((c) => [...c, { role: 'you', text: q }])
    setAsking(true)
    try {
      // The API accepts at most 500 events; the latest matter most.
      const res = await callAgent({
        mode: 'chat',
        prompt: q,
        now: isoWithOffset(new Date(nowMs())),
        events: events.slice(-500),
      })
      const { added } = await logAll(res.drafts)
      setOnline(true)
      setChat((c) => [
        ...c,
        {
          role: 'agent',
          text: res.reply,
          logged: added.map((e) => eventTitle(e, unit)),
        },
      ])
    } catch (err) {
      setOnline(false)
      setChat((c) => [
        ...c,
        {
          role: 'agent',
          text: `The agent is not available (${err instanceof Error ? err.message : 'network error'}). Logging, the timeline and the handoff still work without it.`,
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  async function share(title: string, body: string) {
    if (navigator.share) {
      await navigator.share({ title, text: body }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(body)
      setToast({ text: 'Copied to clipboard' })
    }
  }

  function setSetting(key: 'baby' | 'birth' | 'caregiver', value: string) {
    if (key === 'baby') setBaby(value)
    if (key === 'birth') setBirth(value)
    if (key === 'caregiver') setCaregiver(value)
    void store.setSetting(key, value)
  }

  function changeUnit(u: Unit) {
    setUnit(u)
    void store.setSetting('unit', u)
  }

  function changeTimer(t: NursingTimer) {
    setTimer(t)
    setNow(nowMs())
    void store.setSetting('nursing', JSON.stringify(t))
  }

  function openLog(t: LogTab) {
    setLogTab(t)
    setTab('log')
  }

  const pageName = {
    today: 'Today',
    timeline: 'Timeline',
    log: 'Log',
    analytics: 'Analytics',
    agent: 'Agent',
    profile: 'Profile',
  }[tab]

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="logo" aria-hidden="true">
            <LogoIcon />
          </span>
          <button type="button" className="baby-switch" onClick={() => setTab('profile')} aria-label="Baby profile">
            <b>
              {baby}
              {age ? ` • ${age}` : ''}
            </b>
            <span>{pageName}</span>
          </button>
        </div>
        <div className="topbar-right">
          <button type="button" className="avatar" aria-label={`Caregiver: ${caregiver}`} onClick={() => setTab('profile')}>
            {caregiver.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>
      {!store.persistent && <p className="warning">Not saved: entries are kept only when the app is opened over https or localhost.</p>}

      <main>
        {tab === 'today' && (
          <Today
            baby={baby}
            now={now}
            unit={unit}
            current={current}
            asleep={asleep}
            lastDone={lastDone}
            napsToday={day.naps}
            day={day}
            forecast={forecast}
            lastFeed={lastOf('feed')}
            lastDiaper={lastOf('diaper')}
            lastMed={lastOf('med')}
            brief={brief}
            text={text}
            onText={setText}
            onSubmitText={() => void logText()}
            speech={speech}
            onToggleSleep={toggleSleep}
            onQuick={openLog}
            onFullStats={() => setTab('analytics')}
            onShareHandoff={() => setSheet('handoff')}
            onAsk={() => setTab('agent')}
          />
        )}
        {tab === 'log' && (
          <Logger
            baby={baby}
            now={now}
            unit={unit}
            tab={logTab}
            onTab={setLogTab}
            onUnit={changeUnit}
            asleep={asleep}
            current={current}
            awakeSince={asleep ? undefined : lastDone?.end}
            timer={timer}
            onTimer={changeTimer}
            onSave={(drafts) => void quickLog(...drafts)}
            onToggleSleep={toggleSleep}
          />
        )}
        {tab === 'timeline' && <Timeline events={events} now={now} unit={unit} baby={baby} onDelete={(list) => void remove(list)} />}
        {tab === 'analytics' && (
          <Analytics events={events} now={now} unit={unit} baby={baby} onShare={(body) => void share(`${baby} summary`, body)} />
        )}
        {tab === 'agent' && <Agent baby={baby} chat={chat} busy={asking} online={online} onSend={(q) => void ask(q)} />}
        {tab === 'profile' && (
          <Profile
            now={now}
            baby={baby}
            birth={birth}
            caregiver={caregiver}
            unit={unit}
            persistent={store.persistent}
            onSetting={setSetting}
            onUnit={changeUnit}
            onHandoff={() => setSheet('handoff')}
          />
        )}
      </main>

      <nav className="nav" aria-label="Main">
        <button type="button" aria-current={tab === 'today'} onClick={() => setTab('today')}>
          <ClockIcon />
          Today
        </button>
        <button type="button" aria-current={tab === 'timeline'} onClick={() => setTab('timeline')}>
          <ListIcon />
          Timeline
        </button>
        <button type="button" className="fab" aria-current={tab === 'log'} onClick={() => setTab('log')}>
          <PlusIcon />
          Log
        </button>
        <button type="button" aria-current={tab === 'analytics'} onClick={() => setTab('analytics')}>
          <ChartIcon />
          Analytics
        </button>
        <button type="button" aria-current={tab === 'agent'} onClick={() => setTab('agent')}>
          <SparkIcon />
          Agent
        </button>
      </nav>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button type="button" onClick={() => void undo(toast.undo ?? [])}>
              Undo
            </button>
          )}
        </div>
      )}

      {sheet === 'handoff' && (
        <Sheet
          title="Handoff"
          onClose={() => setSheet(null)}
          footer={
            <button type="button" className="pill primary wide tall" onClick={() => void share('Baby handoff', handoffText(brief))}>
              <ShareIcon width={20} height={20} /> Share handoff
            </button>
          }
        >
          <section className="card handoff">
            <p className="eyebrow">Handing over from {caregiver}</p>
            <h2>{brief.headline}</h2>
            <ul>
              {brief.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </Sheet>
      )}
    </div>
  )
}
