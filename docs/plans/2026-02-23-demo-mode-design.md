# Demo Mode Implementation Design

**Date:** 2026-02-23
**Status:** Approved

## Goal

Allow anyone to experience StackPulse without real credentials — a shared demo account with all 11 providers pre-connected, showing realistic storyline metric data, with periodic auto-reset and a manual reset option.

## Requirements

- **Audience:** Both internal development testing and public-facing product demo
- **Entry point:** Dedicated demo account / route (not per-provider "Try Demo" buttons)
- **Interactivity:** Fully operable (add alert rules, rename services, etc.) — not read-only
- **Reset:** Manual "Reset Now" button + GitHub Actions cron every 2 hours
- **Mock data:** Pre-recorded storyline sequences (not random, not static) that show realistic metric progression including alert triggers

---

## Architecture

### Demo Account

A dedicated Supabase user `demo@stackpulse.io` (shared by all demo visitors). Seeded once via `scripts/seed-demo.ts`. The account has 11 `connected_services` rows — one per provider — each storing AES-256-GCM encrypted sentinel credentials:

```json
{ "__demo__": "true" }
```

QStash schedules are **not** registered for demo services. Data is maintained entirely by the reset mechanism.

### Sentinel Detection in `fetch.ts`

```ts
// src/lib/providers/fetch.ts
if (credentials.__demo__ === 'true') {
  return provider.mockFetchMetrics?.() ?? []
}
return provider.fetchMetrics(credentials)
```

`ServiceProvider` interface gains an optional field:
```ts
mockFetchMetrics?: () => Promise<SnapshotResult[]>
```

This makes the poll-service cron route transparent to demo mode — it decrypts credentials, calls `fetchProviderMetrics`, and the sentinel check handles the rest.

---

## Mock Data Layer

### Directory Structure

```
src/lib/providers/demo-sequences/
  index.ts            ← exports all sequences for the reset script
  github.ts
  stripe.ts
  openai.ts
  vercel.ts
  openrouter.ts
  resend.ts
  sentry.ts
  upstash-redis.ts
  upstash-qstash.ts
  minimax.ts
  supabase.ts
```

### Per-File Exports

Each sequence file exports two things:

**① `mockFetchMetrics()`** — returns the "current" snapshot (last data point of the sequence), used by `fetchProviderMetrics` during live polls:

```ts
export function mockFetchMetrics(): SnapshotResult[] {
  return [
    { collectorId: 'rate_limit_remaining', value: 1240, valueText: null, unit: 'requests', status: 'warning' },
    ...
  ]
}
```

Data format mirrors the output of the real `fetchXxxMetrics()` function — not raw API JSON, but post-processed values.

**② `demoSnapshots`** — 48-hour time series seeded into `metric_snapshots` on reset:

```ts
export const demoSnapshots: Array<{
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
  hoursAgo: number   // converted to fetched_at = now() - hoursAgo * 3600s on reset
}> = [ ... ]
```

### Provider Storylines

| Provider | Storyline |
|---|---|
| **GitHub** | Rate limit healthy (4,980) → CI/CD spike consumes it → drops to 1,240, triggers Warning alert |
| **Stripe** | Balance $1,240, 1 active dispute ($89) triggering Critical alert, 3 active subscriptions |
| **OpenAI** | Credits $12.50 → declining to $3.80 (warning < $5), monthly usage $38 of $50 limit |
| **Vercel** | Bandwidth healthy, 3 recent successful deployments |
| **OpenRouter** | Credit balance $8.20, healthy |
| **Resend** | Connection healthy |
| **Sentry** | Error count 5 → rising to 42, Warning state |
| **Upstash Redis** | Memory 40% → growing to 68%, approaching threshold |
| **Upstash QStash** | Normal delivery, 1 failed message |
| **MiniMax** | Connection healthy |
| **Supabase** | Connection healthy |

---

## Reset Mechanism

### `POST /api/demo/reset`

Accepts two authorization methods:
1. `Authorization: Bearer <DEMO_RESET_SECRET>` — for GitHub Actions
2. Authenticated Supabase session of the demo user — for the in-app "Reset Now" button

