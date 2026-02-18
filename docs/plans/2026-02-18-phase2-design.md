# StackPulse Phase 2 — Production MVP Design

**Date:** 2026-02-18
**Status:** Approved

---

## Goal

Transform StackPulse from a static prototype into a real-time monitoring platform: continuous background metric collection, email alert notifications, 5 new providers, and a complete product UI (landing page, global history, notification channels, credential re-auth).

---

## Approach Selected

**Method B — Complete MVP**

User decisions:
- Background scheduling: **Upstash QStash** (one independent schedule per service, horizontally scalable)
- Notifications: **Email first via Resend** (already integrated, zero new dependencies)
- Scope: All of A+B+C (polling engine, new providers, UX completeness)

---

## Section 1 — Background Collection Engine

### Architecture

```
Service connected → register QStash schedule (*/5 * * * *)
                         ↓ every 5 minutes
QStash → POST /api/cron/poll-service  { serviceId }
                         ↓
  1. Fetch connected_service + decrypt credentials
  2. Call provider API → collect latest metrics
  3. INSERT INTO metric_snapshots
  4. Check all enabled alert_configs:
       threshold crossed?
         Yes → INSERT INTO alert_events
             → update alert_configs.last_notified_at
             → send Resend email (if cooldown elapsed)
  5. On success: reset consecutive_failures = 0
     On failure: consecutive_failures += 1
                 ≥ 5 failures → auth_expired = true, cancel QStash schedule
```

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/cron/poll-service` | POST | QStash worker endpoint — collect + check alerts |
| `/api/cron/register` | POST | Register QStash schedule when service is connected |
| `/api/cron/unregister` | POST | Cancel QStash schedule when service is deleted |
| `/api/services/[id]/credentials` | PATCH | Re-enter credentials after auth_expired |

### QStash Integration

- On service connect: `POST https://qstash.upstash.io/v2/schedules` with cron `*/5 * * * *`
- Request body: `{ destination: "/api/cron/poll-service", body: { serviceId } }`
- Store returned `scheduleId` in `connected_services.qstash_schedule_id`
- On service delete: `DELETE https://qstash.upstash.io/v2/schedules/{scheduleId}`
- Security: verify QStash signature on every incoming request using `QSTASH_CURRENT_SIGNING_KEY`

### Database Changes

```sql
-- Add QStash schedule tracking
ALTER TABLE connected_services
  ADD COLUMN qstash_schedule_id text;

-- Add notification cooldown to prevent spam
ALTER TABLE alert_configs
  ADD COLUMN last_notified_at timestamptz;

-- Auto-cleanup old snapshots (keep 7 days)
-- Implemented as pg_cron job running nightly:
-- DELETE FROM metric_snapshots WHERE fetched_at < NOW() - INTERVAL '7 days';
```

### Environment Variables

```
QSTASH_TOKEN=...               # Upstash QStash API token
QSTASH_CURRENT_SIGNING_KEY=... # For request verification
QSTASH_NEXT_SIGNING_KEY=...    # For key rotation
```

---

## Section 2 — Notification System

### Email via Resend

Alert email triggered inside `/api/cron/poll-service` when:
1. A metric crosses its configured threshold
2. `last_notified_at` is NULL or older than 1 hour (cooldown)

```typescript
// Pseudocode inside poll-service
for (const rule of triggeredRules) {
  const cooldownElapsed = !rule.last_notified_at ||
    Date.now() - new Date(rule.last_notified_at).getTime() > 3600_000

  if (cooldownElapsed) {
    await resend.emails.send({
      from: 'alerts@stackpulse.app',
      to: user.email,
      subject: `[StackPulse] Alert: ${rule.name} on ${service.label}`,
      html: renderAlertEmail({ service, rule, triggeredValue }),
    })
    await supabase.from('alert_configs')
      .update({ last_notified_at: new Date().toISOString() })
      .eq('id', rule.id)
  }
}
```

### Email Template

```
Subject: [StackPulse] Alert: Low Credits on OpenRouter

Service:    OpenRouter (My API Key)
Metric:     Credit Balance
Condition:  is less than $5.00
Value now:  $3.47

Triggered at: Feb 18, 2026, 14:32 UTC

──────────────────────────────────
View service → https://stackpulse.app/dashboard/{serviceId}
Manage alerts → https://stackpulse.app/dashboard/{serviceId}
```

