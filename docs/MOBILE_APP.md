# VaultMind — Mobile App (Expo / React Native)

The primary, privacy-maximum surface: hardware-backed keys, on-device storage, and (when the native AI is wired) on-device OCR + SLM. Shares the same `@vaultmind/*` packages as the web companion and backend — one implementation of the logic.

> **Verification caveat (important):** this app was written without a React Native toolchain or device in the build sandbox, so it has **not been compiled or run**. The domain logic underneath is the same code passing 128 unit tests, and the screens mirror the verified web app — but expect to fix a few small things on the first `expo start`. Run/verify on a dev machine.

## What's built

| Area | Where | Notes |
|---|---|---|
| Expo config + router + polyfilled entry | `app.json`, `index.ts`, `metro.config.js`, `babel.config.js` | `react-native-get-random-values` + `react-native-quick-crypto` provide the RNG + WebCrypto `subtle` that `@vaultmind/crypto` needs |
| **Hardware-backed keys** | `lib/keys.ts` | LMK in Keychain/Keystore via `expo-secure-store` — the mobile privacy advantage over the browser |
| Encrypted blob store | `lib/files.ts` | `expo-file-system`, AES-256-GCM ciphertext from `EncryptedFileStore` |
| Metadata + tracking DB | `lib/db.ts` | `expo-sqlite` implementing `DocRepo` / `TrackingRepo` |
| **Real FTS5 search** | `lib/db.ts` + `lib/search.ts` | a sync `expo-sqlite` driver into the shared `SearchIndex` — real FTS5 on device |
| **Real reminder scheduling** | `lib/expiry.ts` | `expo-notifications` `NotificationScheduler` — schedules local OS notifications at the computed reminder dates |
| Auth + session | `lib/supabase.ts`, `lib/session.tsx` | Supabase with AsyncStorage session persistence |
| API client | `lib/api.ts` | register, ContractScan (cloud Gemini), export, delete |
| Document ingest | `lib/vault.ts` | pick → read → validate → SHA-256 dedup → encrypt → store |
| Screens | `app/**` | landing, sign in/up, tabs: dashboard, documents (pick/upload/search), document view (decrypt), ExpiryGuard (track + urgency + travel-readiness + real reminders), ContractScan (cloud, consent), settings (consent, recovery phrase, delete) |

## Still needs native integration (the genuinely hard parts)

- **On-device OCR (Tesseract)** and **on-device SLM (llama.rn)** for ContractScan Tier 1 and auto-categorisation/metadata extraction. Today, mobile ingest stores the file and takes **manual** title/category/expiry (like the web companion); the `vault-core` pipeline ports exist to drop these in. **Gated on the week-1 device test** (DECISIONS #3/#8).
- **PDF inline preview** (images preview inline now; PDFs decrypt to a temp file — add `expo-sharing`/a PDF viewer to open them in-app).
- A native **date picker** (`@react-native-community/datetimepicker`) — dates are typed as `YYYY-MM-DD` for now.
- App **icons/splash** assets, and the ContractScan upload UI polish.
- Persist the Consent Centre toggles to the backend `consent_events` table.

## Run it (dev machine)

```bash
cd apps/mobile
npm install                       # installs Expo SDK 51 + RN + native modules
# configure (either EXPO_PUBLIC_* env or app.json "extra"):
#   EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_BASE_URL
npx expo start                    # Expo Go for JS-only; a dev build for the native modules
```

`react-native-quick-crypto`, `expo-secure-store`, `expo-sqlite`, and `expo-notifications` are native modules, so use a **development build** (`npx expo run:ios` / `run:android`) or EAS — Expo Go won't include them.

### EAS build (store binaries)
```bash
npm i -g eas-cli && eas build:configure
eas build --platform ios       # and android
```

## Polyfill order (don't change)
`index.ts` loads `react-native-get-random-values` then installs `react-native-quick-crypto` **before** `expo-router/entry`, so `crypto.getRandomValues` and `crypto.subtle` exist before any `@vaultmind/crypto` call.
