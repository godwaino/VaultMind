# VaultMind — Deployment (Vercel)

Target is **Vercel**, not Docker (the backend is serverless by design; ARCHITECTURE §4.1). There are two deployable Next.js projects in this monorepo, both sharing the `@vaultmind/*` packages:

| Vercel project | Root directory | Serves |
|---|---|---|
| `vaultmind-api` | `backend` | API route handlers (`/api/auth`, `/api/contractscan/analyze`, `/api/billing/webhook`, `/api/health`) |
| `vaultmind-web` | `apps/web` | Companion web UI + `/api/health` |

(You can later merge these into one project; kept separate here so the API can scale/secure independently.)

## What's already done (in this repo)

- Route handlers are written and **unit-tested**, and now **degrade gracefully**: every integration route returns a clean **501 `not_configured`** (not a 500 crash) until its env vars are set, so a fresh deploy is immediately healthy.
- **Health checks**: `GET /api/health` on both projects (the API one also reports which integrations are configured, as booleans — never secret values).
- `next.config.js` for both projects (`transpilePackages` + `output: standalone`).

## One-time dev-machine setup (can't run in the test sandbox)

The Next.js toolchain isn't installed here to keep the test/CI sandbox lean. On a dev machine:

```bash
# API project
cd backend
npm install next@latest react@latest react-dom@latest
npm run build          # next build — verifies the API compiles
npm run dev            # local: http://localhost:3000/api/health

# Web project
cd ../apps/web
npm install next@latest react@latest react-dom@latest
npm run build
```

(Once installed, commit the updated lockfile so Vercel's `npm ci` matches.)

## Deploy steps

1. Push the repo to GitHub (already version-controlled).
2. In Vercel, **New Project** → import the repo **twice**, once per row above, setting the **Root Directory** accordingly.
3. Set **Environment Variables** from `.env.example`:
   - **API project:** all the server-only secrets (`SUPABASE_*`, `GEMINI_API_KEY`/`GEMINI_MODEL`, `PAYSTACK_SECRET_KEY` + plan codes, `RESEND_*`, SMS provider, `ENTITLEMENT_CLAIM_SECRET`, `UPSTASH_*`, `SENTRY_DSN`).
   - **Web project:** the `EXPO_PUBLIC_*`-equivalent public values it needs (Supabase URL + anon key, Paystack public key, API base URL). No server secrets.
4. Deploy. Hit `/api/health` on each — it should return `200`. Routes for unconfigured integrations return `501` until their env is added; once added they go live with no code change.

## Notes

- **Function duration:** ContractScan Tier-2 streaming (≤60 s target) may need Vercel **Pro / Fluid compute**; the Hobby limit is shorter.
- **Paystack webhook** already reads the raw body before parsing (required for HMAC verification on Vercel).
- **`node:sqlite`** is not used in the backend (search runs on-device / wa-sqlite in the browser), so no runtime flags are needed on Vercel.
- **Migrations:** run `supabase db push` (or the dashboard) for `supabase/migrations/*` before first real traffic.
