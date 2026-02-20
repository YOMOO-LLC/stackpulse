# Provider Integration Protocol — Design Doc

**Date**: 2026-02-20
**Status**: Approved
**Topic**: Improve provider integration protocol for easier onboarding and richer per-service UI

---

## Problem

Adding a new provider currently requires touching 4+ files:
- `src/lib/providers/<name>.ts` — provider definition (data only)
- `src/lib/providers/index.ts` — manual registration
- `src/lib/providers/fetch.ts` — add a case to the large `switch` statement
- `src/lib/oauth/config.ts` — if OAuth2

Additionally, the service detail page (`/dashboard/[serviceId]`) renders the same generic layout for all providers with no way to customize the visual presentation per service.

---

## Goals

1. **Reduce files to touch** when adding a new provider from 4 to 2 (or 3 for OAuth)
2. **Richer generic UI** via declarative display metadata on `Collector` — most providers get better visuals for free
3. **Optional custom UI slot** for providers that need truly custom visualizations
4. **Backwards compatible** — existing 9 providers continue to work throughout migration

---

## Architecture

### File Structure (per provider)

```
Current (4 files required):            Target (2 files required):

providers/github.ts  ← data only       providers/github.ts  ← data + fetchMetrics()
providers/index.ts   ← register        providers/index.ts   ← register (unchanged)
providers/fetch.ts   ← big switch      providers/fetch.ts   ← 3-line auto-dispatch
oauth/config.ts      ← OAuth cfg       oauth/config.ts      ← unchanged
                                        providers/ui/github.tsx  ← optional custom UI
```

### Data Flow

```
Adding a new provider:
1. Create providers/<name>.ts     ← definition + fetchMetrics() + enriched Collector metadata
2. Register in index.ts (1 line)  ← only other file required
3. (OAuth only) Add to oauth/config.ts
4. (Optional) Create providers/ui/<name>.tsx for custom visualizations

Runtime:
cron/poll-service
  → fetchProviderMetrics(providerId, credentials)
  → provider.fetchMetrics(credentials)   ← auto-dispatch, no switch
  → SnapshotResult[]
  → insert into metric_snapshots

Service detail page:
[serviceId]/page.tsx
  → reads provider.collectors (with display metadata)
  → MetricSection (generic, auto-adapts from displayHint)
  → CustomDetailView (renders providers/ui/<name>.tsx if it exists)
  → AlertRulesSection + RecentSnapshotsPanel (unchanged)
```

### Boundaries

- `providers/<name>.ts` — server-side only, no React imports
- `providers/ui/<name>.tsx` — client component (`'use client'`), separate file
- `providers/fetch.ts` — becomes a 3-line auto-dispatcher

---

## Type Changes

### Enhanced `Collector`

```ts
export interface Collector {
  // Existing fields (unchanged)
  id: string
  name: string
  metricType: MetricType
  unit: string
  refreshInterval: number
  endpoint?: string

  // New: display metadata
  description?: string           // tooltip text shown on hover
  displayHint?: 'number'         // default — large bold number
             | 'progress'        // progress bar (requires thresholds.max)
             | 'status-badge'    // coloured status badge
             | 'currency'        // number with $ prefix

  thresholds?: {
    warning: number              // value at which card turns yellow
    critical: number             // value at which card turns red
    direction: 'below' | 'above' // 'below' = low is dangerous, 'above' = high is dangerous
    max?: number                 // used by 'progress' displayHint to compute percentage
  }

  trend?: boolean                // show trend arrow vs previous snapshot
}
```

### Enhanced `ServiceProvider`

```ts
export interface ServiceProvider {
  // Existing fields (unchanged)
  id: string
  name: string
  category: Category
  icon: string
  authType: 'api_key' | 'oauth2' | 'hybrid' | 'token'
  credentials: Credentials[]
  collectors: Collector[]
  alerts: AlertTemplate[]

  // New: self-contained fetch function
  fetchMetrics: (credentials: Record<string, string>) => Promise<SnapshotResult[]>

  // New: optional layout hint
  metricsLayout?: 'cards'        // default — horizontal flex cards
               | 'stats-grid'   // 2-column compact grid (for providers with many collectors)
}
```

### Example: GitHub rate limit collector with metadata