Reset flow:
1. Authenticate (either method)
2. Query all `connected_service_id` values for the demo user
3. Delete all `metric_snapshots` and `alert_events` for those services
4. Re-insert `demoSnapshots` from all 11 sequence files (converting `hoursAgo` to real `fetched_at` timestamps)
5. Re-seed default `alert_configs` from each provider's `alerts` template (delete existing, insert fresh)
6. Reset `connected_services` fields: `consecutive_failures = 0`, `auth_expired = false`
7. Return `{ ok: true, reset_at: "<iso timestamp>" }`

Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS — no session management complexity.

### Demo Banner (Dashboard)

Shown when `user.email === process.env.NEXT_PUBLIC_DEMO_EMAIL`:

```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 Demo Mode  ·  Data resets automatically every 2 hours       │
│                                          [Reset Now]  [Dismiss] │
└─────────────────────────────────────────────────────────────────┘
```

"Reset Now" calls `POST /api/demo/reset` with the user's Supabase session cookie (no secret exposure to client).

### GitHub Actions: `.github/workflows/demo-reset.yml`

```yaml
name: Reset Demo Data
on:
  schedule:
    - cron: '0 */2 * * *'   # every 2 hours
  workflow_dispatch:          # manual trigger

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - name: Reset demo data
        run: |
          curl -X POST ${{ vars.NEXT_PUBLIC_APP_URL }}/api/demo/reset \
            -H "Authorization: Bearer ${{ secrets.DEMO_RESET_SECRET }}" \
            -f
```

---

## One-Time Seed Script

### `scripts/seed-demo.ts`

Run once at initial deployment:

1. Create `demo@stackpulse.io` via Supabase Admin API
2. Insert 11 `connected_services` rows with encrypted sentinel credentials
3. Call `POST /api/demo/reset` to seed initial metric data

```bash
npx tsx scripts/seed-demo.ts
```

Does **not** register QStash schedules.

---

## Login Entry Points

### Login Page Button

`src/app/(auth)/login/page.tsx` — below the sign-in form:

```
─────── or ───────
[  🎭 Try Demo — no sign-up needed  ]
```

Calls `POST /api/demo/login` → signs in with demo credentials via Supabase client → redirects to `/dashboard`.

### `GET /demo` Route

Server component at `src/app/demo/page.tsx`. Auto-executes demo login, redirects to `/dashboard`. Used as a shareable shortlink (e.g., on the landing page).

---

## New Environment Variables

```bash
NEXT_PUBLIC_DEMO_EMAIL=demo@stackpulse.io   # client-visible, used for banner detection
DEMO_USER_PASSWORD=<strong random password>  # seed script only, never exposed to client
DEMO_RESET_SECRET=<strong random token>      # reset endpoint + GitHub Actions secret
```

---

## Files Changed

| File | Action |
|---|---|
| `src/lib/providers/types.ts` | Add optional `mockFetchMetrics?` to `ServiceProvider` |
| `src/lib/providers/fetch.ts` | Add sentinel detection (`__demo__` check) |
| `src/lib/providers/github.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/stripe.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/openai.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/vercel.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/openrouter.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/resend.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/sentry.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/upstash-redis.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/upstash-qstash.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/minimax.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/supabase.ts` | Add `mockFetchMetrics`, register on provider object |
| `src/lib/providers/demo-sequences/index.ts` | New — aggregates all sequences |
| `src/lib/providers/demo-sequences/github.ts` | New |
| `src/lib/providers/demo-sequences/stripe.ts` | New |
| `src/lib/providers/demo-sequences/openai.ts` | New |
| `src/lib/providers/demo-sequences/vercel.ts` | New |
| `src/lib/providers/demo-sequences/openrouter.ts` | New |
| `src/lib/providers/demo-sequences/resend.ts` | New |
| `src/lib/providers/demo-sequences/sentry.ts` | New |
| `src/lib/providers/demo-sequences/upstash-redis.ts` | New |
| `src/lib/providers/demo-sequences/upstash-qstash.ts` | New |
| `src/lib/providers/demo-sequences/minimax.ts` | New |
| `src/lib/providers/demo-sequences/supabase.ts` | New |
| `src/app/api/demo/reset/route.ts` | New |
| `src/app/api/demo/login/route.ts` | New |
| `src/app/(auth)/login/page.tsx` | Add Try Demo button |
| `src/app/demo/page.tsx` | New — shortlink entry point |
| `src/components/demo-banner.tsx` | New |
| `src/app/(app)/dashboard/page.tsx` | Add `<DemoBanner />` |
| `scripts/seed-demo.ts` | New |
| `.github/workflows/demo-reset.yml` | New |
| `.env.example` | Add 3 new env vars |
