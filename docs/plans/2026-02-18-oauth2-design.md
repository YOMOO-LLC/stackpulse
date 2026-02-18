# StackPulse OAuth2 — Design

**Date:** 2026-02-18
**Status:** Approved

---

## Goal

Add OAuth2 authorization for GitHub, Vercel, and Sentry so users can connect these services without manually copying API keys or tokens.

---

## Approach

**Token storage:** Reuse the existing encrypted `connected_services.credentials` column. OAuth tokens are stored as JSON alongside API-key providers — no DB migration required.

```json
{ "access_token": "...", "refresh_token": "...", "expires_at": 1708300000 }
```

---

## Section 1 — Authorization Flow

```
User clicks "Authorize with GitHub" on /connect/github
        ↓
GET /api/oauth/authorize/[provider]
  → Generate random state → store in signed cookie
  → Store label in cookie (optional display name)
  → 302 redirect to provider authorization URL
        ↓
User grants access on provider's page
        ↓
Provider redirects to GET /api/oauth/callback/[provider]?code=xxx&state=yyy
  → Verify state cookie (CSRF protection)
  → POST to provider token URL: exchange code → access_token + refresh_token
  → Encrypt token JSON → INSERT into connected_services.credentials
  → Register QStash schedule
  → 302 redirect to /dashboard
        ↓
QStash polls every 5 minutes:
  → Decrypt credentials → check expires_at
  → If < 10 minutes until expiry → refresh token → update credentials
  → Fetch metrics normally
  → On 401 → retry refresh → on failure → mark auth_expired
```

**New routes:**
- `GET /api/oauth/authorize/[provider]` — generate state, redirect to provider
- `GET /api/oauth/callback/[provider]` — receive code, exchange token, save service

**Modified files:**
- `src/app/(app)/connect/[providerId]/page.tsx` — show OAuth button instead of API key form
- `src/lib/providers/github.ts`, `vercel.ts`, `sentry.ts` — set `authType: 'oauth2'`
- `src/app/api/cron/poll-service/route.ts` — add token refresh before metric fetch
- `src/lib/providers/fetch.ts` — OAuth providers use `access_token` from credentials

---

## Section 2 — Provider OAuth Configuration

| Provider | Authorization URL | Token URL | Scopes | Access Token TTL | Refresh Token |
|----------|------------------|-----------|--------|-----------------|---------------|
| GitHub | `github.com/login/oauth/authorize` | `github.com/login/oauth/access_token` | `read:user` | No expiry | No |
| Vercel | `vercel.com/oauth/authorize` | `api.vercel.com/v2/oauth/access_token` | _(none)_ | 1 year | No |
| Sentry | `sentry.io/oauth/authorize/` | `sentry.io/oauth/token/` | `project:read org:read event:read` | **1 hour** | Yes (24h sliding) |

**New environment variables:**
```bash
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
VERCEL_CLIENT_ID=...
VERCEL_CLIENT_SECRET=...
SENTRY_CLIENT_ID=...
SENTRY_CLIENT_SECRET=...
```

**New lib files:**
```
src/lib/oauth/
  config.ts     — OAuth app config per provider (URLs, scopes, client credentials)
  exchange.ts   — code → token exchange
  refresh.ts    — Sentry token refresh logic
  state.ts      — CSRF state generation and cookie verification
```

---

## Section 3 — Connect Page UI

OAuth providers show an authorize button instead of API key fields:

```
┌─────────────────────────────────────────┐
│  [GH]  Connect GitHub                   │
│        DevOps                           │
├─────────────────────────────────────────┤
│                                         │
│  Display name (optional)                │
│  ┌─────────────────────────────────┐   │
│  │ GitHub                          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🔗  Authorize with GitHub  →   │   │
│  └─────────────────────────────────┘   │
│                                         │
│  You'll be redirected to GitHub to      │
│  grant read-only access.                │
│                                         │
└─────────────────────────────────────────┘
```

**Credential re-auth banner for OAuth services** (when `auth_expired`):

```
┌───────────────────────────────────────────────┐
│ ⚠  Authorization expired.                     │
│    Re-authorize StackPulse to resume.          │
│                          [Re-authorize GitHub] │
└───────────────────────────────────────────────┘
```

Clicking re-authorize restarts the OAuth flow. No manual token input.

**Label persistence:** Label entered before redirect is stored in a cookie, retrieved in callback.

---

## Section 4 — Error Handling & Testing

**OAuth error scenarios:**

| Scenario | Handling |
|----------|---------|
| User cancels on provider page | `error=access_denied` in callback → redirect to `/connect` |
| State mismatch (CSRF) | Return 400, clear cookie |
| Code exchange fails | Redirect to `/connect/[provider]?error=oauth_failed` with UI message |
| Sentry refresh_token expired | Mark `auth_expired` → re-auth banner with Re-authorize button |
| GitHub/Vercel token revoked by user | 401 during poll → mark `auth_expired` |

**Token refresh strategy (hybrid):**
- Before each poll: check `expires_at` — if < 10 minutes → proactively refresh
- On 401 response: attempt refresh as fallback
- On refresh failure: mark `auth_expired`, increment `consecutive_failures`

**Test files:**
- `src/lib/oauth/exchange.test.ts` — code→token exchange (fetch mocked)
- `src/lib/oauth/refresh.test.ts` — Sentry token refresh, expires_at update
- `src/lib/oauth/state.test.ts` — state generation and cookie verification
- `src/app/api/oauth/callback/__tests__/route.test.ts` — happy path, CSRF, error param

**No changes needed:**
- DB schema (reusing `credentials` column)
- Encryption/decryption (`src/lib/crypto.ts`)
- Alert evaluation, email notifications, QStash registration

---

## Out of Scope

- Polling architecture refactor (batching 1000s of services) — separate initiative
- OAuth for other providers (Stripe Connect, OpenAI) — Phase 4+
- Token rotation UI / token revocation management

---

*Approved by: User, 2026-02-18*
