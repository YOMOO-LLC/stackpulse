# StackPulse

A self-hosted SaaS monitoring dashboard. Connect external services (GitHub, Stripe, Vercel, OpenAI, etc.), collect metrics on a schedule, set alert rules, and receive email notifications when thresholds are breached.

## Tech Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** · **Supabase** (auth + Postgres + realtime) · **Upstash QStash** (background polling) · **Resend** (alert emails)

## Getting Started

```bash
pnpm install
pnpm dev          # http://localhost:4567
```

Copy `.env.example` to `.env.local` and fill in the required variables (see [Environment Variables](#environment-variables)).

To seed a local test account:

```bash
supabase db reset   # creates dev@stackpulse.local / Test1234!
```

---

## Adding a New Provider

Each provider lives in a **single self-contained file**. Adding a new one requires touching **2 files** (3 if OAuth2).

### Step 1 — Create `src/lib/providers/<name>.ts`

The file must export a `ServiceProvider` object that includes:

```ts
import type { ServiceProvider } from './types'
import type { SnapshotResult } from './fetch'

export const planetscaleProvider: ServiceProvider = {
  id: 'planetscale',
  name: 'PlanetScale',
  category: 'infrastructure',
  icon: '/icons/planetscale.svg',
  authType: 'api_key',
  credentials: [
    { key: 'serviceToken', label: 'Service Token', type: 'password', required: true, placeholder: 'pscale_tkn_...' },
    { key: 'serviceTokenName', label: 'Token Name', type: 'text', required: true, placeholder: 'my-token' },
  ],
  collectors: [
    {
      id: 'row_reads',
      name: 'Row Reads',
      metricType: 'count',
      unit: 'rows',
      refreshInterval: 300,
      description: 'Total row reads in the current billing period',
      displayHint: 'progress',
      thresholds: { warning: 800_000_000, critical: 950_000_000, direction: 'above', max: 1_000_000_000 },
      trend: true,
    },
  ],
  alerts: [
    { id: 'high-reads', name: 'High Row Reads', collectorId: 'row_reads', condition: 'gt', defaultThreshold: 800_000_000, message: 'Row reads above 800M' },
  ],
  // Self-contained fetch function — no changes to fetch.ts needed
  fetchMetrics: async (credentials): Promise<SnapshotResult[]> => {
    // ... call PlanetScale API with credentials.serviceToken
    return [
      { collectorId: 'row_reads', value: 123_456_789, valueText: null, unit: 'rows', status: 'healthy' },
    ]
  },
}
```

#### Collector display metadata (all optional)

| Field | Type | Effect |
|---|---|---|
| `description` | `string` | Tooltip shown on hover in the dashboard |
| `displayHint` | `'number' \| 'progress' \| 'status-badge' \| 'currency'` | How the metric card renders the value |
| `thresholds.warning` | `number` | Value at which the card turns yellow |
| `thresholds.critical` | `number` | Value at which the card turns red |
| `thresholds.direction` | `'above' \| 'below'` | Whether high or low values are dangerous |
| `thresholds.max` | `number` | Required for `displayHint: 'progress'` — sets the 100% mark |
| `trend` | `boolean` | Show a trend arrow vs the previous snapshot |

Provider-level layout hint:

| Field | Values | Effect |
|---|---|---|
| `metricsLayout` | `'cards'` (default) · `'stats-grid'` | How the metric row is arranged on the service detail page |

### Step 2 — Register in `src/lib/providers/index.ts`

Add two lines:

```ts
import { planetscaleProvider } from './planetscale'
// ...
registerProvider(planetscaleProvider)
```

### Step 3 (OAuth2 only) — Add config to `src/lib/oauth/config.ts`

```ts
planetscale: {
  authorizationUrl: 'https://auth.planetscale.com/oauth/authorize',
  tokenUrl: 'https://auth.planetscale.com/oauth/token',
  scopes: ['read_databases'],
  supportsRefresh: true,
},
```

### Optional — Custom UI view

If the default metric cards aren't enough, create `src/lib/providers/ui/<name>.tsx`:

```tsx
'use client'
import type { CustomDetailViewProps } from './types'

export default function PlanetScaleDetailView({ snapshots, collectors }: CustomDetailViewProps) {
  // Receives already-fetched snapshots — no extra DB calls needed
  return <div>...custom visualization...</div>
}
```

Then register the provider ID in `src/lib/providers/ui/registry.ts`:

```ts
export const CUSTOM_DETAIL_VIEW_IDS = new Set<string>([
  'github',
  'planetscale',  // ← add here
])
```

The custom view renders between the metric cards and the alert rules section on the service detail page. It is lazy-loaded — providers without a custom view incur zero extra JS.

---

## Supported Providers

| Provider | Auth | Collectors |
|---|---|---|
| GitHub | `oauth2` | rate_limit_remaining, rate_limit_used, graphql_rate_limit_remaining, search_rate_limit_remaining, public_repos |
| Stripe | `api_key` | account_balance |
| Vercel | `oauth2` | bandwidth_used, deployment_status |
| OpenAI | `api_key` | credit_balance, monthly_usage |
| Sentry | `oauth2` | error_count |
| Upstash Redis | `api_key` | daily_commands, memory_usage |
| Upstash QStash | `api_key` | messages_delivered, messages_failed, monthly_quota_used |
| OpenRouter | `api_key` | credit_balance |
| Resend | `api_key` | connection_status |
| MiniMax | `api_key` | connection_status |
| Supabase | `oauth2` | connection_status |

---

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=               # 64-char hex — AES-256-GCM key for stored credentials
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
NEXT_PUBLIC_APP_URL=          # OAuth redirect_uri base (default: http://localhost:4567)
RESEND_API_KEY=
RESEND_FROM_EMAIL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
VERCEL_CLIENT_ID=
VERCEL_CLIENT_SECRET=
SENTRY_CLIENT_ID=
SENTRY_CLIENT_SECRET=
SUPABASE_CLIENT_ID=
SUPABASE_CLIENT_SECRET=
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/           Login / signup
│   ├── (app)/
│   │   ├── dashboard/          Service list overview
│   │   ├── dashboard/[id]/     Service detail: metrics, alerts, snapshots
│   │   ├── dashboard/history/  Alert event history
│   │   ├── dashboard/channels/ Notification channels
│   │   └── connect/            Provider selection + credential forms
│   └── api/
│       ├── services/           CRUD + manual sync
│       ├── oauth/              Authorization + callback
│       ├── cron/poll-service/  QStash webhook (fetch → alert → email)
│       ├── alerts/             Alert rule CRUD
│       └── channels/          Notification channel CRUD
└── lib/
    ├── providers/              Provider definitions + fetchMetrics + registry
    │   └── ui/                 Optional per-provider custom UI components
    ├── alerts/engine.ts        Alert condition evaluation
    ├── oauth/                  OAuth2 state, token exchange, refresh
    ├── crypto.ts               AES-256-GCM credential encryption
    ├── notifications/          Resend email sender
    ├── qstash.ts               QStash schedule management
    └── supabase/               Supabase clients (server + browser)
```

---

## Development

```bash
pnpm dev              # Start dev server (port 4567)
pnpm build            # Production build
pnpm lint             # ESLint
npx vitest            # Tests in watch mode
npx vitest run        # Single test run
npx tsc --noEmit      # TypeScript check
```

This project follows strict **TDD** — write a failing test before every implementation change. See `CLAUDE.md` for full development guidelines.
