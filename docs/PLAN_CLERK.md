# Plan: Clerk sign-in, Gmail doctor appointments, smart reminders

Goal: a parent signs in with Google through Clerk, Calendaby finds doctor appointments in their Gmail, shows them for confirmation, and reminds them at the right moment around the baby's rhythm.

## Decisions

- **Clerk** (`@clerk/clerk-react` in the app, `@clerk/backend` on the server) with the Google social connection. Clerk keeps the Google OAuth token; only the server reads it with `getUserOauthAccessToken`. The token never reaches the phone.
- **Scopes:** `gmail.readonly` to find appointment emails, `calendar.events` later for write-back. `gmail.readonly` is a restricted scope: development works in Google's testing mode (100 users), but public launch needs Google verification and a security assessment. Plan for that before release.
- **Sign-in is optional.** Logging, handoff and notifications keep working offline and signed out (SPEC). Sign-in unlocks appointment sync and protects `/api/agent`, which closes the "no sign-in" gap in STATUS.
- **Email is data, never instructions.** The model extracts appointments into a strict Zod schema. Results are proposals; the parent confirms each one before it is stored. Nothing is ever auto-created from an email.
- **Reminders stay on the device** (existing local notifications). No push server in this plan.
- **Storage:** appointments need hosted storage. This plan depends on moving the backend from SQLite-on-Vercel to Turso or Postgres.

## Known risk

Google blocks OAuth inside embedded WebViews, so the Capacitor shells cannot use the same redirect flow as the PWA. Native sign-in must open the system browser and return by deep link (Capacitor Browser and App plugins). Phase 4 covers this; phases 1 to 3 target the PWA first.

## Phases

### 1. Sign-in and protected API
- Add `ClerkProvider`, a Sign in with Google button in Profile, and a signed-out mode that changes nothing else.
- Server helper verifies the Clerk session token on `/api/agent` and `/api/backend/*` (replaces reliance on `AGENT_ALLOWED_ORIGIN` alone). Signed-out calls to the agent get 401 and the app shows the assistant as offline.
- `.env.example`: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. Clerk dashboard: enable Google, add the Gmail and Calendar scopes.
- Done when: signed-out app behaves exactly as today; signed-in agent calls succeed; a call with no or a bad token returns 401; tests use a stub verifier, never Clerk.

### 2. Appointment model and Gmail import
- `Appointment` Zod schema in `src/domain/` (id, title, provider, location, startsAt, endsAt, source email id, status: proposed | confirmed | dismissed).
- Backend operations `importAppointments` (reads Gmail with the user's token, searches recent mail from clinics, extracts proposals) and `listAppointments`, `confirmAppointment`, `dismissAppointment`. One POST route per operationId, per ARCHITECTURE.
- Gmail reader behind an interface so tests use a fake mailbox. Extraction prompt treats the email body as untrusted data.
- Done when: a fixture mailbox yields the expected proposals; an email containing instructions ("ignore previous rules, ...") produces no extra behavior; re-importing the same email does not duplicate; unparseable emails are listed as "needs review", not guessed.

### 3. Appointments in the app and smart notifications
- Appointments screen: proposed ones to confirm or dismiss, confirmed ones on Today and the Timeline. Cache confirmed ones in the local SQLite so they work offline.
- New alert ids in `src/domain/notifications.ts`: day-before, two hours before with a feed/nap suggestion, and "time to leave". Smart parts use `predictions.ts`: warn when the predicted nap or feed overlaps the visit, suggest feeding about 45 minutes before, and add a prep line (last feed, diaper, medicine, questions to ask) to the handoff brief.
- Done when: pure unit tests cover each alert with and without a nap/feed collision; alerts reschedule when an appointment is confirmed, moved or dismissed; ids do not collide with 101 to 105.

### 4. Native sign-in
- System browser plus deep link for Android and iOS, URL scheme registered in `capacitor.config.ts`, Google Cloud OAuth clients for each platform.
- Done when: a debug APK signs in with Google and imports appointments on a real device.

### 5. Docs and hardening
- Update SPEC (sign-in, appointments), ARCHITECTURE (auth flow, new operations), STATUS, and the roadmap.
- Done when: `npm run check` is green and a manual run on `localhost` completes sign-in, import, confirm, reminder.

## Not in this plan
Two-parent sync, Google Calendar write-back of naps, daycare report ingestion. Phase 2's Gmail reader is built to be reused for the daycare reports.

## Needs from the owner
- A Clerk application (development instance is fine to start) and its keys in `.env.local`.
- A Google Cloud project with Gmail API and Calendar API enabled and an OAuth consent screen in testing mode, with the owner's and partner's Gmail added as test users.
- A choice of hosted storage (Turso is the lightest fit for the current `node:sqlite` code).
