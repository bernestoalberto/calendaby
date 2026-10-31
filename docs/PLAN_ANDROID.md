# Plan: accessibility and current Android practices

Goal: the web app and the Android app (one shared web code base inside Capacitor 8) follow current accessibility and Android practice. The ideas come from Google's accessibility updates (Rambler, Guided Vision, Motion Assist, scalable text, Reading Mode, keyboard navigation) and from Android's current platform rules. Pixel- and Android 17-only features cannot be added to an app; the ideas behind them can.

## Done

- **Reduce motion** (like Motion Assist, and for people sensitive to movement): when the device says "reduce motion" (Android: Remove animations), the CSS turns animations and transitions off and chat scrolling jumps instead of gliding (`src/App.css`, `src/motion.ts`).
- **Listen** (audio help, like Guided Vision): a button on every agent reply and on the handoff reads it with the device's own voice (`src/readAloud.ts`, `src/ui/Listen.tsx`). The text is turned into plain sentences first (no symbols, links said as their label, steps counted) by `speakable()` in `src/domain/replyBlocks.ts`. It is hidden when the device has no speech.
- **Cleaner voice input** (like Rambler): "um", "uh", "hmm" are removed from what the microphone heard before it is parsed (`src/domain/spoken.ts`).
- **Screen readers and keyboards:** a "Skip to main content" link as the first Tab stop, a focusable main area, and the chat is a polite live region so TalkBack and other readers announce each new reply.
- **Themed app icon:** the launcher icons have a monochrome layer, so Android 13+ can tint the icon to the wallpaper (`android/app/src/main/res/mipmap-anydpi-v26/`). It reuses the foreground art; look at it on a phone with themed icons on.
- Browser tests in `e2e/accessibility.spec.ts`; unit tests for each helper.

## Already right (checked in the repo)

- Target SDK 36, which Google Play requires for new apps and updates from August 31, 2026 ([Play requirement](https://developer.android.com/google/play/requirements/target-sdk)).
- Edge-to-edge is enforced for apps that target API 36, and Capacitor 8 provides the safe-area values; the layout already uses `env(safe-area-inset-*)` ([Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16), [Capacitor edge-to-edge guide](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/)).
- Predictive back is on by default at API 36 on Android 16; the app does not intercept the back key itself.
- No fixed screen orientation, so large screens and foldables are not blocked.
- Pinch-zoom is allowed (no `maximum-scale` in the viewport); `overflow-x: clip` on `html` stops the page sliding sideways.
- Over-the-air web updates (`@capgo/capacitor-updater`, `src/liveUpdate.ts`) are NOT working yet. Still to do: choose a source (a Capgo account, or a self-hosted `updateUrl` in `capacitor.config.ts`), run `npx cap sync`, ship a new APK, then upload bundles. Until then the app only updates through Play. Check the privacy text before pointing at Capgo's cloud, since it sees the device and app ids. `resetWhenUpdate` drops a downloaded bundle on each Play update, so the new APK may briefly carry older web code than the last OTA bundle.

## To check on a phone (not verifiable from the code)

- **Text size.** Settings > Display > Font size at the largest value: does the text grow, and does anything get cut off? About 84 font sizes in `src/App.css` are in `px`; if the web view ignores the system size, move them to `rem`.
- **TalkBack.** Walk through Today > log an entry > Agent > Listen. Every button needs a sensible spoken name; Voice Access works best when the visible label and the spoken name match.
- **16 KB memory pages.** Required by Google Play for apps with native code. The only native library is SQLCipher 4.17.0 (from `@capacitor-community/sqlite`), a recent release that should comply. Confirm on the release bundle with Android Studio's APK Analyzer, or `zipalign -c -P 16 -v 4 app.apk`.
- **Edge-to-edge** on a phone with gesture navigation and a camera cut-out: nothing hidden behind the bars.
- **Android 17 (API 37).** Only secondary sources were found; read the official behavior-changes page before raising the target.

## Candidates, in the order I would do them

1. **App shortcuts** (long-press the icon: Log feed, Diaper, Sleep). Reuses the `web+calendaby:` link work; needs a device to test.
2. **`allowBackup`.** Currently on, so the on-device baby log can end up in Google backups. Off is the privacy-safer choice for a signed-in app whose data also lives on the server. Owner's decision.
3. **Home-screen widget** (last feed and sleep at a glance, one-tap log). Needs native code.
4. **Quick Settings tile** to start a feed timer. Native code.
5. **Notification polish:** separate channels for reminders and for appointment finds, so each can be muted on its own.
6. **Large-screen layout.** The app is one narrow column, centred; a two-column Today on tablets would use the space.
7. **Text size and contrast options** in Profile > Look & feel beyond the three sizes (and high-contrast), once the system font-size check above is done.
