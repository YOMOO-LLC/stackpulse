# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (port 4567)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

Dev server: http://localhost:4567 (not the default port 3000)

## Tech Stack

- **Next.js 16.1.6** (App Router) + **React 19.2.3**
- **TypeScript** (strict mode)
- **Tailwind CSS v4** (`@import "tailwindcss"` syntax — not the legacy `@tailwind` directives)
- **Supabase** — auth, database (Postgres), realtime subscriptions
- **Upstash QStash** — background metric polling scheduler
- **Resend** — transactional alert emails
- Fonts: Geist Sans + Geist Mono (loaded via `next/font/google`)

## Architecture

Next.js App Router with source under `src/`:

### Route Groups
- `src/app/(auth)/login/` — Login/signup (no sidebar)
- `src/app/(app)/` — Authenticated route group with shared sidebar layout
  - `dashboard/` — Service list overview
  - `dashboard/[serviceId]/` — Service detail: metrics, alerts, events
  - `dashboard/channels/` — Notification channel management
  - `dashboard/history/` — Alert event history
  - `connect/` — Provider selection
  - `connect/[providerId]/` — OAuth authorize button or API key form

### API Routes (`src/app/api/`)
- `services/` — CRUD for connected services; `[id]/sync/` — manual metric collection
- `services/validate/` — Pre-save credential validation
- `services/[id]/credentials/` — Re-auth credential update
- `oauth/authorize/[provider]/` — Redirect to provider OAuth flow
- `oauth/callback/[provider]/` — Token exchange, initial metric collection, QStash registration
- `cron/poll-service/` — QStash webhook: fetch metrics, evaluate alerts, send emails
- `alerts/`, `alert-events/` — Alert rule CRUD and event log
- `channels/`, `channels/test/` — Notification channel CRUD and test send

### Key Libraries
- `src/lib/providers/` — Provider definitions, metric fetch functions, registry
- `src/lib/oauth/` — OAuth2 state/CSRF, token exchange, token refresh
- `src/lib/alerts/engine.ts` — Alert condition evaluation (lt/gt/eq/status_is)
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt for stored credentials
- `src/lib/notifications/email.ts` — Resend email sender
- `src/lib/qstash.ts` — QStash schedule registration/cancellation
- `src/lib/supabase/` — Supabase client (server + browser)

Path alias: `@/*` → `./src/*`

## Providers

Supported providers and their `authType`:

| Provider | Auth | Collectors |
|---|---|---|
| OpenRouter | `api_key` | credit_balance |
| Resend | `api_key` | connection_status |
| Sentry | `oauth2` | error_count |
| Stripe | `api_key` | account_balance |
| GitHub | `oauth2` | rate_limit_remaining, rate_limit_used, graphql_rate_limit_remaining, search_rate_limit_remaining, public_repos |
| Vercel | `oauth2` | bandwidth_used, deployment_status |
| OpenAI | `api_key` | credit_balance, monthly_usage |
| Upstash Redis | `api_key` | daily_commands, memory_usage |
| Upstash QStash | `api_key` | messages_delivered, messages_failed, monthly_quota_used |

Adding a new provider requires:
1. `src/lib/providers/<name>.ts` — `ServiceProvider` definition + fetch function
2. `src/lib/providers/index.ts` — register it
3. `src/lib/providers/fetch.ts` — add a case in `fetchProviderMetrics()`
4. If OAuth2: add config in `src/lib/oauth/config.ts`

## OAuth2 Flow

GitHub, Vercel, and Sentry use OAuth2 Authorization Code flow:

1. `GET /api/oauth/authorize/[provider]` — generates CSRF state cookie, redirects to provider
2. Provider redirects to `GET /api/oauth/callback/[provider]`
3. Callback: verifies state, exchanges code for tokens, encrypts and saves to `connected_services.credentials`, runs initial metric collection, registers QStash schedule

Token storage format in `credentials` column (JSON, AES-256-GCM encrypted):
```json
{ "access_token": "...", "refresh_token": "...", "expires_at": 1234567890, "orgSlug": "..." }
```

In `fetch.ts`, all OAuth providers fall back gracefully: `credentials.access_token ?? credentials.token`.

Sentry only supports proactive token refresh (`supportsRefresh: true`). GitHub and Vercel do not support refresh tokens.

## Credential Encryption

`src/lib/crypto.ts` uses AES-256-GCM. Wire format: `iv(12 bytes) + authTag(16 bytes) + ciphertext`, base64-encoded. Key is a 64-char hex string from `ENCRYPTION_KEY` env var.

## Background Polling

`POST /api/cron/poll-service` is a QStash-verified webhook. For each poll:
1. Decrypts credentials
2. Proactively refreshes OAuth token if `expires_at < now + 600s`
3. Calls `fetchProviderMetrics()` → inserts into `metric_snapshots`
4. Evaluates alert rules via `evaluateAlerts()`
5. Sends email via Resend if rule triggered and cooldown passed
6. Tracks `consecutive_failures`; disables service after 5 consecutive failures

## CSS Theme

Dark-first design system. CSS variables defined in `src/app/globals.css` via Tailwind v4's `@theme inline` block:
- Background: `zinc-950` (`#09090b`)
- Primary: `emerald-500` (`#10b981`)
- Card: `zinc-900` (`#18181b`)

Use `bg-background`, `text-foreground`, `bg-card`, `text-primary` in components.

## TDD Workflow

Test framework: **Vitest** + `@testing-library/react`

```bash
npx vitest              # Watch mode (keep running during development)
npx vitest run          # Single run, all tests
npx vitest run src/path/to/file.test.ts  # Single file
npx vitest --coverage   # Coverage report
```

**Red-Green-Refactor** (required for all features and bug fixes):

1. **Red** — Write a failing test that describes the expected behavior
2. **Green** — Write the minimum implementation to make the test pass
3. **Refactor** — Clean up under green tests

Never write implementation code without a corresponding failing test first.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=          # 64-char hex, AES-256-GCM key for credentials
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
NEXT_PUBLIC_APP_URL=     # Used as OAuth redirect_uri base (default: http://localhost:4567)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
VERCEL_CLIENT_ID=
VERCEL_CLIENT_SECRET=
SENTRY_CLIENT_ID=
SENTRY_CLIENT_SECRET=
```

## Test Account

| Field    | Value                  |
|----------|------------------------|
| Email    | `dev@stackpulse.local` |
| Password | `Test1234!`            |

Seed file: `supabase/seed.sql`. Run `supabase db reset` to recreate the local database with this account.
