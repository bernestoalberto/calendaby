import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { setAnalytics, track } from './analytics'
import { parseLog } from './agents/capture'
import { buildHandoff, handoffText } from './agents/handoff'
import { callAgent, callBackend, HybridCaptureAgent, isoWithOffset } from './agents/remote'
import { openDriver } from './db/open'
import { appointmentAlerts } from './domain/appointmentAlerts'
import { Appointment as AppointmentSchema, type Appointment } from './domain/appointments'
import { buildAgenda, type CalendarEvent } from './domain/calendar'
import { dailyStats, napForecast } from './domain/analytics'
import { goalNote, needFor, smartSleepGoal, type SleepNeed } from './domain/sleepGoal'
import { sleepIssues } from './domain/sleepIssues'
import type { ActivityType } from './domain/activities'
import { DEFAULT_SETTINGS, type ListId } from './domain/options'
import { featureFlags, type FeatureRow } from './domain/features'
import { DraftEventSchema, type BabyEvent, type DraftEvent } from './domain/events'
import { briefingAlert, smartAlerts } from './domain/notifications'
import { newProposals, proposalAlert } from './domain/newProposals'
import { visitPrep, type VisitPrep } from './domain/visitPrep'
import { outlook } from './domain/outlook'
import { normFor, type AgeNorm } from './domain/ageNorms'
import { nextCheckups, weeksOld } from './knowledge/index'
import { EMPTY_TIMER, type NursingTimer } from './domain/nursing'
import { diaperForecast, feedForecast, sleepForecast } from './domain/predictions'
import { DuplicateEventError, SqliteEventStore } from './domain/store'
import { sleepSessions, summarizeDay } from './domain/summary'
import { DEFAULT_THEME, parseTheme, type Theme } from './domain/theme'
import {
  notificationAccess,
  notifyNow,
  requestNotificationAccess,
  sendTestNotification,
  syncNapNotifications,
  type NotificationAccess,
} from './notifications'
import { useAccount } from './ui/accountContext'
import type { Chat } from './ui/Agent'
import { speakable } from './domain/replyBlocks'
import { Listen } from './ui/Listen'
import { Sheet } from './ui/controls'
import { EditSheet, type EventEdit } from './ui/EditSheet'
import { ClockIcon, FaceIcon, ListIcon, LogoIcon, PlusIcon, ShareIcon, SparkIcon, TodayIcon } from './ui/icons'
import { eventTitle } from './ui/kinds'
import type { GrowthRef, Sex } from './domain/growthReference'
import { bodyUnits, growthTiles } from './domain/growth'
import { Growth } from './ui/Growth'
import { InsightCards } from './ui/InsightCards'
import { insightAlert, insightSignature, insightsDue } from './domain/insights'
import type { StoredInsight } from './domain/store'
import { Milestones } from './ui/Milestones'
import { milestoneReport, wholeMonths, type MilestoneState } from './domain/milestones'
import type { Milestone } from './knowledge/milestones'
import type { LogTab } from './ui/Logger'
import { applyTheme, sectionProps, ThemeContext } from './ui/themeContext'
import { babyAge, type Unit } from './ui/time'
import { useSync } from './ui/useSync'
import { Today } from './ui/Today'
import { forgetPendingJoin, peekPendingJoin } from './pendingJoin'
import { shareText } from './share'
import { describeDay, describeGrowth, describeInsights, describeMilestones, describeUpcoming, registerWebMcpTools, type MeasurementInput, type WebMcpHandlers } from './webmcp'
import { useSpeech } from './useSpeech'
import './App.css'

// Today loads with the app; the other screens load the first time they are opened, so the first paint stays small.
const Activity = lazy(() => import('./ui/Activity').then((m) => ({ default: m.Activity })))
const Analytics = lazy(() => import('./ui/Analytics').then((m) => ({ default: m.Analytics })))
const Agent = lazy(() => import('./ui/Agent').then((m) => ({ default: m.Agent })))
const Calendar = lazy(() => import('./ui/Calendar').then((m) => ({ default: m.Calendar })))
const Logger = lazy(() => import('./ui/Logger').then((m) => ({ default: m.Logger })))
const Profile = lazy(() => import('./ui/Profile').then((m) => ({ default: m.Profile })))
const Timeline = lazy(() => import('./ui/Timeline').then((m) => ({ default: m.Timeline })))

/** A stored number, or the seed value when what is stored is missing or unreadable. */
function numberSetting(stored: string | undefined, fallback: string, min: number): number {
  const n = Number(stored)
  return stored !== undefined && Number.isFinite(n) && n >= min ? n : Number(fallback)
}