### `/dashboard/channels` Page

```
NOTIFICATION CHANNELS

  Email
  ┌─────────────────────────────────────────┐
  │ ● dev@example.com           [Edit]       │
  │   Alerts sent to your account email      │
  │                    [Send test alert]      │
  └─────────────────────────────────────────┘

  Slack                    [Coming soon]
  Discord                  [Coming soon]
  Custom Webhook           [Coming soon]
```

- Default email = account email (from auth.users)
- User can override with custom address stored in `notification_channels` table
- "Send test alert" calls `POST /api/channels/test`

### Notification Channel API

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/channels` | GET | List user's notification channels |
| `POST /api/channels` | POST | Create/update channel (type: email) |
| `POST /api/channels/test` | POST | Send test alert email |

---

## Section 3 — New Providers (5)

All providers follow the existing pattern:
1. `src/lib/providers/{name}.ts` — fetch + parse metrics
2. `src/lib/providers/index.ts` — `registerProvider(...)`
3. `/api/cron/poll-service` switch case

### 1. Stripe

```
Auth:       API Key (restricted, read-only)
Collectors:
  • account_balance   currency  USD  — available balance
  • monthly_revenue   currency  USD  — month-to-date charges
Endpoints:
  • GET https://api.stripe.com/v1/balance
  • GET https://api.stripe.com/v1/charges?created[gte]={startOfMonth}&limit=100
Alert templates:
  • Low Balance < $100
```

### 2. GitHub

```
Auth:       Personal Access Token
Collectors:
  • actions_minutes_used   count   minutes — current billing cycle usage
  • actions_minutes_limit  count   minutes — plan allowance
Endpoint:   GET https://api.github.com/user/settings/billing/actions
Alert templates:
  • Actions usage > 80%
```

### 3. Vercel

```
Auth:       API Token
Collectors:
  • bandwidth_used    count   GB    — current period bandwidth
  • deployment_status status        — latest deployment status
Endpoints:
  • GET https://api.vercel.com/v2/usage
  • GET https://api.vercel.com/v6/deployments?limit=1
Alert templates:
  • Bandwidth > 80 GB
  • Deployment failed
```

### 4. OpenAI

```
Auth:       API Key
Collectors:
  • credit_balance    currency  USD  — prepaid credit balance
  • monthly_usage     currency  USD  — current month spend
Endpoints:
  • GET https://api.openai.com/v1/dashboard/billing/credit_grants
  • GET https://api.openai.com/v1/dashboard/billing/usage
Alert templates:
  • Low Credits < $5
  • High monthly usage > $50
```

### 5. Upstash (two sub-providers)

#### Upstash Redis

```
Auth:       Upstash Email + API Key
Collectors:
  • daily_commands    count       commands — today's command count
  • memory_usage      percentage  %        — memory utilization
  • daily_bandwidth   count       KB       — today's bandwidth
Endpoint:   GET https://api.upstash.com/v2/redis/stats/{database_id}
Alert templates:
  • Memory usage > 80%
  • Daily commands > 8000
```

#### Upstash QStash

```
Auth:       QStash Token
Collectors:
  • messages_delivered   count       messages — month-to-date delivered
  • messages_failed      count       messages — month-to-date failed
  • monthly_quota_used   percentage  %        — quota utilization
Endpoint:   GET https://qstash.upstash.io/v2/stats
Alert templates:
  • Quota usage > 80%
  • Failed messages > 10
