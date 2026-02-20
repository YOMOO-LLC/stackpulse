# Provider Integration Protocol Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the provider system so each provider is self-contained (owns its `fetchMetrics` function), collectors carry rich display metadata, and service detail pages can optionally render a provider-specific custom UI slot.

**Architecture:** `ServiceProvider` gains a required `fetchMetrics` method, eliminating `fetch.ts`'s 95-line switch. `Collector` gains optional `displayHint`, `thresholds`, and `description` fields that drive automatic visual adaptation in `MetricSection`. An optional `providers/ui/<name>.tsx` slot renders above the alert rules section for providers that need fully custom visualizations.

**Tech Stack:** TypeScript (strict), Next.js 16 App Router, React 19, Vitest + @testing-library/react, Supabase

---

## Phase 1 — Type Updates

### Task 1: Add `fetchMetrics` (optional) + display metadata to types

**Files:**
- Modify: `src/lib/providers/types.ts`

**Step 1: Add new fields to `types.ts`**

Replace the file content with:

```ts
import type { SnapshotResult } from './fetch'

export type MetricType = 'currency' | 'percentage' | 'count' | 'status' | 'boolean'
export type Category = 'ai' | 'monitoring' | 'email' | 'hosting' | 'payment' | 'infrastructure' | 'other'
export type AlertCondition = 'lt' | 'gt' | 'eq' | 'status_is'
export type DisplayHint = 'number' | 'progress' | 'status-badge' | 'currency'

export interface MetricValue {
  collectorId: string
  value: number | string | boolean
  timestamp: string
}

export interface Credentials {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
  placeholder?: string
}

export interface CollectorThresholds {
  warning: number
  critical: number
  direction: 'below' | 'above'   // 'below' = low value is dangerous, 'above' = high is dangerous
  max?: number                   // required when displayHint === 'progress'
}

export interface Collector {
  id: string
  name: string
  metricType: MetricType
  unit: string
  refreshInterval: number
  endpoint?: string
  // Display metadata (all optional — generic UI falls back gracefully)
  description?: string
  displayHint?: DisplayHint
  thresholds?: CollectorThresholds
  trend?: boolean
}

export interface ApiKeyAuth { type: 'api_key' }
export interface OAuth2Auth { type: 'oauth2'; authorizationUrl: string; tokenUrl: string; scopes: string[] }
export interface HybridAuth { type: 'hybrid'; oauth2: Omit<OAuth2Auth, 'type'> }
export type AuthConfig = ApiKeyAuth | OAuth2Auth | HybridAuth

export interface AlertTemplate {
  id: string
  name: string
  collectorId: string
  condition: AlertCondition
  defaultThreshold: number | string
  message: string
}

export interface ServiceProvider {
  id: string
  name: string
  category: Category
  icon: string
  authType: 'api_key' | 'oauth2' | 'hybrid' | 'token'
  credentials: Credentials[]
  collectors: Collector[]
  alerts: AlertTemplate[]
  // Self-contained metric fetching (optional now, required after Task 5)
  fetchMetrics?: (credentials: Record<string, string>) => Promise<SnapshotResult[]>
  // Layout hint for MetricSection
  metricsLayout?: 'cards' | 'stats-grid'
}

export const VALID_METRIC_TYPES: MetricType[] = ['currency', 'percentage', 'count', 'status', 'boolean']
export const VALID_CATEGORIES: Category[] = ['ai', 'monitoring', 'email', 'hosting', 'payment', 'infrastructure', 'other']
export const VALID_ALERT_CONDITIONS: AlertCondition[] = ['lt', 'gt', 'eq', 'status_is']
```

**Note:** `fetchMetrics` is optional (`?`) during migration. It becomes required in Task 5 after all providers are migrated.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: zero errors (all existing providers still compile because `fetchMetrics?` is optional)

**Step 3: Run tests**

```bash
npx vitest run
```
Expected: all 127 tests pass

**Step 4: Commit**

```bash
git add src/lib/providers/types.ts
git commit -m "feat(providers): add fetchMetrics + display metadata fields to types"
```

---

## Phase 2 — Migrate Providers (add `fetchMetrics`)

### Task 2: Migrate openrouter, resend, sentry, stripe

