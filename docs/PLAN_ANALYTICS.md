# Plan: product analytics with Google Analytics 4

Goal: learn which parts of Calendaby are used (screens, logging, sharing) without ever sending anything about the baby or the family.

## Decisions

- **The Google Analytics 4 tag (`gtag.js`), not Firebase.** The owner supplied a GA4 measurement ID. One tag works in the browser and inside the Android and iOS apps (their web view loads it like a page), so there is no new npm package, no `google-services.json` and no `GoogleService-Info.plist`. Firebase (`@capacitor-firebase/analytics`, Apache-2.0, needs `firebase` 12+) stays an option if native-only measurement is ever wanted; it would also bring push notifications.
- **Never pasted into `index.html`.** A tag in the page loads for everyone before any choice and records the full address, and an invite link carries a code in its query. `src/analytics.ts` loads the tag only after opt-in and sends `page_location` without the query.
- **Off until the parent turns it on.** Profile > Help improve Calendaby. The choice is the on-device setting `analytics` (`'on'` or `'off'`, absent means off), the same pattern as the reminders switch. Turning it off sets Google's `ga-disable-<id>` flag at once, so nothing more is sent.
- **Measurement only.** Consent mode: analytics storage granted, ad storage, ad user data and ad personalisation denied; Google signals and ad personalisation signals off; no automatic page views.
- **A fixed list, checked before sending.** Events and labels are in one table in `src/analytics.ts`: `screen_view` (`screen`), `log_entry` (`kind`) and `invite_shared`. Anything not on the list is dropped with a console warning, so free text, names, dates, amounts and codes cannot leave the phone. No user id is set.
- **The measurement ID is in code.** It is a public identifier (visible in any page source), not a secret.
- **Tests never call Google.** Unit tests stub the page; the browser tests answer Google's address with an empty script.

## Done

- The switch, the stored choice, the allowed-event table and the loader (`src/analytics.ts`, 6 unit tests).
- Screen opened (name only), kind of entry logged (feed, sleep, diaper, med, note, activity, pump) and invite shared.
- Browser tests (`e2e/analytics.spec.ts`): no request to Google before opt-in; one request after; the disable flag follows the switch; the choice survives a reload.

## Still to do

- Check the events in Google Analytics (Admin > DebugView, or Realtime) from the browser and from a phone. The tag has not been tried against the real Google service or inside the Android and iOS apps.
- A privacy notice before a public release. Google Analytics collects device and usage data by itself (browser, rough location, language), and the app says so only briefly in Profile.
- Possible later events: family joined, install prompt accepted, update applied.
