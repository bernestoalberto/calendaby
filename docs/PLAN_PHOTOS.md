# Plan: profile pictures for the caregiver and the baby

Goal: each caregiver can set their own picture, and the family has one baby picture that every phone shows.

## Decisions

- **Caregiver picture is personal.** It lives only in the phone's SQLite (`settings`, key `caregiverPhoto`). Other caregivers do not see it. Sharing it later would need a per-member field on the server.
- **Baby picture is shared.** One per household, stored on the server and copied to every phone, so the owner and the other caregivers always show the same face.
- **It cannot ride on shared settings.** Those values are capped at 60 characters (`src/domain/sharedSettings.ts`). The photo gets its own server table, `household_photo` (household id, bytes as a data URL, updated at), added as a new migration. The last write wins, like the other shared settings.
- **Pictures are shrunk on the phone before they are stored or sent:** centre-cropped to a 256 px square JPEG, about 15 to 30 KB. The server refuses anything that is not a `data:image/jpeg;base64,` string under 64 KB. Zod checks it on both sides (rule 4).
- **No new package.** The browser's file input (`<input type="file" accept="image/*">`) opens the photo library or camera on iPhone and Android, and a canvas does the crop. Nothing to install (rule 8).
- **No photo means today's look:** the initial or icon already shown.

## Phases

1. **Caregiver picture, on the phone.** Change photo and Remove photo on the Caregiver card; shown in the top bar avatar and on the caregiver's log lines. Done when: choosing a large photo stores a small square, a reload keeps it, and removing it brings back the initial.
2. **Baby picture, on the phone.** Same control on the baby card in Profile; shown next to the baby's name in the top bar and on Today. Done when: it survives a reload and shows signed out.
3. **Baby picture shared.** Server table and two routes (`getBabyPhoto`, `setBabyPhoto`), pulled with the settings sync and pushed when changed. Done when, in `backend/sync.test.ts`: Mom sets a photo, Dad's phone shows it after one sync; Dad changes it, Mom sees the change; a non-member cannot read or set it; an oversized or non-image value is rejected.

## Not in scope

A picture on each log line from other caregivers, cropping controls beyond centre-crop, and sharing caregiver pictures.