For each provider below, the pattern is identical:
- Move the matching `switch` case body from `src/lib/providers/fetch.ts` into a new `fetchMetrics` property on the provider object
- The existing named export function (e.g. `fetchStripeMetrics`) stays untouched — `fetchMetrics` calls it

**Files:**
- Modify: `src/lib/providers/openrouter.ts`
- Modify: `src/lib/providers/resend.ts`
- Modify: `src/lib/providers/sentry.ts`
- Modify: `src/lib/providers/stripe.ts`

**Step 1: Add `fetchMetrics` to `openrouterProvider`**

In `openrouter.ts`, add after the `collectors` array:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenRouterMetrics(credentials.apiKey)
    return [{ collectorId: 'credit_balance', value: r.value ?? null, valueText: null, unit: 'USD', status: r.status }]
  },
```

**Step 2: Add `fetchMetrics` to `resendProvider`**

In `resend.ts`, add after the `collectors` array:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchResendMetrics(credentials.apiKey)
    return [{ collectorId: 'connection_status', value: null, valueText: r.value ?? null, unit: '', status: r.status }]
  },
```

**Step 3: Add `fetchMetrics` to `sentryProvider`**

In `sentry.ts`, add after the `collectors` array:

```ts
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.authToken
    const orgSlug = credentials.orgSlug ?? ''
    const r = await fetchSentryMetrics(token, orgSlug)
    return [{ collectorId: 'error_count', value: r.value ?? null, valueText: null, unit: 'events', status: r.status }]
  },
```

**Step 4: Add `fetchMetrics` to `stripeProvider`**

In `stripe.ts`, add after the `collectors` array:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchStripeMetrics(credentials.apiKey)
    return [{ collectorId: 'account_balance', value: r.balance ?? null, valueText: null, unit: 'USD', status: r.status }]
  },
```

**Step 5: Write a test that calls `stripeProvider.fetchMetrics` (tests the delegation pattern)**

Add to `src/lib/providers/__tests__/stripe.test.ts`:

```ts
import { stripeProvider } from '../stripe'

describe('stripeProvider.fetchMetrics', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('delegates to fetchStripeMetrics and returns SnapshotResult', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ available: [{ amount: 5000, currency: 'usd' }] }),
    } as Response)

    const results = await stripeProvider.fetchMetrics!({ apiKey: 'sk_test_xxx' })
    expect(results).toHaveLength(1)
    expect(results[0].collectorId).toBe('account_balance')
    expect(results[0].value).toBe(50)
  })
})
```

**Step 6: Run tests**

```bash
npx vitest run src/lib/providers/__tests__/stripe.test.ts
```
Expected: all stripe tests pass

**Step 7: Commit**

```bash
git add src/lib/providers/openrouter.ts src/lib/providers/resend.ts src/lib/providers/sentry.ts src/lib/providers/stripe.ts src/lib/providers/__tests__/stripe.test.ts
git commit -m "feat(providers): add fetchMetrics to openrouter, resend, sentry, stripe"
```

---

### Task 3: Migrate github, vercel, openai, upstash-redis, upstash-qstash

**Files:**
- Modify: `src/lib/providers/github.ts`
- Modify: `src/lib/providers/vercel.ts`
- Modify: `src/lib/providers/openai.ts`
- Modify: `src/lib/providers/upstash-redis.ts`
- Modify: `src/lib/providers/upstash-qstash.ts`

**Step 1: Add `fetchMetrics` to `githubProvider`**

In `github.ts`, add after `alerts`:

```ts
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.token
    const r = await fetchGitHubMetrics(token)
    return [
      { collectorId: 'rate_limit_remaining', value: r.rateLimitRemaining ?? null, valueText: null, unit: 'requests', status: r.status },
      { collectorId: 'rate_limit_used',       value: r.rateLimitUsed ?? null,       valueText: null, unit: 'requests', status: 'healthy' },
      { collectorId: 'graphql_rate_limit_remaining', value: r.graphqlRemaining ?? null, valueText: null, unit: 'requests', status: 'healthy' },
      { collectorId: 'search_rate_limit_remaining',  value: r.searchRemaining ?? null,  valueText: null, unit: 'requests', status: 'healthy' },
      { collectorId: 'public_repos', value: r.publicRepos ?? null, valueText: null, unit: 'repos', status: 'healthy' },
    ]
  },