```

### Connect Page Layout Update

```
AI / LLM          OpenRouter    OpenAI
Email             Resend
Monitoring        Sentry
Payments          Stripe
DevOps            GitHub    Vercel
Infrastructure    Upstash Redis    Upstash QStash
```

---

## Section 4 — New Pages

### 4.1 Landing Page `/`

- Unauthenticated: show marketing content + [Log in] / [Get started] buttons
- Authenticated: redirect to `/dashboard`
- Static page, no data fetching needed
- Content: headline, subheadline, provider logo grid (static), single CTA

```
┌────────────────────────────────────────────────────┐
│  SP StackPulse                    [Log in]  [Start] │
├────────────────────────────────────────────────────┤
│                                                    │
│   Monitor all your API services                    │
│   in one place.                                    │
│                                                    │
│   Credits, errors, status — get alerted            │
│   before your users notice.                        │
│                                                    │
│        [Connect your first service →]              │
│                                                    │
├────────────────────────────────────────────────────┤
│  Provider logos: OpenRouter  Resend  Sentry        │
│                  Stripe  GitHub  Vercel  OpenAI    │
└────────────────────────────────────────────────────┘
```

### 4.2 Global Alert History `/dashboard/history`

- All alert events across all of the user's services
- Newest first, paginated (20 per page)
- Filter by service, time range
- Reuses `/api/alert-events` route (without `serviceId` param = all services)

```
ALERT HISTORY

  [All services ▾]  [Last 7 days ▾]

  ──────────────────────────────────────────────────
  ▲  Feb 18, 14:32   OpenRouter      Low Credits   $3.47
  ✕  Feb 17, 09:15   Sentry          High Errors   143
  ▲  Feb 15, 22:01   Upstash Redis   Memory high   84%
  ──────────────────────────────────────────────────
                                         [Load more]
```

### 4.3 Credential Re-auth Flow

When `auth_expired = true`:

**ServiceCard** — shows red banner:
```
┌──────────────────────────────────────┐
│ ⚠️  Credentials expired    [Update]  │
└──────────────────────────────────────┘
```

**Service Detail Page** — top banner:
```
┌───────────────────────────────────────────────────────┐
│ ⚠️  API credentials have expired or are invalid.      │
│     Re-enter your API key to resume monitoring.       │
│                               [Update credentials]    │
└───────────────────────────────────────────────────────┘
```

Clicking "Update credentials" → inline form expands:
- Same fields as initial connect form
- On submit: `PATCH /api/services/[id]/credentials`
- Validates new credentials before saving
- On success: clears `auth_expired`, resets `consecutive_failures = 0`, re-registers QStash schedule

### 4.4 Updated Sidebar Structure

```
SP StackPulse
─────────────────
● OR  OpenRouter
● RS  Resend
▲ SN  Sentry
─────────────────
   History          /dashboard/history
   Channels         /dashboard/channels
─────────────────
+ Add Service
─────────────────
  dev@example.com  [logout]
```

---

## Section 5 — Realtime UI Updates

### Strategy: Supabase Realtime

Subscribe to `metric_snapshots` INSERT events in the service detail page:

```typescript
// metric-section.tsx (client component)
useEffect(() => {
  const channel = supabase
    .channel(`snapshots:${serviceId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'metric_snapshots',
      filter: `connected_service_id=eq.${serviceId}`,
    }, (payload) => {
      addSnapshot(payload.new as Snapshot)
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [serviceId])
```

### Dashboard ServiceCard Sync

Subscribe to metric_snapshots globally (user's services) to update ServiceCard status dots and values without page reload.

### Alert Toast Notifications

Subscribe to `alert_events` INSERT:

```
┌─────────────────────────────────────────────┐
│ ▲  OpenRouter — Low Credits triggered $3.47 │
└─────────────────────────────────────────────┘
```

Show for 5 seconds, auto-dismiss. Use Sonner or a custom toast implementation.

### RLS Policy for Realtime

```sql
-- Allow authenticated users to receive realtime events for their own data
CREATE POLICY "Users can subscribe to their metric snapshots"
  ON public.metric_snapshots
  FOR SELECT
  USING (
    connected_service_id IN (
      SELECT id FROM public.connected_services
      WHERE user_id = auth.uid()
    )
  );
```

---

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@upstash/qstash` | QStash SDK for schedule management + request verification |

No other new dependencies needed.

---

## Out of Scope (Phase 3+)

- OAuth2 provider authentication
- Team / multi-user workspaces
- Stripe billing / paid plans
- Slack / Discord / Webhook notification channels
- Custom metric endpoints
- Data export (CSV/JSON)
- E2E tests (Playwright)
- Global rate limiting

---

*Approved by: User, 2026-02-18*