const capture = new HybridCaptureAgent()
// Kept out of render so components stay pure.
const nowMs = () => Date.now()
type Tab = 'today' | 'timeline' | 'activity' | 'log' | 'analytics' | 'growth' | 'calendar' | 'agent' | 'profile'
const TWO_WEEKS = 14 * 24 * 3_600_000
const GMAIL_CHECK_MS = 30 * 60_000
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

const toSex = (v: string | undefined): Sex | undefined => (v === 'girl' || v === 'boy' ? v : undefined)

function Tracker({ store }: { store: SqliteEventStore }) {
  const account = useAccount()
  const [events, setEvents] = useState(() => store.list())
  // Starting values come from the database (seeded on a fresh install), so nothing flashes a default first.
  const [caregiver, setCaregiver] = useState(() => store.setting('caregiver') ?? account.name ?? 'Parent')
  const [baby, setBaby] = useState(() => store.setting('baby') ?? '')
  const [birth, setBirth] = useState(() => store.setting('birth') ?? '')
  const [babySex, setBabySex] = useState<Sex | undefined>(() => toSex(store.setting('babySex')))
  const [growthRef, setGrowthRef] = useState<GrowthRef[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [insights, setInsights] = useState<StoredInsight[]>([])
  const [unit, setUnit] = useState<Unit>(() => (store.setting('unit') === 'ml' ? 'ml' : 'oz'))
  const [lists, setLists] = useState(() => store.allOptions())
  const [sleepGoalHours, setSleepGoalHours] = useState(() => numberSetting(store.setting('sleepGoalHours'), DEFAULT_SETTINGS.sleepGoalHours, 1))
  const [featureRows, setFeatureRows] = useState<FeatureRow[]>([])
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([])
  const [tummyGoal, setTummyGoal] = useState(() => numberSetting(store.setting('tummyGoal'), DEFAULT_SETTINGS.tummyGoal, 0))
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME)
  const [editing, setEditing] = useState<BabyEvent[] | null>(null)
  const [reminders, setReminders] = useState(false)
  const [sleepNeeds, setSleepNeeds] = useState<SleepNeed[]>([])
  const [sleepAuto, setSleepAuto] = useState(() => store.setting('sleepGoalAuto') === 'on')
  // Off until a parent turns it on; the choice is kept on the phone like the reminders switch.
  const [shareUsage, setShareUsage] = useState(false)
  const [briefingTime, setBriefingTime] = useState(() => store.setting('briefingTime') ?? DEFAULT_SETTINGS.briefingTime)
  const [ageNorms, setAgeNorms] = useState<AgeNorm[]>([])
  const [notifAccess, setNotifAccess] = useState<NotificationAccess>('prompt')
  const [timer, setTimer] = useState<NursingTimer>(EMPTY_TIMER)
  // An invite link opens the join box with its code filled in; the code is forgotten once the person leaves Profile.
  const [joinCode, setJoinCode] = useState(peekPendingJoin)
  const [tab, setTab] = useState<Tab>(joinCode ? 'profile' : 'today')
  // Only the name of the screen, and only once a parent has turned sharing on (track does nothing otherwise).
  useEffect(() => track('screen_opened', { screen: tab }), [tab])
  useEffect(() => {
    if (tab === 'profile' || joinCode === undefined) return
    forgetPendingJoin()
    setJoinCode(undefined)
  }, [tab, joinCode])
  const [logTab, setLogTab] = useState<LogTab>('feed')
  const [sheet, setSheet] = useState<'handoff' | null>(null)
  const [text, setText] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [chat, setChat] = useState<Chat[]>([])
  const [asking, setAsking] = useState(false)
  const [online, setOnline] = useState<boolean>()
  const [now, setNow] = useState(nowMs)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([])
  const [calBusy, setCalBusy] = useState(false)
  const [calError, setCalError] = useState<string>()
  /** Appointment ids this phone has already shown, so only new email finds trigger a notification. */
  const seenAppointments = useRef<Set<string>>(undefined)
  const lastGmailCheck = useRef(0)
  /** The settings the whole family shares; another caregiver may have changed them. */
  const loadShared = useCallback(async () => {
    const [name, born, goal, sex] = await Promise.all([store.getSetting('baby'), store.getSetting('birth'), store.getSetting('tummyGoal'), store.getSetting('babySex')])
    if (name) setBaby(name)
    setBirth(born ?? '')
    setBabySex(toSex(sex))
    const minutes = Number(goal)
    if (goal && Number.isFinite(minutes) && minutes >= 0) setTummyGoal(minutes)
  }, [store])

  const sync = useSync(store, account.signedIn === true, onSynced)
  const speech = useSpeech(
    (heard) => setText((t) => (t ? `${t}, ${heard}` : heard)),
    (message) => setToast({ text: message }),
  )

  const fastTick = tab === 'log' || timer.running !== undefined
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), fastTick ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [fastTick])

  useEffect(() => {
    void store.getSetting('caregiver').then((v) => {
      if (v) setCaregiver(v)
      else if (account.name) {
        setCaregiver(account.name)
        void store.setSetting('caregiver', account.name)
      }
    })
    void loadShared()
    void store.listFeatures().then(setFeatureRows)
    void store.getSetting('theme').then((v) => setTheme(parseTheme(v)))
    void store.listActivityTypes().then(setActivityTypes)
    void store.getSetting('reminders').then((v) => setReminders(v === 'on'))
    void store.getSetting('analytics').then((v) => {
      setShareUsage(v === 'on')
      setAnalytics(v === 'on')
    })
    void store.listAgeNorms().then(setAgeNorms)
    void store.listGrowthReference().then(setGrowthRef)
    void store.listSleepNeeds().then(setSleepNeeds)
    void store.listMilestones().then(setMilestones)
    void store.listInsights().then(setInsights)
    void store.getSetting('appointments').then((v) => {
      const parsed = AppointmentSchema.array().safeParse(v ? JSON.parse(v) : [])
      if (!parsed.success) return
      setAppointments(parsed.data)
      // With no saved list this is a first run: the first list fetched becomes the starting point, so nothing old is announced.
      if (v) seenAppointments.current = new Set(parsed.data.map((a) => a.id))
    })
    void store.getSetting('nursing').then((v) => v && setTimer(JSON.parse(v) as NursingTimer))
    void notificationAccess().then(setNotifAccess)
  }, [store, account.name, loadShared])

  useEffect(() => applyTheme(document.documentElement, theme), [theme])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const on = useMemo(() => featureFlags(featureRows), [featureRows])
  const brief = useMemo(() => buildHandoff(events, new Date(now)), [events, now])
  const day = useMemo(() => summarizeDay(events, new Date(now)), [events, now])
  const sessions = useMemo(() => sleepSessions(events), [events])
  const forecast = useMemo(() => napForecast(events, now), [events, now])
  const weeks = weeksOld(birth, now)
  const checkup = weeks === undefined ? undefined : nextCheckups(weeks, 'us', 1)[0]
  const view = useMemo(() => outlook(events, normFor(ageNorms, weeks), weeks, now), [events, ageNorms, weeks, now])
  const agenda = useMemo(
    () => buildAgenda(appointments, calEvents, sleepForecast(events, now), feedForecast(events, now), now),
    [appointments, calEvents, events, now],
  )
  const pending = useMemo(() => appointments.filter((a) => a.status === 'proposed' || a.status === 'review'), [appointments])
  const current = sessions.at(-1)
  const asleep = current !== undefined && current.end === undefined
  const lastDone = [...sessions].reverse().find((s) => s.end !== undefined)
  const lastOf = (kind: BabyEvent['kind']) => [...events].reverse().find((e) => e.kind === kind)
  const age = birth ? babyAge(birth, now) : undefined
  const sleepGoal = useMemo(
    () =>
      smartSleepGoal({
        auto: sleepAuto,
        setHours: sleepGoalHours,
        need: needFor(sleepNeeds, weeks),
        days: dailyStats(events, 8, now).slice(0, -1),
      }),
    [sleepAuto, sleepGoalHours, sleepNeeds, weeks, events, now],
  )
  const sleepProblems = useMemo(() => sleepIssues(events, now), [events, now])
  /** Problems already announced, so a notification is sent once per problem and not every time the app opens. */
  const announcedSleep = useRef<Set<string>>(new Set(JSON.parse(store.setting('sleepIssuesNotified') ?? '[]') as string[]))

  useEffect(() => {
    const active = reminders && notifAccess === 'granted'
    const at = nowMs()
    const alerts = active
      ? [
          ...smartAlerts(baby, events, at, on),
          ...(on('alertBriefing') ? [briefingAlert(baby, briefingTime, view.tonight, at)] : []),
          ...appointmentAlerts(baby, appointments, events, at),
        ]
      : []
    void syncNapNotifications(active, alerts)
  }, [reminders, notifAccess, baby, events, appointments, on, briefingTime, view.tonight])

  useEffect(() => {
    const fresh = sleepProblems.filter((p) => !announcedSleep.current.has(p.key))
    if (fresh.length === 0) return
    for (const p of fresh) announcedSleep.current.add(p.key)
    void store.setSetting('sleepIssuesNotified', JSON.stringify([...announcedSleep.current].slice(-50)))
    if (reminders && notifAccess === 'granted' && on('alertSleepCheck')) void notifyNow(`${baby}: check the sleep log`, fresh[0].message)
  }, [sleepProblems, reminders, notifAccess, on, baby, store])

  const prep = useMemo(() => {
    const out: Record<string, VisitPrep> = {}
    for (const a of appointments) if (a.status !== 'dismissed') out[a.id] = visitPrep(a, baby, birth || undefined, events, now)
    return out
  }, [appointments, baby, birth, events, now])

  /** The newest values for code that runs later (timers, listeners), which would otherwise see old ones. */
  const latest = useRef({ reminders, notifAccess, baby })
  latest.current = { reminders, notifAccess, baby }

  /** Stores a fresh appointment list; when the email check found new ones and nobody is looking at the list, says so. */
  function receiveAppointments(list: Appointment[], announce: boolean) {
    const found = newProposals(seenAppointments.current, list)
    seenAppointments.current = new Set(list.map((a) => a.id))
    setAppointments(list)
    void store.setSetting('appointments', JSON.stringify(list))
    const { reminders: on, notifAccess: access, baby: name } = latest.current
    if (announce && found.length > 0 && on && access === 'granted') {
      const message = proposalAlert(name, found)
      void notifyNow(message.title, message.body)
    }
  }

  async function loadCalendar() {
    const from = nowMs()
    try {
      receiveAppointments(await callBackend<Appointment[]>('listAppointments', {}), false)
      setCalEvents(await callBackend<CalendarEvent[]>('listCalendar', { from, to: from + TWO_WEEKS }))
      setCalError(undefined)
    } catch (err) {
      setCalError(err instanceof Error ? `Couldn't load your calendar (${err.message}).` : "Couldn't load your calendar.")
    }
  }

  async function syncGmail() {
    setCalBusy(true)
    try {
      await callBackend('importAppointments', { now: isoWithOffset(new Date(nowMs())) })
      await loadCalendar()
    } catch (err) {
      setCalError(err instanceof Error ? `Couldn't read Gmail (${err.message}).` : "Couldn't read Gmail.")
    } finally {
      setCalBusy(false)
    }
  }

  async function decide(id: string, status: 'confirmed' | 'dismissed') {
    await callBackend('setAppointmentStatus', { id, status }).catch(() => undefined)
    await loadCalendar()
  }

  useEffect(() => {
    if (account.signedIn && tab === 'calendar') void loadCalendar()
    else if (account.signedIn) void callBackend<Appointment[]>('listAppointments', {}).then(
      (list) => receiveAppointments(list, true),
      () => undefined,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.signedIn, tab])

  /** Reads Gmail without a tap: when the app opens or returns to the front, at most every 30 minutes. */
  async function checkGmailQuietly() {
    if (Date.now() - lastGmailCheck.current < GMAIL_CHECK_MS) return
    lastGmailCheck.current = Date.now()
    try {
      await callBackend('importAppointments', { now: isoWithOffset(new Date(nowMs())) })
      receiveAppointments(await callBackend<Appointment[]>('listAppointments', {}), tab !== 'calendar')
    } catch (err) {
      // Not worth interrupting anyone: the Sync Gmail button on the Calendar tab shows the same error when it matters.
      console.warn('Gmail check failed', err)
    }
  }
  const quietCheck = useRef(checkGmailQuietly)
  quietCheck.current = checkGmailQuietly

  useEffect(() => {
    if (!account.signedIn || !on('calendar')) return
    const go = () => void quietCheck.current()
    go()
    const onVisible = () => document.visibilityState === 'visible' && go()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [account.signedIn, on])

  /**
   * Asks the assistant for new insight cards when something about the baby changed (a measurement, a milestone answer, a
   * new checklist) or a day has passed, and says so in a notification. Needs the assistant to be reachable; logging never
   * waits for it. The try is recorded even when it fails, so a server that is down is asked once per minimum gap.
   */
  async function maybeAskInsights() {
    if (insightsBusy.current) return
    const months = wholeMonths(birth || undefined, nowMs())
    const signature = insightSignature(events, months)
    const lastRun = Number(store.setting('insightsLastRun')) || undefined
    const due = insightsDue({
      enabled: on('aiInsights'),
      online: online !== false && navigator.onLine,
      hasBirth: birth !== '',
      signature,
      lastSignature: store.setting('insightsSignature'),
      lastRun,
      now: nowMs(),
    })
    if (!due) return
    insightsBusy.current = true
    const at = nowMs()
    try {
      const res = await callAgent({
        mode: 'insights',
        prompt: 'insights',
        now: isoWithOffset(new Date(at)),
        birth: birth || undefined,
        sex: babySex,
        events: events.slice(-500),
        measures: events.filter((e) => e.kind === 'measure').slice(-200),
        marks: events.filter((e) => e.kind === 'milestone').slice(-400),
      })
      const cards = res.insights ?? []
      if (cards.length > 0) {
        await store.addInsights(cards, at)
        setInsights(await store.listInsights())
        const { reminders: remind, notifAccess: access, baby: name } = latest.current
        if (remind && access === 'granted' && on('alertInsights')) {
          const message = insightAlert(name, cards)
          void notifyNow(message.title, message.body)
        }
      }
    } catch (err) {
      console.warn('Could not get new insights', err)
    } finally {
      await store.setSetting('insightsLastRun', String(at))
      await store.setSetting('insightsSignature', signature)
      insightsBusy.current = false
    }
  }
  const insightsBusy = useRef(false)
  const askInsights = useRef(maybeAskInsights)
  askInsights.current = maybeAskInsights
  const insightSig = insightSignature(events, wholeMonths(birth || undefined, now))

  useEffect(() => {
    void askInsights.current()
    const onVisible = () => document.visibilityState === 'visible' && void askInsights.current()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [insightSig, birth, online, on])

  async function dismissInsight(id: string) {
    await store.dismissInsight(id)
    setInsights(await store.listInsights())
  }

  function reload() {
    setEvents(store.list())
    setNow(nowMs())
  }

  function onSynced() {
    reload()
    void loadShared()
  }

  // Every local change goes up shortly after it is saved.
  function refresh() {
    reload()
    sync.soon()
  }

  async function logAll(drafts: DraftEvent[]): Promise<{ added: BabyEvent[]; problems: string[] }> {
    const added: BabyEvent[] = []
    const problems: string[] = []
    for (const d of drafts) {
      try {
        added.push(await store.append(d, caregiver))
        track('log_entry', { kind: d.kind })
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
            text: `Logged: ${added.map((e) => eventTitle(e, unit, activityTypes)).join(', ')}`,
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

  /** What was logged, what could not be saved and what was not understood, as one line. */
  function logOutcome(added: BabyEvent[], problems: string[], unsure: string[]): string {
    const parts = [
      added.length ? `Logged ${added.map((e) => eventTitle(e, unit, activityTypes)).join(', ')}` : '',
      ...problems,
      ...unsure.map((u) => `Not logged: "${u}"`),
    ].filter(Boolean)
    return parts.join('. ') || 'Nothing to log'
  }

  async function logText() {
    if (!text.trim()) return
    const { drafts, unsure } = await capture.capture(text, new Date(nowMs()))
    const { added, problems } = await logAll(drafts)
    setToast({ text: logOutcome(added, problems, unsure), undo: added.length ? added : undefined })
    setText(unsure.join(', '))
  }

  /** The browser's own assistant (WebMCP) may log with the offline rules only; the parent sees it and can undo it. */
  async function logForAssistant(said: string): Promise<string> {
    const { drafts, unsure } = parseLog(said, new Date(nowMs()))
    const { added, problems } = await logAll(drafts)
    const outcome = logOutcome(added, problems, unsure)
    setToast({ text: `Assistant: ${outcome}`, undo: added.length ? added : undefined })
    return outcome
  }

  /** A measurement an assistant read out. Checked like a typed one, shown to the parent and undoable. */
  async function logMeasurementForAssistant(input: MeasurementInput): Promise<string> {
    const at = input.when ? Date.parse(input.when) : nowMs()
    if (at > nowMs() + 60_000) return 'Not logged: a measurement cannot be in the future'
    const draft = DraftEventSchema.safeParse({
      kind: 'measure',
      at,
      weightG: input.weightKg === undefined ? undefined : Math.round(input.weightKg * 1000),
      lengthMm: input.lengthCm === undefined ? undefined : Math.round(input.lengthCm * 10),
      headMm: input.headCm === undefined ? undefined : Math.round(input.headCm * 10),
    })
    if (!draft.success) return `Not logged: ${draft.error.issues[0]?.message ?? 'those values are not possible'}`
    const { added, problems } = await logAll([draft.data])
    const outcome = logOutcome(added, problems, [])
    setToast({ text: `Assistant: ${outcome}`, undo: added.length ? added : undefined })
    return outcome
  }

  const assistant = useRef<WebMcpHandlers>(null)
  assistant.current = {
    logText: logForAssistant,
    handoff: () => handoffText(brief),
    today: () => describeDay(day, baby),
    upcoming: () =>
      describeUpcoming(feedForecast(events, nowMs()), sleepForecast(events, nowMs()), diaperForecast(events, nowMs()), baby),
    logMeasurement: logMeasurementForAssistant,
    growth: () => describeGrowth(growthTiles(events, bodyUnits('ml'), babySex, birth || undefined, growthRef), baby),
    milestones: () => describeMilestones(milestoneReport(milestones, events, wholeMonths(birth || undefined, nowMs())), baby),
    insights: () => describeInsights(insights, baby),
  }
  useEffect(
    () =>
      registerWebMcpTools({
        logText: (said) => assistant.current?.logText(said) ?? Promise.resolve('The app is not ready'),
        handoff: () => assistant.current?.handoff() ?? '',
        today: () => assistant.current?.today() ?? '',
        upcoming: () => assistant.current?.upcoming() ?? '',
        logMeasurement: (input) => assistant.current?.logMeasurement(input) ?? Promise.resolve('The app is not ready'),
        growth: () => assistant.current?.growth() ?? '',
        milestones: () => assistant.current?.milestones() ?? '',
        insights: () => assistant.current?.insights() ?? '',
      }),
    [],
  )

  async function undo(list: BabyEvent[]) {
    for (const e of list) await store.remove(e.id)
    refresh()
    setToast({ text: 'Undone' })
  }

  async function toggleFeature(id: string, enabled: boolean) {
    await store.setFeature(id, enabled)
    setFeatureRows(await store.listFeatures())
    // Do not leave the user on a tab they just turned off.
    if (!enabled && (id === tab || (id === 'activities' && tab === 'activity'))) setTab('today')
  }

  /** Returns a message to show in the sheet when the save fails, otherwise closes it. */
  async function saveEdit(edits: EventEdit[]): Promise<string | undefined> {
    try {
      for (const e of edits) await store.update(e.id, e.draft)
    } catch {
      return "Couldn't save those changes"
    }
    refresh()
    setEditing(null)
    setToast({ text: 'Entry updated' })
    return undefined
  }

  async function remove(list: BabyEvent[]) {
    for (const e of list) await store.remove(e.id)
    refresh()
    setToast({
      text: list.length > 1 ? 'Deleted sleep' : `Deleted ${eventTitle(list[0], unit, activityTypes)}`,
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
        birth: birth || undefined,
        sex: babySex,
        measures: events.filter((e) => e.kind === 'measure').slice(-200),
        events: events.slice(-500),
      })
      const { added } = await logAll(res.drafts)
      setOnline(true)
      setChat((c) => [
        ...c,
        {
          role: 'agent',
          text: res.reply,
          logged: added.map((e) => eventTitle(e, unit, activityTypes)),
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
    if ((await shareText(title, body)) === 'copied') setToast({ text: 'Copied to clipboard' })
  }

  function setSetting(key: 'baby' | 'birth' | 'babySex' | 'caregiver' | 'briefingTime', value: string) {
    if (key === 'baby') setBaby(value)
    if (key === 'babySex') setBabySex(toSex(value))
    if (key === 'birth') setBirth(value)
    if (key === 'caregiver') setCaregiver(value)
    if (key === 'briefingTime') setBriefingTime(value)
    void store.setSetting(key, value).then(() => (key === 'baby' || key === 'birth' || key === 'babySex') && sync.soon())
  }

  function changeTheme(next: Theme) {
    setTheme(next)
    void store.setSetting('theme', JSON.stringify(next))
  }

  function changeUnit(u: Unit) {
    setUnit(u)
    void store.setSetting('unit', u)
  }

  async function toggleAnalytics() {
    const next = !shareUsage
    setAnalytics(next)
    setShareUsage(next)
    await store.setSetting('analytics', next ? 'on' : 'off')
    setToast({ text: next ? 'Thanks. Anonymous usage is shared.' : 'Usage sharing turned off' })
  }

  async function toggleReminders() {
    if (reminders) {
      setReminders(false)
      await store.setSetting('reminders', 'off')
      setToast({ text: 'Nap reminders turned off' })
      return
    }
    const access = await requestNotificationAccess()
    setNotifAccess(access)
    if (access !== 'granted') {
      setToast({ text: 'Allow notifications in your device or browser settings first' })
      return
    }
    setReminders(true)
    await store.setSetting('reminders', 'on')
    setToast({ text: `Nap reminders enabled for ${baby}` })
  }

  async function testReminder() {
    const ok = await sendTestNotification(baby)
    setToast({ text: ok ? 'Test notification sent' : 'Notifications are not allowed' })
  }

  function changeTimer(t: NursingTimer) {
    setTimer(t)
    setNow(nowMs())
    void store.setSetting('nursing', JSON.stringify(t))
  }

  async function addActivityType(label: string): Promise<ActivityType | undefined> {
    try {
      const added = await store.addActivityType(label)
      setActivityTypes(await store.listActivityTypes())
      return added
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : "Couldn't add that activity" })
      return undefined
    }
  }

  /** A parent's answer about one milestone; the latest answer for an item counts. */
  async function markMilestone(m: Milestone, state: MilestoneState) {
    const { problems } = await logAll([{ kind: 'milestone', at: nowMs(), milestoneId: m.id, state, text: m.text }])
    if (problems.length > 0) setToast({ text: problems[0] })
  }

  function changeSleepAuto(auto: boolean) {
    setSleepAuto(auto)
    void store.setSetting('sleepGoalAuto', auto ? 'on' : 'off')
  }

  function changeSleepGoal(hours: number) {
    setSleepGoalHours(hours)
    void store.setSetting('sleepGoalHours', String(hours))
  }

  /** Returns why a value was refused, or nothing when it was added. */
  async function addOption(list: ListId, value: string): Promise<string | undefined> {
    try {
      await store.addOption(list, value)
    } catch (err) {
      return err instanceof Error ? err.message : "Couldn't add that"
    }
    setLists(store.allOptions())
    return undefined
  }

  async function removeOption(list: ListId, value: string) {
    await store.removeOption(list, value)
    setLists(store.allOptions())
  }

  async function restoreOptions(list: ListId) {
    await store.restoreOptions(list)
    setLists(store.allOptions())
  }

  function changeTummyGoal(minutes: number) {
    setTummyGoal(minutes)
    void store.setSetting('tummyGoal', String(minutes)).then(sync.soon)
  }

  function openLog(t: LogTab) {
    setLogTab(t)
    setTab('log')
  }

  const pageName = {
    today: 'Today',
    timeline: 'Timeline',
    activity: 'Activity',
    log: 'Log',
    analytics: 'Analytics',
    growth: 'Growth & milestones',
    calendar: 'Calendar',
    agent: 'Agent',
    profile: 'Profile',
  }[tab]

  return (
    <ThemeContext.Provider value={theme}>
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="topbar" {...sectionProps(theme, 'topbar')}>
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

      <main id="main" tabIndex={-1}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
        {tab === 'today' && (
          <Today
            on={on}
            baby={baby}
            now={now}
            unit={unit}
            sleepGoalHours={sleepGoal.hours}
            sleepGoalNote={goalNote(sleepGoal)}
            sleepIssues={sleepProblems}
            onReviewSleep={() => setTab('timeline')}
            current={current}
            asleep={asleep}
            lastDone={lastDone}
            napsToday={day.naps}
            day={day}
            forecast={forecast}
            outlook={view}
            checkup={checkup && { ...checkup, around: new Date(`${birth}T00:00`).getTime() + checkup.at * 7 * 86_400_000 }}
            lastFeed={lastOf('feed')}
            lastDiaper={lastOf('diaper')}
            lastMed={lastOf('med')}
            brief={brief}
            text={text}
            onText={setText}
            onSubmitText={() => void logText()}
            onAssistantText={logForAssistant}
            speech={speech}
            onToggleSleep={toggleSleep}
            onQuick={openLog}
            onFullStats={() => setTab('analytics')}
            onGrowth={() => setTab('growth')}
            insights={insights}
            onDismissInsight={(id) => void dismissInsight(id)}
            growth={growthTiles(events, bodyUnits(unit), babySex, birth || undefined, growthRef)}
            onShareHandoff={() => setSheet('handoff')}
            onAsk={(prompt) => {
              setTab('agent')
              if (prompt) void ask(prompt)
            }}
          />
        )}
        {tab === 'log' && (
          <Logger
            baby={baby}
            now={now}
            unit={unit}
            activityTypes={activityTypes}
            lists={lists}
            on={on}
            onAddActivityType={addActivityType}
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
        {tab === 'timeline' && on('timeline') && (
          <Timeline events={events} now={now} unit={unit} baby={baby} activityTypes={activityTypes} on={on} issues={sleepProblems} onDelete={(list) => void remove(list)} onEdit={setEditing} />
        )}
        {tab === 'activity' && on('activities') && (
          <Activity
            baby={baby}
            events={events}
            now={now}
            types={activityTypes}
            quickMinutes={lists.activityMinutes.map(Number)}
            goalMin={tummyGoal}
            onGoal={changeTummyGoal}
            onLog={(draft) => void quickLog(draft)}
            onEdit={setEditing}
          />
        )}
        {tab === 'analytics' && on('analytics') && (
          <Analytics events={events} now={now} unit={unit} baby={baby} onShare={(body) => void share(`${baby} summary`, body)} />
        )}
        {tab === 'growth' && (
          <div className="stack">
            <h2 className="page-title">Growth &amp; milestones</h2>
            {on('aiInsights') && <InsightCards cards={insights} onDismiss={(id) => void dismissInsight(id)} />}
            {on('growth') && (
              <Growth
                baby={baby}
                events={events}
                unit={unit}
                now={now}
                birth={birth || undefined}
                sex={babySex}
                reference={growthRef}
                onAdd={() => {
                  setLogTab('growth')
                  setTab('log')
                }}
                onEdit={setEditing}
              />
            )}
            {on('milestones') && <Milestones baby={baby} milestones={milestones} events={events} months={wholeMonths(birth || undefined, now)} onMark={(m, state) => void markMilestone(m, state)} />}
          </div>
        )}
        {tab === 'calendar' && on('calendar') && (
          <Calendar
            signedIn={account.signedIn === true}
            now={now}
            agenda={agenda}
            pending={pending}
            prep={prep}
            busy={calBusy}
            error={calError}
            onSync={() => void syncGmail()}
            onDecide={(id, status) => void decide(id, status)}
          />
        )}
        {tab === 'agent' && on('agent') && <Agent baby={baby} chat={chat} busy={asking} online={online} onSend={(q) => void ask(q)} />}
        {tab === 'profile' && (
          <Profile
            features={featureRows}
            handoffOn={on('handoff')}
            onToggleFeature={(id, enabled) => void toggleFeature(id, enabled)}
            now={now}
            baby={baby}
            birth={birth}
            sex={babySex ?? ''}
            caregiver={caregiver}
            unit={unit}
            theme={theme}
            onTheme={changeTheme}
            lists={lists}
            sleepGoalHours={sleepGoalHours}
            onSleepGoal={changeSleepGoal}
            sleepAuto={sleepAuto}
            onSleepAuto={changeSleepAuto}
            onAddOption={addOption}
            onRemoveOption={(list, value) => void removeOption(list, value)}
            onRestoreOptions={(list) => void restoreOptions(list)}
            syncStatus={sync.status}
            onSyncNow={() => void sync.now()}
            onMembership={() => void sync.now()}
            joinCode={joinCode}
            persistent={store.persistent}
            analytics={shareUsage}
            onToggleAnalytics={() => void toggleAnalytics()}
            reminders={reminders}
            briefingTime={briefingTime}
            notifAccess={notifAccess}
            onSetting={setSetting}
            onUnit={changeUnit}
            onToggleReminders={() => void toggleReminders()}
            onTestReminder={() => void testReminder()}
            onHandoff={() => setSheet('handoff')}
          />
        )}
        </Suspense>
      </main>

      <nav className="nav" aria-label="Main" {...sectionProps(theme, 'nav')}>
        <button type="button" aria-current={tab === 'today'} onClick={() => setTab('today')}>
          <ClockIcon />
          Today
        </button>
        {on('timeline') && (
          <button type="button" aria-current={tab === 'timeline'} onClick={() => setTab('timeline')}>
            <ListIcon />
            Timeline
          </button>
        )}
        {on('activities') && (
          <button type="button" aria-current={tab === 'activity'} onClick={() => setTab('activity')}>
            <FaceIcon />
            Activity
          </button>
        )}
        <button type="button" className="fab" aria-current={tab === 'log'} onClick={() => setTab('log')}>
          <PlusIcon />
          Log
        </button>
        {on('calendar') && (
          <button type="button" aria-current={tab === 'calendar'} onClick={() => setTab('calendar')}>
            <TodayIcon />
            Calendar
          </button>
        )}
        {on('agent') && (
          <button type="button" aria-current={tab === 'agent'} onClick={() => setTab('agent')}>
            <SparkIcon />
            Agent
          </button>
        )}
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

      {editing && <EditSheet events={editing} unit={unit} types={activityTypes} onSave={saveEdit} onClose={() => setEditing(null)} />}

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
            <Listen text={speakable(handoffText(brief))} />
            <ul>
              {brief.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>
        </Sheet>
      )}
    </div>
    </ThemeContext.Provider>
  )
}