```

**Step 2: Add `fetchMetrics` to `vercelProvider`**

In `vercel.ts`:

```ts
  fetchMetrics: async (credentials) => {
    const token = credentials.access_token ?? credentials.token
    const r = await fetchVercelMetrics(token)
    return [
      { collectorId: 'bandwidth_used',    value: r.bandwidthUsed ?? null,    valueText: null,                   unit: 'GB', status: r.status },
      { collectorId: 'deployment_status', value: null,                        valueText: r.deploymentStatus ?? null, unit: '',   status: r.status },
    ]
  },
```

**Step 3: Add `fetchMetrics` to `openaiProvider`**

In `openai.ts`:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchOpenAIMetrics(credentials.apiKey)
    return [
      { collectorId: 'credit_balance', value: r.creditBalance ?? null, valueText: null, unit: 'USD', status: r.status },
      { collectorId: 'monthly_usage',  value: r.monthlyUsage ?? null,  valueText: null, unit: 'USD', status: r.status },
    ]
  },
```

**Step 4: Add `fetchMetrics` to `upstashRedisProvider`**

In `upstash-redis.ts`:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchUpstashRedisMetrics(credentials.email, credentials.apiKey, credentials.databaseId)
    return [
      { collectorId: 'daily_commands', value: r.dailyCommands ?? null, valueText: null, unit: 'commands', status: r.status },
      { collectorId: 'memory_usage',   value: r.memoryUsage ?? null,   valueText: null, unit: '%',        status: r.status },
    ]
  },
```

**Step 5: Add `fetchMetrics` to `upstashQStashProvider`**

In `upstash-qstash.ts`:

```ts
  fetchMetrics: async (credentials) => {
    const r = await fetchUpstashQStashMetrics(credentials.token)
    return [
      { collectorId: 'messages_delivered', value: r.messagesDelivered ?? null, valueText: null, unit: 'messages', status: r.status },
      { collectorId: 'messages_failed',    value: r.messagesFailed ?? null,    valueText: null, unit: 'messages', status: r.status },
      { collectorId: 'monthly_quota_used', value: r.quotaUsed ?? null,         valueText: null, unit: '%',        status: r.status },
    ]
  },
```

**Step 6: Run full test suite**

```bash
npx vitest run
```
Expected: all 127 tests pass

**Step 7: Commit**

```bash
git add src/lib/providers/github.ts src/lib/providers/vercel.ts src/lib/providers/openai.ts src/lib/providers/upstash-redis.ts src/lib/providers/upstash-qstash.ts
git commit -m "feat(providers): add fetchMetrics to github, vercel, openai, upstash"
```

---

## Phase 3 — Refactor `fetch.ts`

### Task 4: Replace switch with auto-dispatch + make `fetchMetrics` required

**Files:**
- Modify: `src/lib/providers/types.ts` — make `fetchMetrics` required (remove `?`)
- Modify: `src/lib/providers/fetch.ts` — replace 95-line switch with 3 lines

**Step 1: Make `fetchMetrics` required in `types.ts`**

Change:
```ts
fetchMetrics?: (credentials: Record<string, string>) => Promise<SnapshotResult[]>
```
To:
```ts
fetchMetrics: (credentials: Record<string, string>) => Promise<SnapshotResult[]>
```

**Step 2: Verify TypeScript compiles (all 9 providers now have `fetchMetrics`)**

```bash
npx tsc --noEmit
```
Expected: zero errors

**Step 3: Write a failing test for the new auto-dispatch**

Create `src/lib/providers/__tests__/fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearProviders, registerProvider } from '../registry'
import { fetchProviderMetrics } from '../fetch'
import type { ServiceProvider } from '../types'

const mockProvider: ServiceProvider = {
  id: 'mock',
  name: 'Mock',
  category: 'other',
  icon: '',
  authType: 'api_key',
  credentials: [],
  collectors: [{ id: 'test_metric', name: 'Test', metricType: 'count', unit: 'units', refreshInterval: 60 }],
  alerts: [],
  fetchMetrics: vi.fn().mockResolvedValue([
    { collectorId: 'test_metric', value: 42, valueText: null, unit: 'units', status: 'healthy' },
  ]),
}

