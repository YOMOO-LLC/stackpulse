# Service Detail Page — Design

**Date:** 2026-02-17
**Status:** Approved

---

## Goal

When a user clicks a service card (or a sidebar item), they navigate to a full-page service detail view at `/dashboard/[serviceId]`. The page shows metric history charts, full alert rule CRUD, and a recent events timeline — all scoped to that single service.

---

## Route

```
src/app/(app)/dashboard/[serviceId]/page.tsx
```

Lives inside the `(app)` route group — inherits the sidebar layout automatically. No new layout file needed.

---

## Page Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Services    [Provider Icon] OpenRouter        [⋮]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  METRICS                                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ Credit Balance              ● Healthy        │   │
│  │ $7.93                    [Recharts chart]    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ALERT RULES                                         │
│  ┌──────────────────────────────────────────────┐   │
│  │ ◉ Low Credits   < $5   [edit] [delete]       │   │
│  └──────────────────────────────────────────────┘   │
│  [+ Add alert rule]                                  │
│                                                      │
│  RECENT EVENTS                                       │
│  ▲ Feb 17 14:32  Low Credits triggered — $4.20      │
│  ▲ Feb 10 09:15  Low Credits triggered — $3.80      │
│                                          [Load more] │
└──────────────────────────────────────────────────────┘
```

### Header

- Back link: `← Services` → navigates to `/dashboard`
- Provider icon (32px) + service label
- Kebab menu `⋮` with a single action: **Delete service** (with confirmation)

---

## Section 1 — Metrics & Charts

### Data source

Query `metric_snapshots` for the service, ordered by `fetched_at` descending, limited to the last **48 hours**. Group by `collector_id`.

### Chart type by MetricType

| MetricType | Chart | Notes |
|---|---|---|
| `currency` | `AreaChart` (Recharts) | Y-axis in USD; dashed threshold line at alert threshold if one exists |
| `count` | `BarChart` (Recharts) | Each bar = one poll snapshot |
| `percentage` | `AreaChart` | Y-axis 0–100%; threshold line at 80% (warning) and 95% (critical) |
| `status` | Status timeline (custom SVG) | Green/amber/red segments across time axis |

### Chart config

- Width: 100% (responsive via `ResponsiveContainer`)
- Height: 160px
- X-axis: time labels (auto-formatted: "Feb 16 14:00")
- Y-axis: value + unit label
- Tooltip: exact value + timestamp on hover
- Color: emerald for healthy range, amber/red when value crosses threshold
- No legend (single series per chart)

### Layout

Each collector gets its own card:

```
┌─────────────────────────────────────────────────────┐
│  Credit Balance                        ● Healthy    │
│  $7.93                                              │
│                                                     │
│  [Recharts AreaChart — 48h of snapshots]            │
│                                                     │
│  Last updated 2 minutes ago                         │
└─────────────────────────────────────────────────────┘
```

---

## Section 2 — Alert Rules (Full CRUD)

### List

Fetch `alert_configs` for this `connected_service_id`. Render each as a row:

```
◉  Low Credits    Credit Balance  is less than  $5    [Edit]  [Delete]
○  Very Low       Credit Balance  is less than  $1    [Edit]  [Delete]
```

- `◉` = enabled toggle (click to PATCH `enabled`)
- `○` = disabled

### Add / Edit form (inline, expands below `+ Add alert rule`)

```
Presets:  [Low Credits < $5 ↗]  [Very Low Credits < $1 ↗]

Metric      [Credit Balance        ▾]
Condition   [is less than          ▾]
Threshold   [$  __________]

                              [Cancel]  [Save]
```

- **Presets** are the provider's `alerts` templates — clicking one fills the form
- Condition options per MetricType:
  - `currency` / `count` / `percentage`: `lt`, `gt`
  - `status`: `eq` (with value dropdown: `healthy`, `warning`, `critical`, `unknown`)
- Threshold: numeric input (currency/count/percentage) or text select (status)
- Validation: threshold required, must be a valid number for numeric types

### API calls

| Action | Method | Endpoint |
|---|---|---|
| List rules | `GET` | `/api/alerts?serviceId=` |
| Toggle enabled | `PATCH` | `/api/alerts/[id]` |
| Create rule | `POST` | `/api/alerts` |
| Update rule | `PATCH` | `/api/alerts/[id]` |
| Delete rule | `DELETE` | `/api/alerts/[id]` |

Schema for POST/PATCH body:
```typescript
{
  connected_service_id: string
  collector_id: string
  condition: 'lt' | 'gt' | 'eq' | 'status_is'
  threshold_numeric?: number
  threshold_text?: string
  enabled: boolean
}
```

---

## Section 3 — Recent Events

Query `alert_events` joined with `alert_configs` for this service. Newest first, page size 20.

```
RECENT EVENTS
──────────────────────────────────────────────────────
▲  Feb 17, 14:32    Low Credits triggered    $4.20
▲  Feb 10, 09:15    Low Credits triggered    $3.80
──────────────────────────────────────────────────────
                                        [Load more]
```

- Icon: `▲` amber for warning, `✕` red for critical
- Timestamp: `MMM DD, HH:mm` (local time)
- Rule name + triggered value
- Empty state: `"No alerts have triggered for this service."`
- Pagination: load 20 more on button click (no infinite scroll)

---

## Section 4 — Sidebar Update

Update `AppSidebar` so each service item links to `/dashboard/[service.id]` instead of `/dashboard`. Active state matched via `pathname.startsWith('/dashboard/' + service.id)`.

```tsx
<Link href={`/dashboard/${service.id}`}>
```

Active item gets: `bg-secondary` + left emerald border + `text-foreground`.

---

## New API Routes Needed

| Route | Purpose |
|---|---|
| `GET /api/alerts?serviceId=` | List alert_configs for a service |
| `POST /api/alerts` | Create alert_config |
| `PATCH /api/alerts/[id]` | Update threshold / toggle enabled |
| `DELETE /api/alerts/[id]` | Remove alert_config |

The `metric_snapshots` for charts are fetched server-side directly in the page component via Supabase client (no new API route needed).

---

## Dependencies

- **Recharts** — `npm install recharts` (planned in design doc for Phase 2, used now)
- No other new dependencies

---

## Out of Scope (for this feature)

- Notification channels configuration (`/dashboard/channels`)
- Global event history (`/dashboard/history`)
- Realtime updates (Phase 2)
- Editing service credentials / re-connecting

---

*Approved by: User, 2026-02-17*
