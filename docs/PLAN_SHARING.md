# Plan: one baby, several caregivers, each with their own account

Goal: two or more people sign in with their own Google accounts, join the same household, and see the same log. A log made on one phone shows up on the others within about 30 seconds, and every phone keeps working offline.

## Decisions

- **Each caregiver keeps their own login.** A household links accounts; a login is never shared. The app can tell who logged what, and an owner can remove one person without changing anyone else's access.
- **Hosted storage is Turso (libSQL).** A phone cannot hand changes to a sleeping phone, so something always on must hold them. Each phone still reads and writes only its own SQLite; the server is only where changes wait.
- **Polling, not WebSocket or push.** Simpler, and 30 seconds is fast enough for a baby log. Revisit if it feels slow.
- **Invite codes, not email invites.** No extra Gmail scope or review.

## Done when (the two-account test)

Mom and Dad each sign in with their own Google account on their own phone.

1. Mom invites; Dad enters the code and accepts. Both now show the same household with two members.
2. Mom logs a feed; it appears on Dad's phone within about 30 seconds, tagged as logged by Mom.
3. Dad, with no signal, logs a diaper; when his phone reconnects it appears on Mom's.
4. Dad edits Mom's feed and deletes a note; both phones end up identical.
5. A third account that has not been invited sees none of it.
6. Mom removes Dad; Dad's phone can no longer pull, and the logs stay for Mom.

## Environments

- **Production** and **Preview** each get their own Turso database, so test data never reaches the live household. Preview also needs `CLERK_SECRET_KEY`, or its API is open.
- **Local development** uses a separate dev database (`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.development.local`, which git ignores).
- **Automated tests** never touch Turso; they use an in-memory database.

## Model

- `household(id, seq)`: `seq` is the change counter. Every create, edit or delete takes the next number.
- `member(user_id, household_id, role owner|member, name)`: one household per user.
- `invite(code_hash, household_id, expires_at, used_at)`: 6-character code, stored hashed, valid 48 hours, single use. Five wrong tries in 10 minutes locks guessing out.
- `event(household_id, id, at, body, updated_at, deleted_at, seq)`.
- Deletes are tombstones so other phones learn about them, and a late upload cannot bring a deleted entry back. The same event id from two phones is stored once. Concurrent edits to one entry: the later save wins.

## Joining

1. The owner taps Invite in Profile and gets a code.
2. The second parent signs in, enters the code, sees whose household it is, and accepts.
3. Their phone uploads its own existing events (stored once by id) and pulls the household's history.
4. The owner can remove a member; they lose access on their next call and the logs stay. A member can leave. The owner cannot leave while others remain.
5. A user alone in a household of their own can join another; someone who already shares one must leave first.

## Sync

- Each phone keeps an outbox of changes not yet sent and `lastSeq`, the last change number it has seen.
- Push: send the outbox (validated, size-capped). Pull: ask for everything after `lastSeq`, apply it in one transaction.
- Triggers: after each local change, when the app opens or comes to the front, every 30 seconds while open, and when the network returns.
- The server takes the user from the verified sign-in, finds their household, and passes that to every query. The client never names a household.

## Phases

1. **Storage (done).** `backend/household.ts`: households, members, invites, scoped numbered events, tombstones, lockout; 20 tests. Needs `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to run hosted; a local file is used otherwise.
2. **Routes (done).** `pushChanges`, `pullChanges`, `createInvite`, `previewInvite`, `joinHousehold`, `leaveHousehold`, `removeMember`, `householdInfo`, `deleteMyData` behind the Clerk check, with tests for 401, bad input and scoping.
3. **Phone side (done, tested with two simulated phones; not yet on real devices).** Outbox and cursor in the on-device SQLite (new migration), sync loop with the triggers above, first-sync upload, and a Family card in Profile (invite code, members, join, leave, "Synced" status).
4. **Shared settings.** Baby name, birth date and tummy goal sync; theme, feature switches, units and reminders stay per phone. Timeline shows who logged each entry.
5. **Agent and hardening.** The agent reads the household's events from the database; rate limits; update `STATUS.md`.

## Risks

- Two phones that each logged alone before joining may both hold a feed the parents logged twice. The duplicate guard flags it; a one-time merge review is out of scope.
- Clock drift: ordering uses the server's change number, never a phone clock.
- Free-tier limits on Turso; check before launch.
- The household's data lives on a hosted service you control (Turso). Events are not end-to-end encrypted; add that later if needed.