describe('fetchProviderMetrics (auto-dispatch)', () => {
  beforeEach(() => {
    clearProviders()
    registerProvider(mockProvider)
    vi.clearAllMocks()
  })

  it('calls provider.fetchMetrics with credentials', async () => {
    const creds = { apiKey: 'test-key' }
    const results = await fetchProviderMetrics('mock', creds)
    expect(mockProvider.fetchMetrics).toHaveBeenCalledWith(creds)
    expect(results).toHaveLength(1)
    expect(results[0].value).toBe(42)
  })

  it('returns empty array for unknown provider', async () => {
    const results = await fetchProviderMetrics('nonexistent', {})
    expect(results).toEqual([])
  })
})
```

**Step 4: Run test to verify it fails**

```bash
npx vitest run src/lib/providers/__tests__/fetch.test.ts
```
Expected: FAIL — the current switch-based `fetchProviderMetrics` doesn't handle 'mock'

**Step 5: Replace `fetch.ts` content**

```ts
/**
 * Unified metric fetching dispatcher.
 * Each provider owns its fetchMetrics() — no switch needed here.
 */
import { getProvider } from './registry'

export interface SnapshotResult {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
}

export async function fetchProviderMetrics(
  providerId: string,
  credentials: Record<string, string>
): Promise<SnapshotResult[]> {
  const provider = getProvider(providerId)
  if (!provider) {
    console.warn(`[fetchProviderMetrics] Unknown provider: ${providerId}`)
    return []
  }
  return provider.fetchMetrics(credentials)
}
```

**Step 6: Run tests**

```bash
npx vitest run
```
Expected: all tests pass including the new fetch.test.ts

**Step 7: Commit**

```bash
git add src/lib/providers/types.ts src/lib/providers/fetch.ts src/lib/providers/__tests__/fetch.test.ts
git commit -m "feat(providers): replace fetch.ts switch with auto-dispatch via provider.fetchMetrics"
```

---

## Phase 4 — Enrich Collector Metadata

### Task 5: Add display metadata to all 9 providers

**Files:**
- Modify: `src/lib/providers/github.ts`
- Modify: `src/lib/providers/stripe.ts`
- Modify: `src/lib/providers/openai.ts`
- Modify: `src/lib/providers/vercel.ts`
- Modify: `src/lib/providers/upstash-redis.ts`
- Modify: `src/lib/providers/upstash-qstash.ts`
- Modify: `src/lib/providers/openrouter.ts`
- Modify: `src/lib/providers/sentry.ts`
- Modify: `src/lib/providers/resend.ts`

**Step 1: Enrich GitHub collectors**

In `github.ts`, replace `collectors` array:

```ts
collectors: [
  {
    id: 'rate_limit_remaining',
    name: 'API Rate Limit Remaining',
    metricType: 'count', unit: 'requests', refreshInterval: 300,
    description: 'GitHub REST API hourly request quota remaining',
    displayHint: 'progress',
    thresholds: { warning: 1000, critical: 100, direction: 'below', max: 5000 },
    trend: true,
  },
  {
    id: 'rate_limit_used',
    name: 'API Rate Limit Used',
    metricType: 'count', unit: 'requests', refreshInterval: 300,
    description: 'Requests consumed this hour',
    trend: true,
  },
  {
    id: 'graphql_rate_limit_remaining',
    name: 'GraphQL Rate Limit Remaining',
    metricType: 'count', unit: 'requests', refreshInterval: 300,
    description: 'GitHub GraphQL API hourly quota remaining',
    displayHint: 'progress',
    thresholds: { warning: 500, critical: 50, direction: 'below', max: 5000 },
  },
  {
    id: 'search_rate_limit_remaining',
    name: 'Search Rate Limit Remaining',
    metricType: 'count', unit: 'requests', refreshInterval: 300,
    description: 'GitHub Search API per-minute quota remaining',
    displayHint: 'progress',
    thresholds: { warning: 5, critical: 1, direction: 'below', max: 30 },
  },
  {
    id: 'public_repos',
    name: 'Public Repositories',
    metricType: 'count', unit: 'repos', refreshInterval: 300,
    description: 'Total number of public repositories',
  },
],
metricsLayout: 'stats-grid',
```

**Step 2: Enrich Stripe collectors**

In `stripe.ts`, replace `collectors` array:

```ts
collectors: [
  {
    id: 'account_balance',
    name: 'Account Balance',
    metricType: 'currency', unit: 'USD', refreshInterval: 300,
    description: 'Available Stripe account balance in USD',
    displayHint: 'currency',
    thresholds: { warning: 100, critical: 20, direction: 'below' },
    trend: true,
  },
],
```

**Step 3: Enrich OpenAI collectors**

In `openai.ts`, replace `collectors` array:

```ts
collectors: [
  {
    id: 'credit_balance',
    name: 'Credit Balance',
    metricType: 'currency', unit: 'USD', refreshInterval: 300,
    description: 'Remaining prepaid OpenAI credits',
    displayHint: 'currency',
    thresholds: { warning: 5, critical: 1, direction: 'below' },
    trend: true,
  },
  {
    id: 'monthly_usage',
    name: 'Monthly Usage',
    metricType: 'currency', unit: 'USD', refreshInterval: 300,
    description: 'Total spend this calendar month',
    displayHint: 'currency',
    thresholds: { warning: 40, critical: 50, direction: 'above' },
    trend: true,
  },
],
```

**Step 4: Enrich Vercel collectors**

In `vercel.ts`, replace `collectors` array:

```ts
collectors: [
  {
    id: 'bandwidth_used',
    name: 'Bandwidth Used',
    metricType: 'count', unit: 'GB', refreshInterval: 300,
    description: 'Bandwidth consumed this billing period',
    displayHint: 'progress',
    thresholds: { warning: 80, critical: 95, direction: 'above', max: 100 },
    trend: true,
  },
  {
    id: 'deployment_status',
    name: 'Deployment Status',
    metricType: 'status', unit: '', refreshInterval: 300,
    description: 'State of the most recent deployment',
    displayHint: 'status-badge',
  },
],
```

**Step 5: Enrich Upstash Redis collectors**

In `upstash-redis.ts`, replace `collectors` array:

```ts
collectors: [
  {
    id: 'daily_commands',
    name: 'Daily Commands',
    metricType: 'count', unit: 'commands', refreshInterval: 300,
    description: 'Redis commands executed today',
    trend: true,
  },
  {
    id: 'memory_usage',
    name: 'Memory Usage',
    metricType: 'percentage', unit: '%', refreshInterval: 300,
    description: 'Percentage of max memory in use',
    displayHint: 'progress',
    thresholds: { warning: 70, critical: 85, direction: 'above', max: 100 },
    trend: true,
  },
],
```

**Step 6: Enrich Upstash QStash, OpenRouter, Sentry, Resend** — apply the same pattern using sensible thresholds for each metric (see design doc for guidance).

**Step 7: Run tests**

```bash
npx vitest run
```
Expected: all tests pass (metadata is additive, nothing breaks)

**Step 8: Commit**

```bash
git add src/lib/providers/
git commit -m "feat(providers): enrich collectors with displayHint, thresholds, description metadata"
```

---

## Phase 5 — Update MetricSection UI

### Task 6: Read `displayHint` and `thresholds` in `MetricSection`

**Files:**
- Modify: `src/app/(app)/dashboard/[serviceId]/metric-section.tsx`
- Modify: `src/app/(app)/dashboard/[serviceId]/__tests__/metric-section.test.tsx`

**Step 1: Write failing tests for new rendering behaviour**

Add to `metric-section.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MetricSection } from '../metric-section'