```ts
{
  id: 'rate_limit_remaining',
  name: 'API Rate Limit Remaining',
  metricType: 'count',
  unit: 'requests',
  refreshInterval: 300,
  description: 'GitHub REST API hourly request quota remaining',
  displayHint: 'progress',
  thresholds: {
    warning: 1000,
    critical: 100,
    direction: 'below',
    max: 5000,
  },
  trend: true,
}
```

---

## Optional UI Slot System

### Slot Position in Service Detail Page

```
[serviceId]/page.tsx
├── Breadcrumb + Page Header        (unchanged)
├── CredentialReauthBanner          (unchanged)
├── MetricSection                   (generic, reads displayHint)
├── ── CustomDetailView ──────────  ← new optional slot
│   Rendered if providers/ui/<providerId>.tsx exists
├── AlertRulesSection + RecentSnapshotsPanel  (unchanged)
└── SimulateAlertButton             (unchanged)
```

### Props Contract

```ts
// src/lib/providers/ui/types.ts
export interface CustomDetailViewProps {
  serviceId: string
  snapshots: Snapshot[]      // already fetched by page.tsx — no extra DB calls
  collectors: Collector[]    // provider's collector definitions with metadata
}
```

### Registry

```ts
// src/lib/providers/ui/registry.ts
import dynamic from 'next/dynamic'
import type { CustomDetailViewProps } from './types'

export const customDetailViews: Record<string, React.ComponentType<CustomDetailViewProps>> = {
  github: dynamic(() => import('./github')),
  // add entries here as custom views are created
}
```

### Usage in page.tsx (3 new lines)

```tsx
import { customDetailViews } from '@/lib/providers/ui/registry'

const CustomDetailView = customDetailViews[service.provider_id] ?? null

// In JSX:
{CustomDetailView && (
  <CustomDetailView serviceId={serviceId} snapshots={snapshots ?? []} collectors={provider.collectors} />
)}
```

### Key Decisions

- **`dynamic()` lazy loading** — providers without custom views incur zero extra JS bundle
- **Data passed from page.tsx** — custom views receive already-fetched snapshots, no extra DB reads
- **Fully optional** — all 9 existing providers work without any `providers/ui/` file

---

## `fetch.ts` Refactor

```ts
// Before: 95-line switch statement
switch (providerId) {
  case 'github': { const r = await fetchGitHubMetrics(...); return [...] }
  case 'stripe': { ... }
  // ... 9 cases
}

// After: 3 lines
export async function fetchProviderMetrics(
  providerId: string,
  credentials: Record<string, string>
): Promise<SnapshotResult[]> {
  const provider = getProvider(providerId)
  if (!provider) return []
  return provider.fetchMetrics(credentials)
}
```

---

## Migration Plan

### Phase 1 — Structural Refactor (zero behaviour change)
- Update `ServiceProvider` type to add `fetchMetrics` field
- Migrate each of the 9 providers: move their `switch` case body into `fetchMetrics()` on the provider object
- Replace `fetch.ts` switch with 3-line auto-dispatch
- All existing tests must remain green throughout

### Phase 2 — Enrich Collector Metadata
- Add `displayHint`, `thresholds`, `description`, `trend` to existing collectors
- Pure data change — UI ignores unknown fields, no breakage

### Phase 3 — Update MetricSection UI
- `MetricSection` reads `displayHint` and `thresholds`
- Renders progress bars, coloured values, trend arrows
- Update metric-section tests

### Phase 4 — Optional Custom UI Views
- Create `src/lib/providers/ui/` directory with registry and types
- Wire `CustomDetailView` slot into `[serviceId]/page.tsx`
- Build first custom view (e.g. GitHub rate limit visualisation)

### End State: Adding a New Provider

```
To add PlanetScale (API key auth):

1. Create src/lib/providers/planetscale.ts
   → ServiceProvider definition + fetchMetrics() + enriched Collector metadata

2. Add one line to src/lib/providers/index.ts
   → import + push into registry array

Files touched: 2
```

```
To add a new OAuth2 provider:

Same as above + add OAuth config to src/lib/oauth/config.ts

Files touched: 3 (down from 4 today)
```

---

## Out of Scope

- Changing the database schema (`metric_snapshots`, `alert_configs` tables)
- Modifying the QStash polling schedule logic
- Changing how alert rules are stored or evaluated
- Any changes to the connect/onboarding flow
