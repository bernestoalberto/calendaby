# Plan: product analytics with Firebase

Goal: learn which parts of Calendaby are used (screens, logging, sharing, installs) without ever sending anything about the baby or the family.

## Decisions

- **One plugin for every platform: `@capacitor-firebase/analytics`.** Apache-2.0, about 160 KB, updated September 2026, works on the web, Android and iOS from one call. Peer dependency: `firebase` 12 or newer. Alternative rejected: the raw Android SDK, which would leave the web app (the main way Carolina uses it) uncovered.
- **Off until the parent turns it on.** A baby log is sensitive, so collection starts disabled and a switch in Profile > Privacy enables it. The choice is stored on the phone (`settings`, key `analytics`) and is read before any event is sent. Changing it takes effect immediately. If the owner prefers on-by-default with an opt-out, that is a one-line change, but it needs the privacy notice first.
- **Only what the owner would be comfortable seeing in a report.** Events carry a name and a few fixed labels, never free text. Allowed: screen opened (`today`, `timeline`...), kind of entry logged (`feed`, `diaper`...), invite shared, family joined, install, update applied. Never sent: baby name, birth date, notes, amounts, times of day, caregiver names, emails, invite codes, anything typed or spoken.
- **A fixed list in code, checked before sending.** `src/analytics.ts` accepts only event names from one list and parameters from fixed values; anything else is dropped and logged to the console (rule 4). No user id is set, so events are not tied to an account.
- **Configuration, not secrets, in the app.** The Firebase web config (`VITE_FIREBASE_*`) goes in `.env.local` and in the Vercel project settings, documented in `.env.example`. `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are downloaded from the Firebase console, kept out of git and listed in `.gitignore`.
- **No analytics in tests.** Vitest and Playwright use a stand-in that records events (rule 3).

## Phases

1. **Switch and gate.** The setting, the Profile > Privacy switch and `src/analytics.ts` with the allowed list and a no-op when off. Done when: with the switch off nothing is called; with it on only listed events pass; a test shows free text and unknown names are dropped.
2. **Web.** Add the plugin and `firebase`, initialise from `VITE_FIREBASE_*`, log screen opens. Done when the Firebase DebugView shows `screen_view` from the browser and nothing when the switch is off.
3. **Android and iOS.** `google-services.json` and `GoogleService-Info.plist` in place, `npm run cap:sync`. Done when DebugView shows events from a phone.
4. **Events.** Entry kind logged, invite shared, family joined, install prompt accepted. Done when each appears once per action and carries no free text.

## Needed from the owner before phase 2

- A Firebase project with a Web app, an Android app (package name from `android/app/build.gradle`) and an iOS app, and the config values.
- Confirmation of off-until-enabled, and a short privacy notice wording before this ships publicly. Google Analytics collects device and usage data by itself, so the notice must say so.