const baseProps = {
  serviceId: 'svc-1',
  snapshots: [
    { collector_id: 'rate_limit_remaining', value: 800, value_text: null, unit: 'requests', status: 'healthy', fetched_at: new Date().toISOString() },
    { collector_id: 'account_balance', value: 15, value_text: null, unit: 'USD', status: 'warning', fetched_at: new Date().toISOString() },
  ],
}

describe('MetricSection — displayHint', () => {
  it('renders a progress bar when displayHint is progress', () => {
    const collectors = [{
      id: 'rate_limit_remaining', name: 'Rate Limit', metricType: 'count' as const,
      unit: 'requests', refreshInterval: 300,
      displayHint: 'progress' as const,
      thresholds: { warning: 1000, critical: 100, direction: 'below' as const, max: 5000 },
    }]
    render(<MetricSection {...baseProps} collectors={collectors} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('applies warning colour class when value is below warning threshold (direction: below)', () => {
    const collectors = [{
      id: 'account_balance', name: 'Balance', metricType: 'currency' as const,
      unit: 'USD', refreshInterval: 300,
      displayHint: 'currency' as const,
      thresholds: { warning: 100, critical: 20, direction: 'below' as const },
    }]
    const { container } = render(<MetricSection {...baseProps} collectors={collectors} />)
    // value is 15, below critical threshold
    expect(container.querySelector('[data-health="critical"]')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/app/\(app\)/dashboard/\[serviceId\]/__tests__/metric-section.test.tsx
```
Expected: FAIL — `progressbar` role and `data-health` attribute not yet implemented

**Step 3: Update `MetricSection` to use display metadata**

Key changes in `metric-section.tsx`:

```tsx
// Helper: compute health level from thresholds
function computeHealth(
  value: number,
  thresholds: CollectorThresholds | undefined
): 'healthy' | 'warning' | 'critical' {
  if (!thresholds) return 'healthy'
  const { warning, critical, direction } = thresholds
  if (direction === 'below') {
    if (value <= critical) return 'critical'
    if (value <= warning) return 'warning'
  } else {
    if (value >= critical) return 'critical'
    if (value >= warning) return 'warning'
  }
  return 'healthy'
}

// Health → CSS variable colour
const HEALTH_COLOR = {
  healthy:  'var(--sp-success)',
  warning:  'var(--sp-warning)',
  critical: 'var(--sp-error)',
}

// Inside the card render:
const health = value != null ? computeHealth(value, collector.thresholds) : 'healthy'
const valueColor = collector.thresholds ? HEALTH_COLOR[health] : 'var(--foreground)'

// For progress displayHint:
{collector.displayHint === 'progress' && collector.thresholds?.max && value != null && (
  <div
    role="progressbar"
    aria-valuenow={value}
    aria-valuemax={collector.thresholds.max}
    style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginTop: 4 }}
  >
    <div style={{
      height: '100%',
      width: `${Math.min(100, (value / collector.thresholds.max) * 100)}%`,
      background: HEALTH_COLOR[health],
      transition: 'width 0.3s ease',
    }} />
  </div>
)}
```

Add `data-health={health}` to the value element for testability.

**Step 4: Run tests**

```bash
npx vitest run src/app/\(app\)/dashboard/\[serviceId\]/__tests__/metric-section.test.tsx
```
Expected: all metric-section tests pass

**Step 5: Run full suite**

```bash
npx vitest run
```
Expected: all tests pass

**Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard/\[serviceId\]/metric-section.tsx src/app/\(app\)/dashboard/\[serviceId\]/__tests__/metric-section.test.tsx
git commit -m "feat(ui): MetricSection reads displayHint/thresholds — progress bars and health colours"
```

---

## Phase 6 — Optional UI Slot System

### Task 7: Create `providers/ui/` infrastructure

**Files:**
- Create: `src/lib/providers/ui/types.ts`
- Create: `src/lib/providers/ui/registry.ts`

**Step 1: Create `types.ts`**

```ts
// src/lib/providers/ui/types.ts
import type { Collector } from '../types'

export interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

export interface CustomDetailViewProps {
  serviceId: string
  snapshots: Snapshot[]
  collectors: Collector[]
}
```

**Step 2: Create `registry.ts`**

```ts
// src/lib/providers/ui/registry.ts
import type { ComponentType } from 'react'
import type { CustomDetailViewProps } from './types'

// Add provider IDs here as custom views are created
// Use next/dynamic for lazy loading in the actual page component
export const CUSTOM_DETAIL_VIEW_IDS = new Set<string>([
  // 'github',  ← uncomment when providers/ui/github.tsx is created (Task 9)
])

export type CustomDetailViewRegistry = Record<string, ComponentType<CustomDetailViewProps>>
```

**Step 3: Write a test for the registry**

Create `src/lib/providers/ui/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CUSTOM_DETAIL_VIEW_IDS } from '../registry'

describe('CUSTOM_DETAIL_VIEW_IDS', () => {
  it('is a Set', () => {
    expect(CUSTOM_DETAIL_VIEW_IDS).toBeInstanceOf(Set)
  })
})
```

**Step 4: Run test**

```bash
npx vitest run src/lib/providers/ui/__tests__/registry.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/providers/ui/
git commit -m "feat(providers): add providers/ui/ slot infrastructure (types + registry)"
```

---

### Task 8: Wire `CustomDetailView` slot into service detail page

**Files:**
- Modify: `src/app/(app)/dashboard/[serviceId]/page.tsx`

**Step 1: Add dynamic import and slot to `page.tsx`**

At the top of the file, add:

```tsx
import dynamic from 'next/dynamic'
import { CUSTOM_DETAIL_VIEW_IDS } from '@/lib/providers/ui/registry'
import type { CustomDetailViewProps } from '@/lib/providers/ui/types'
```

Inside `ServiceDetailPage`, before the return:

```tsx
// Lazily load custom view only if the provider has one registered
const CustomDetailView = CUSTOM_DETAIL_VIEW_IDS.has(service.provider_id)
  ? dynamic<CustomDetailViewProps>(() =>
      import(`@/lib/providers/ui/${service.provider_id}`)
    )
  : null
```

In the JSX, between `MetricSection` and the two-column grid:

```tsx
{CustomDetailView && (
  <CustomDetailView
    serviceId={serviceId}
    snapshots={snapshots ?? []}
    collectors={provider?.collectors ?? []}
  />
)}
```

**Step 2: Verify the page still compiles and all pages return 200**

```bash
npx tsc --noEmit
```

Then check dev server logs — all routes should remain 200.

**Step 3: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass

**Step 4: Commit**

```bash
git add src/app/\(app\)/dashboard/\[serviceId\]/page.tsx
git commit -m "feat(ui): wire CustomDetailView optional slot into service detail page"
```

---

### Task 9: Build GitHub custom detail view

**Files:**
- Create: `src/lib/providers/ui/github.tsx`
- Modify: `src/lib/providers/ui/registry.ts`

**Step 1: Create `github.tsx`**

```tsx
// src/lib/providers/ui/github.tsx
'use client'

import type { CustomDetailViewProps } from './types'

export default function GitHubDetailView({ snapshots, collectors }: CustomDetailViewProps) {
  const rateLimitCollector = collectors.find((c) => c.id === 'rate_limit_remaining')
  const latestRateLimit = [...snapshots]
    .filter((s) => s.collector_id === 'rate_limit_remaining')
    .sort((a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime())[0]

  if (!rateLimitCollector || !latestRateLimit?.value) return null

  const max = rateLimitCollector.thresholds?.max ?? 5000
  const used = max - latestRateLimit.value
  const pct = Math.round((used / max) * 100)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        API Rate Limit Usage
      </p>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: pct > 80 ? 'var(--sp-error)' : pct > 60 ? 'var(--sp-warning)' : 'var(--sp-success)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{used.toLocaleString()} used</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{max.toLocaleString()} total</span>
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--foreground)' }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}
```

**Step 2: Enable in registry**

In `registry.ts`, uncomment:

```ts
export const CUSTOM_DETAIL_VIEW_IDS = new Set<string>([
  'github',
])
```

**Step 3: Verify in browser**

Navigate to a connected GitHub service page. The rate limit usage bar should appear between the metric cards and the alert rules section.

**Step 4: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass

**Step 5: Commit**

```bash
git add src/lib/providers/ui/github.tsx src/lib/providers/ui/registry.ts
git commit -m "feat(ui): add GitHub custom detail view with rate limit usage bar"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `npx vitest run` — all tests pass
- [ ] `/dashboard` loads, metric cards show coloured values for Stripe (balance)
- [ ] GitHub service page shows progress bars in metric cards + rate limit custom view
- [ ] Upstash Redis memory card shows a progress bar
- [ ] Adding a hypothetical new provider only requires creating 1 provider file + 1 line in `index.ts`
- [ ] `fetch.ts` contains no `switch` statement

---

## Reference

- Design doc: `docs/plans/2026-02-20-provider-integration-protocol-design.md`
- Test runner: `npx vitest run` (watch: `npx vitest`)
- Dev server: `pnpm dev` → http://localhost:4567
- TypeScript check: `npx tsc --noEmit`
