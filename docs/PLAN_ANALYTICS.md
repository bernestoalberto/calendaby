# Plan: product analytics with Google Tag Manager and Google Analytics 4

Goal: learn which parts of Calendaby are used (screens, logging, sharing) without ever sending anything about the baby or the family.

## Decisions

- **Tag Manager (container `GTM-P2BQ7L9N`) on the web version only; GA4 (`G-MEV4FXM7CK`) is a tag inside it.** The owner asked for Tag Manager for the web. The phone apps (Android and iOS) measure nothing and do not show the switch. There is one sender (the container), so nothing is counted twice. The direct GA4 tag built earlier was removed.
- **Never pasted into `index.html`.** A snippet in the page loads for everyone before any choice, and the `<noscript>` iframe is useless in a JavaScript-only app. `src/analytics.ts` injects the container only after opt-in.
- **Off until the parent turns it on.** Profile > Help improve Calendaby. The choice is the on-device setting `analytics` (`'on'` or `'off'`, absent means off), the same pattern as the reminders switch.
- **Turning it off stops it in three ways:** no more events are handed over, consent mode is updated to `analytics_storage: denied` (the GA4 tag in the container must respect it, see below), and Google's `ga-disable-G-MEV4FXM7CK` flag is set.
- **Measurement only.** Consent defaults: analytics granted, ad storage, ad user data and ad personalisation denied.
- **A fixed list, checked before anything reaches the container.** One table in `src/analytics.ts`: `screen_opened` (`screen`), `log_entry` (`kind`) and `invite_shared`. Anything else is dropped with a console warning, so free text, names, dates, amounts and codes cannot leave the phone. No user id is set. (`screen_view` is a reserved Google name, hence `screen_opened`.)
- **The page address without its query.** An invite link carries a code, so the app puts `cleanLocation` (origin and path only) in the data layer. The container must use it instead of the real address.
- **The two IDs are in code.** They are public identifiers, visible in any page source, not secrets.
- **Tests never call Google.** Unit tests stub the page; the browser tests answer Google's address with an empty script, and one proves typed text never reaches the data layer.

## Set up in Tag Manager (owner, once)

The container is empty until these are added; until then the switch works but Google Analytics sees nothing.

1. **Variables > New > Data Layer Variable:** `cleanLocation`; also `screen` and `kind` (Data Layer Variable Version 2).
2. **Tag 1, "Google tag":** Tag ID `G-MEV4FXM7CK`; trigger: Initialization - All Pages. Under Configuration settings add `send_page_view` = `false`, `allow_google_signals` = `false` and `page_location` = `{{cleanLocation}}`. In Advanced settings > Consent Settings choose "Require additional consent" and add `analytics_storage`, so Tag Manager stops it when consent is denied.
3. **Tag 2, "GA4 event":** Event name `{{Event}}`; parameters `screen` = `{{screen}}` and `kind` = `{{kind}}`; trigger: Custom Event, matching with RegEx `^(screen_opened|log_entry|invite_shared)$`.
4. **Do not enable the built-in Click, Form, Scroll or History variables or triggers, and do not add other tags.** They can read text and addresses from the screen, which is exactly what the fixed list is there to prevent. Anyone with edit rights in this container can change what is collected, so share it sparingly.
5. **Preview** (Tag Assistant) against the site, then **Submit** to publish. Check Admin > DebugView or Realtime in Google Analytics.

## Done

- The switch, the stored choice, the allowed-event table, the loader and consent handling (`src/analytics.ts`, 7 unit tests).
- Screen opened (name only), kind of entry logged (feed, sleep, diaper, med, note, activity, pump) and invite shared.
- Browser tests (`e2e/analytics.spec.ts`): no request to Google before opt-in; the container address after; the disable flag follows the switch; only listed events reach the data layer and never typed text; the choice survives a reload.

## Still to do

- The Tag Manager setup above, then a check in Google Analytics. Nothing has been tried against the real Google services.
- A privacy notice before a public release. Google Analytics collects device and usage data by itself (browser, rough location, language), and the app says so only briefly in Profile.
- Possible later events: family joined, install prompt accepted, update applied.
