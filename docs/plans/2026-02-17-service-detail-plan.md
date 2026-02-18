# Service Detail Page — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/dashboard/[serviceId]` — a full-page service detail view with metric history charts (Recharts), alert rule CRUD, and a recent events timeline.

**Architecture:** Server component page fetches service + 48h of metric snapshots directly via Supabase. Child sections (charts, alert CRUD, events) are client components that call new `/api/alerts` routes. The `(app)` route group layout provides the sidebar automatically — no new layout file needed.

**Tech Stack:** Next.js App Router, Recharts, Supabase client (server + browser), TypeScript strict, Tailwind CSS v4, Vitest + @testing-library/react.

---

## Task 1: Install Recharts

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Install the package**

```bash
npm install recharts
```

**Step 2: Verify it installed**

```bash
node -e "require('recharts')"
```
Expected: no error.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency"
```

---

## Task 2: `GET /api/alerts` + `POST /api/alerts`

**Files:**
- Create: `src/app/api/alerts/route.ts`
- Create: `src/app/api/alerts/__tests__/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/app/api/alerts/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST } from '../route'

function makeRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const MOCK_USER = { id: 'user-1' }
const MOCK_ALERT = {
  id: 'alert-1',
  connected_service_id: 'svc-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 5,
  threshold_text: null,
  enabled: true,
}

function makeMockClient(overrides: Record<string, unknown> = {}) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_ALERT, error: null }),
      order: vi.fn().mockResolvedValue({ data: [MOCK_ALERT], error: null }),
      ...overrides,
    }),
  }
}

describe('GET /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const req = makeRequest('http://localhost/api/alerts?serviceId=svc-1')
    const res = await GET(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when serviceId is missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = makeRequest('http://localhost/api/alerts')
    const res = await GET(req as never)
    expect(res.status).toBe(400)
  })

  it('returns alert configs for a service', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = makeRequest('http://localhost/api/alerts?serviceId=svc-1')
    const res = await GET(req as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })
})

describe('POST /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const req = makeRequest('http://localhost/api/alerts', {
      connected_service_id: 'svc-1',
      collector_id: 'credit_balance',
      condition: 'lt',
      threshold_numeric: 5,
      enabled: true,
    })
    const res = await POST(req as never)
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = makeRequest('http://localhost/api/alerts', { enabled: true })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })

  it('creates an alert config and returns 201', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const req = makeRequest('http://localhost/api/alerts', {
      connected_service_id: 'svc-1',
      collector_id: 'credit_balance',
      condition: 'lt',
      threshold_numeric: 5,
      enabled: true,
    })
    const res = await POST(req as never)
    expect(res.status).toBe(201)
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/app/api/alerts/__tests__/route.test.ts
```
Expected: FAIL — module not found.

**Step 3: Implement the route**

```typescript
// src/app/api/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceId = req.nextUrl.searchParams.get('serviceId')
  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('alert_configs')
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .eq('connected_service_id', serviceId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled } = body

  if (!connected_service_id || !collector_id || !condition) {
    return NextResponse.json(
      { error: 'connected_service_id, collector_id, and condition are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('alert_configs')
    .insert({
      user_id: user.id,
      connected_service_id,
      collector_id,
      condition,
      threshold_numeric: threshold_numeric ?? null,
      threshold_text: threshold_text ?? null,
      enabled: enabled ?? true,
    })
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/app/api/alerts/__tests__/route.test.ts
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/app/api/alerts/route.ts src/app/api/alerts/__tests__/route.test.ts
git commit -m "feat: add GET /api/alerts and POST /api/alerts routes"
```

---

## Task 3: `PATCH /api/alerts/[id]` + `DELETE /api/alerts/[id]`

**Files:**
- Create: `src/app/api/alerts/[id]/route.ts`
- Create: `src/app/api/alerts/[id]/__tests__/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/app/api/alerts/[id]/__tests__/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { PATCH, DELETE } from '../route'

const MOCK_USER = { id: 'user-1' }
const MOCK_ALERT = {
  id: 'alert-1',
  connected_service_id: 'svc-1',
  collector_id: 'credit_balance',
  condition: 'lt',
  threshold_numeric: 3,
  threshold_text: null,
  enabled: false,
}

function makeParams(id: string) {
  return Promise.resolve({ id })
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/alerts/alert-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeMockClient() {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: MOCK_ALERT, error: null }),
    }),
  }
}

describe('PATCH /api/alerts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const res = await PATCH(makeRequest({ enabled: false }) as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(401)
  })

  it('updates the alert and returns it', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockClient() as never)
    const res = await PATCH(makeRequest({ enabled: false }) as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe('alert-1')
  })
})

describe('DELETE /api/alerts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    const mock = makeMockClient()
    mock.auth.getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('unauth') })
    vi.mocked(createClient).mockResolvedValue(mock as never)
    const res = await DELETE(new Request('http://localhost/api/alerts/alert-1') as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(401)
  })

  it('returns 204 on successful delete', async () => {
    const mock = makeMockClient()
    mock.from = vi.fn().mockReturnValue({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue({ error: null }),
    })
    // Override to simulate a final `.then()` call resolving successfully
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }) },
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    vi.mocked(createClient).mockResolvedValue(client as never)
    const res = await DELETE(new Request('http://localhost/api/alerts/alert-1') as never, { params: makeParams('alert-1') })
    expect(res.status).toBe(204)
  })
})
```

**Step 2: Run tests to confirm they fail**

```bash
npx vitest run "src/app/api/alerts/\[id\]/__tests__/route.test.ts"
```
Expected: FAIL — module not found.

**Step 3: Implement the route**

```typescript
// src/app/api/alerts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { condition, threshold_numeric, threshold_text, enabled } = body

  const updates: Record<string, unknown> = {}
  if (condition !== undefined) updates.condition = condition
  if (threshold_numeric !== undefined) updates.threshold_numeric = threshold_numeric
  if (threshold_text !== undefined) updates.threshold_text = threshold_text
  if (enabled !== undefined) updates.enabled = enabled

  const { data, error } = await supabase
    .from('alert_configs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, connected_service_id, collector_id, condition, threshold_numeric, threshold_text, enabled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { error } = await supabase
    .from('alert_configs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run "src/app/api/alerts/\[id\]/__tests__/route.test.ts"
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add "src/app/api/alerts/[id]/route.ts" "src/app/api/alerts/[id]/__tests__/route.test.ts"
git commit -m "feat: add PATCH and DELETE /api/alerts/[id] routes"
```

---

## Task 4: Service Detail Page — Server Component

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/page.tsx`

This is a server component. It:
1. Authenticates the user
2. Fetches the `connected_service` row
3. Fetches last 48h of `metric_snapshots`
4. Passes data down to client section components

No test file needed for the page shell — tests live in individual section components.

**Step 1: Create the page**

```typescript
// src/app/(app)/dashboard/[serviceId]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { MetricSection } from './metric-section'
import { AlertRulesSection } from './alert-rules-section'
import { EventsSection } from './events-section'
import { DeleteServiceButton } from './delete-service-button'
import { ArrowLeft } from 'lucide-react'

interface PageProps {
  params: Promise<{ serviceId: string }>
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { serviceId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch the service
  const { data: service } = await supabase
    .from('connected_services')
    .select('id, provider_id, label, enabled, auth_expired')
    .eq('id', serviceId)
    .eq('user_id', user!.id)
    .single()

  if (!service) notFound()

  const provider = getProvider(service.provider_id)

  // Fetch last 48h of metric snapshots
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('collector_id, value, value_text, unit, status, fetched_at')
    .eq('connected_service_id', serviceId)
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: true })

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Services
          </Link>
          <div className="flex items-center gap-2.5">
            <ProviderIcon providerId={service.provider_id} size={32} />
            <h1 className="text-lg font-semibold text-foreground">
              {service.label ?? provider?.name ?? service.provider_id}
            </h1>
          </div>
        </div>
        <DeleteServiceButton serviceId={serviceId} />
      </div>

      {/* Metrics */}
      <MetricSection
        serviceId={serviceId}
        collectors={provider?.collectors ?? []}
        snapshots={snapshots ?? []}
      />

      {/* Alert Rules */}
      <AlertRulesSection
        serviceId={serviceId}
        alertTemplates={provider?.alerts ?? []}
        collectors={provider?.collectors ?? []}
      />

      {/* Recent Events */}
      <EventsSection serviceId={serviceId} />
    </div>
  )
}
```

**Step 2: Verify the file is valid TypeScript (no compile errors)**

```bash
npx tsc --noEmit
```
Expected: No errors (the imported components don't exist yet — they'll be stubs until future tasks).

> Note: If TypeScript errors appear because the child components don't exist yet, create minimal stub files for each to unblock compilation. Example stub:
> ```typescript
> // src/app/(app)/dashboard/[serviceId]/metric-section.tsx
> export function MetricSection() { return null }
> ```

**Step 3: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/page.tsx"
git commit -m "feat: scaffold service detail page server component"
```

---

## Task 5: DeleteServiceButton Component

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx`

Small client component with a confirmation dialog before calling `DELETE /api/services/[id]` and redirecting to `/dashboard`.

**Step 1: Write the test**

```typescript
// src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeleteServiceButton } from '../delete-service-button'

// Mock router
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

global.fetch = vi.fn()

describe('DeleteServiceButton', () => {
  it('shows a delete button', () => {
    render(<DeleteServiceButton serviceId="svc-1" />)
    expect(screen.getByRole('button')).toBeTruthy()
  })

  it('shows confirmation dialog on click', () => {
    render(<DeleteServiceButton serviceId="svc-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/delete/i)).toBeTruthy()
  })

  it('calls DELETE API and redirects on confirm', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: true } as Response)
    render(<DeleteServiceButton serviceId="svc-1" />)

    // Open dialog
    fireEvent.click(screen.getByRole('button'))

    // Click confirm button (the one inside the dialog)
    const confirmBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase().includes('delete')
    )!
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/services/svc-1', { method: 'DELETE' })
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/delete-service-button.test.tsx"
```
Expected: FAIL — module not found.

**Step 3: Implement the component**

```typescript
// src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DeleteServiceButtonProps {
  serviceId: string
}

export function DeleteServiceButton({ serviceId }: DeleteServiceButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/services/${serviceId}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete service?</DialogTitle>
            <DialogDescription>
              This will remove the service and all its metrics history and alert rules. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 4: Run test to confirm it passes**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/delete-service-button.test.tsx"
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/delete-service-button.tsx" "src/app/(app)/dashboard/[serviceId]/__tests__/delete-service-button.test.tsx"
git commit -m "feat: add DeleteServiceButton with confirmation dialog"
```

---

## Task 6: MetricSection with Recharts Charts

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/metric-section.tsx`
- Create: `src/app/(app)/dashboard/[serviceId]/metric-chart.tsx`
- Create: `src/app/(app)/dashboard/[serviceId]/__tests__/metric-section.test.tsx`

**Step 1: Write the tests**

```typescript
// src/app/(app)/dashboard/[serviceId]/__tests__/metric-section.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricSection } from '../metric-section'
import type { Collector } from '@/lib/providers/types'

const mockCollectors: Collector[] = [
  {
    id: 'credit_balance',
    name: 'Credit Balance',
    metricType: 'currency',
    unit: 'USD',
    refreshInterval: 300,
    endpoint: '',
  },
]

const mockSnapshots = [
  { collector_id: 'credit_balance', value: 7.93, value_text: null, unit: 'USD', status: 'healthy', fetched_at: '2026-02-17T10:00:00Z' },
  { collector_id: 'credit_balance', value: 6.50, value_text: null, unit: 'USD', status: 'healthy', fetched_at: '2026-02-17T09:00:00Z' },
]

describe('MetricSection', () => {
  it('renders section heading', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('METRICS')).toBeTruthy()
  })

  it('renders a card for each collector', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('Credit Balance')).toBeTruthy()
  })

  it('shows latest value formatted for currency', () => {
    render(<MetricSection serviceId="svc-1" collectors={mockCollectors} snapshots={mockSnapshots} />)
    expect(screen.getByText('$7.93')).toBeTruthy()
  })

  it('shows empty state when no collectors', () => {
    render(<MetricSection serviceId="svc-1" collectors={[]} snapshots={[]} />)
    expect(screen.getByText(/no metrics/i)).toBeTruthy()
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/metric-section.test.tsx"
```
Expected: FAIL — module not found.

**Step 3: Implement MetricChart**

```typescript
// src/app/(app)/dashboard/[serviceId]/metric-chart.tsx
'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import type { MetricType } from '@/lib/providers/types'
import { format } from 'date-fns'

interface Snapshot {
  fetched_at: string
  value: number | null
  value_text: string | null
  status: string
}

interface MetricChartProps {
  metricType: MetricType
  snapshots: Snapshot[]
  unit: string
  threshold?: number
}

function formatValue(value: number, metricType: MetricType, unit: string): string {
  if (metricType === 'currency') return `$${value.toFixed(2)}`
  if (metricType === 'percentage') return `${value.toFixed(1)}%`
  return `${value} ${unit}`
}

export function MetricChart({ metricType, snapshots, unit, threshold }: MetricChartProps) {
  const data = snapshots
    .filter((s) => s.value !== null)
    .map((s) => ({
      time: new Date(s.fetched_at).getTime(),
      value: s.value as number,
      label: format(new Date(s.fetched_at), 'MMM d HH:mm'),
    }))

  if (data.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    )
  }

  const tickFormatter = (v: number) => formatValue(v, metricType, unit)

  if (metricType === 'count') {
    return (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} width={40} />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
            formatter={(v: number) => [formatValue(v, metricType, unit), unit]}
            labelFormatter={(label) => label}
          />
          <Bar dataKey="value" fill="hsl(var(--emerald-500, 16 185 129))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={tickFormatter} width={50} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => [formatValue(v, metricType, unit), '']}
          labelFormatter={(label) => label}
        />
        {threshold !== undefined && (
          <ReferenceLine y={threshold} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
        )}
        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={1.5} fill="url(#areaGradient)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

**Step 4: Implement MetricSection**

```typescript
// src/app/(app)/dashboard/[serviceId]/metric-section.tsx
'use client'

import type { Collector } from '@/lib/providers/types'
import { StatusDot } from '@/components/status-dot'
import { MetricChart } from './metric-chart'
import { formatDistanceToNow } from 'date-fns'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

interface MetricSectionProps {
  serviceId: string
  collectors: Collector[]
  snapshots: Snapshot[]
}

function formatLatestValue(value: number | null, valueText: string | null, metricType: string, unit: string | null): string {
  if (value !== null) {
    if (metricType === 'currency') return `$${value.toFixed(2)}`
    if (metricType === 'percentage') return `${value.toFixed(1)}%`
    return `${value}${unit ? ' ' + unit : ''}`
  }
  return valueText ?? '—'
}

export function MetricSection({ collectors, snapshots }: MetricSectionProps) {
  if (collectors.length === 0) {
    return (
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">METRICS</h2>
        <p className="text-sm text-muted-foreground">No metrics configured for this provider.</p>
      </section>
    )
  }

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">METRICS</h2>
      <div className="space-y-4">
        {collectors.map((collector) => {
          const collectorSnaps = snapshots
            .filter((s) => s.collector_id === collector.id)
            .sort((a, b) => new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime())

          const latest = collectorSnaps.at(-1)
          const status = (latest?.status ?? 'unknown') as 'healthy' | 'warning' | 'critical' | 'unknown'

          return (
            <div key={collector.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">{collector.name}</span>
                <StatusDot status={status} showLabel />
              </div>
              <div className="text-2xl font-semibold text-foreground mb-3">
                {formatLatestValue(latest?.value ?? null, latest?.value_text ?? null, collector.metricType, collector.unit)}
              </div>
              <MetricChart
                metricType={collector.metricType}
                snapshots={collectorSnaps}
                unit={collector.unit}
              />
              {latest && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated {formatDistanceToNow(new Date(latest.fetched_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

**Step 5: Run tests to confirm they pass**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/metric-section.test.tsx"
```
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/metric-section.tsx" \
        "src/app/(app)/dashboard/[serviceId]/metric-chart.tsx" \
        "src/app/(app)/dashboard/[serviceId]/__tests__/metric-section.test.tsx"
git commit -m "feat: add MetricSection with Recharts charts"
```

---

## Task 7: AlertRulesSection (Full CRUD)

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/alert-rules-section.tsx`
- Create: `src/app/(app)/dashboard/[serviceId]/__tests__/alert-rules-section.test.tsx`

**Step 1: Write the tests**

```typescript
// src/app/(app)/dashboard/[serviceId]/__tests__/alert-rules-section.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AlertRulesSection } from '../alert-rules-section'
import type { Collector } from '@/lib/providers/types'
import type { AlertTemplate } from '@/lib/providers/types'

const mockCollectors: Collector[] = [
  { id: 'credit_balance', name: 'Credit Balance', metricType: 'currency', unit: 'USD', refreshInterval: 300, endpoint: '' },
]

const mockTemplates: AlertTemplate[] = [
  { id: 'low_credits', name: 'Low Credits', collectorId: 'credit_balance', condition: 'lt', defaultThreshold: 5, message: 'Credits below $5' },
]

const mockRules = [
  { id: 'rule-1', connected_service_id: 'svc-1', collector_id: 'credit_balance', condition: 'lt', threshold_numeric: 5, threshold_text: null, enabled: true },
]

global.fetch = vi.fn()

beforeEach(() => {
  vi.mocked(global.fetch)
    .mockResolvedValueOnce({ ok: true, json: async () => mockRules } as Response) // initial GET
})

describe('AlertRulesSection', () => {
  it('renders section heading', async () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    expect(screen.getByText('ALERT RULES')).toBeTruthy()
  })

  it('renders Add alert rule button', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    expect(screen.getByText(/add alert rule/i)).toBeTruthy()
  })

  it('shows form when Add alert rule is clicked', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText(/add alert rule/i))
    expect(screen.getByText(/metric/i)).toBeTruthy()
  })

  it('shows preset buttons for provider templates', () => {
    render(<AlertRulesSection serviceId="svc-1" alertTemplates={mockTemplates} collectors={mockCollectors} />)
    fireEvent.click(screen.getByText(/add alert rule/i))
    expect(screen.getByText('Low Credits')).toBeTruthy()
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/alert-rules-section.test.tsx"
```
Expected: FAIL — module not found.

**Step 3: Implement AlertRulesSection**

```typescript
// src/app/(app)/dashboard/[serviceId]/alert-rules-section.tsx
'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Collector, AlertTemplate } from '@/lib/providers/types'

interface AlertConfig {
  id: string
  connected_service_id: string
  collector_id: string
  condition: string
  threshold_numeric: number | null
  threshold_text: string | null
  enabled: boolean
}

interface AlertRulesSectionProps {
  serviceId: string
  alertTemplates: AlertTemplate[]
  collectors: Collector[]
}

const CONDITION_LABELS: Record<string, string> = {
  lt: 'is less than',
  gt: 'is greater than',
  eq: 'equals',
  status_is: 'status is',
}

export function AlertRulesSection({ serviceId, alertTemplates, collectors }: AlertRulesSectionProps) {
  const [rules, setRules] = useState<AlertConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form state
  const [collectorId, setCollectorId] = useState(collectors[0]?.id ?? '')
  const [condition, setCondition] = useState('lt')
  const [thresholdNumeric, setThresholdNumeric] = useState('')
  const [thresholdText, setThresholdText] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadRules() {
    const res = await fetch(`/api/alerts?serviceId=${serviceId}`)
    if (res.ok) setRules(await res.json())
  }

  useEffect(() => { loadRules() }, [serviceId])

  function applyPreset(template: AlertTemplate) {
    setCollectorId(template.collectorId)
    setCondition(template.condition)
    if (typeof template.defaultThreshold === 'number') {
      setThresholdNumeric(String(template.defaultThreshold))
      setThresholdText('')
    } else {
      setThresholdText(String(template.defaultThreshold))
      setThresholdNumeric('')
    }
  }

  function resetForm() {
    setCollectorId(collectors[0]?.id ?? '')
    setCondition('lt')
    setThresholdNumeric('')
    setThresholdText('')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(rule: AlertConfig) {
    setCollectorId(rule.collector_id)
    setCondition(rule.condition)
    setThresholdNumeric(rule.threshold_numeric != null ? String(rule.threshold_numeric) : '')
    setThresholdText(rule.threshold_text ?? '')
    setEditingId(rule.id)
    setShowForm(true)
  }

  const selectedCollector = collectors.find((c) => c.id === collectorId)
  const isNumeric = selectedCollector?.metricType !== 'status'

  async function handleSave() {
    setSaving(true)
    const body = {
      connected_service_id: serviceId,
      collector_id: collectorId,
      condition,
      threshold_numeric: isNumeric && thresholdNumeric ? Number(thresholdNumeric) : null,
      threshold_text: !isNumeric ? thresholdText : null,
      enabled: true,
    }

    if (editingId) {
      await fetch(`/api/alerts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    await loadRules()
    resetForm()
    setSaving(false)
  }

  async function toggleEnabled(rule: AlertConfig) {
    await fetch(`/api/alerts/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    await loadRules()
  }

  async function deleteRule(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    await loadRules()
  }

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">ALERT RULES</h2>

      {rules.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground mb-3">No alert rules configured.</p>
      )}

      <div className="space-y-2 mb-3">
        {rules.map((rule) => {
          const collector = collectors.find((c) => c.id === rule.collector_id)
          const threshold = rule.threshold_numeric != null
            ? (collector?.metricType === 'currency' ? `$${rule.threshold_numeric}` : String(rule.threshold_numeric))
            : rule.threshold_text ?? ''

          return (
            <div key={rule.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5">
              <button
                onClick={() => toggleEnabled(rule)}
                className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${rule.enabled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground'}`}
                title={rule.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
              />
              <span className="text-sm text-foreground flex-1">
                {collector?.name ?? rule.collector_id}{' '}
                <span className="text-muted-foreground">{CONDITION_LABELS[rule.condition] ?? rule.condition}</span>{' '}
                <span className="font-medium">{threshold}</span>
              </span>
              <button onClick={() => startEdit(rule)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 mb-3 space-y-4">
          {/* Presets */}
          {alertTemplates.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Presets</p>
              <div className="flex gap-2 flex-wrap">
                {alertTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyPreset(t)}
                    className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Metric</Label>
              <select
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
              >
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
              >
                {isNumeric
                  ? [['lt', 'is less than'], ['gt', 'is greater than']].map(([v, l]) => <option key={v} value={v}>{l}</option>)
                  : [['status_is', 'status is']].map(([v, l]) => <option key={v} value={v}>{l}</option>)
                }
              </select>
            </div>
            <div>
              <Label className="text-xs">Threshold</Label>
              {isNumeric ? (
                <Input
                  type="number"
                  value={thresholdNumeric}
                  onChange={(e) => setThresholdNumeric(e.target.value)}
                  placeholder={selectedCollector?.metricType === 'currency' ? '5.00' : '80'}
                  className="mt-1 text-sm"
                />
              ) : (
                <select
                  value={thresholdText}
                  onChange={(e) => setThresholdText(e.target.value)}
                  className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                >
                  {['healthy', 'warning', 'critical', 'unknown'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || (isNumeric && !thresholdNumeric)}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add alert rule
      </button>
    </section>
  )
}
```

**Step 4: Run tests to confirm they pass**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/alert-rules-section.test.tsx"
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/[serviceId]/alert-rules-section.tsx" \
        "src/app/(app)/dashboard/[serviceId]/__tests__/alert-rules-section.test.tsx"
git commit -m "feat: add AlertRulesSection with full CRUD"
```

---

## Task 8: EventsSection — Recent Events Timeline

**Files:**
- Create: `src/app/(app)/dashboard/[serviceId]/events-section.tsx`
- Create: `src/app/(app)/dashboard/[serviceId]/__tests__/events-section.test.tsx`

**Step 1: Write the tests**

```typescript
// src/app/(app)/dashboard/[serviceId]/__tests__/events-section.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { EventsSection } from '../events-section'

global.fetch = vi.fn()

const mockEvents = [
  {
    id: 'evt-1',
    notified_at: '2026-02-17T14:32:00Z',
    triggered_value_numeric: 4.20,
    triggered_value_text: null,
    alert_configs: { collector_id: 'credit_balance', condition: 'lt', threshold_numeric: 5 },
  },
]

describe('EventsSection', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ events: mockEvents, hasMore: false }) } as Response)
  })

  it('renders section heading', async () => {
    render(<EventsSection serviceId="svc-1" />)
    expect(screen.getByText('RECENT EVENTS')).toBeTruthy()
  })

  it('shows events after loading', async () => {
    render(<EventsSection serviceId="svc-1" />)
    await waitFor(() => {
      expect(screen.getByText('$4.20')).toBeTruthy()
    })
  })

  it('shows empty state when no events', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({ events: [], hasMore: false }) } as Response)
    render(<EventsSection serviceId="svc-1" />)
    await waitFor(() => {
      expect(screen.getByText(/no alerts have triggered/i)).toBeTruthy()
    })
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/events-section.test.tsx"
```
Expected: FAIL — module not found.

**Step 3: Add events API endpoint**

First, add a new API route to fetch alert events for a service. This will be called by EventsSection client component.

```typescript
// src/app/api/alert-events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceId = req.nextUrl.searchParams.get('serviceId')
  const offset = Number(req.nextUrl.searchParams.get('offset') ?? '0')
  const limit = 20

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required' }, { status: 400 })
  }

  const { data: events, error } = await supabase
    .from('alert_events')
    .select(`
      id, notified_at, triggered_value_numeric, triggered_value_text,
      alert_configs!inner ( collector_id, condition, threshold_numeric, connected_service_id )
    `)
    .eq('alert_configs.connected_service_id', serviceId)
    .order('notified_at', { ascending: false })
    .range(offset, offset + limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = events ?? []
  return NextResponse.json({
    events: items.slice(0, limit),
    hasMore: items.length > limit,
  })
}
```

**Step 4: Implement EventsSection**

```typescript
// src/app/(app)/dashboard/[serviceId]/events-section.tsx
'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'

interface AlertEvent {
  id: string
  notified_at: string
  triggered_value_numeric: number | null
  triggered_value_text: string | null
  alert_configs: {
    collector_id: string
    condition: string
    threshold_numeric: number | null
  }
}

interface EventsSectionProps {
  serviceId: string
}

function formatTriggeredValue(event: AlertEvent): string {
  if (event.triggered_value_numeric != null) {
    // Guess currency based on condition having a dollar threshold
    if (event.alert_configs.threshold_numeric != null && event.alert_configs.threshold_numeric < 1000) {
      return `$${event.triggered_value_numeric.toFixed(2)}`
    }
    return String(event.triggered_value_numeric)
  }
  return event.triggered_value_text ?? ''
}

export function EventsSection({ serviceId }: EventsSectionProps) {
  const [events, setEvents] = useState<AlertEvent[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  async function loadEvents(currentOffset: number) {
    setLoading(true)
    const res = await fetch(`/api/alert-events?serviceId=${serviceId}&offset=${currentOffset}`)
    if (res.ok) {
      const json = await res.json()
      if (currentOffset === 0) {
        setEvents(json.events)
      } else {
        setEvents((prev) => [...prev, ...json.events])
      }
      setHasMore(json.hasMore)
    }
    setLoading(false)
  }

  useEffect(() => { loadEvents(0) }, [serviceId])

  function loadMore() {
    const newOffset = offset + 20
    setOffset(newOffset)
    loadEvents(newOffset)
  }

  return (
    <section>
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">RECENT EVENTS</h2>

      {!loading && events.length === 0 && (
        <p className="text-sm text-muted-foreground">No alerts have triggered for this service.</p>
      )}

      <div className="space-y-1">
        {events.map((event) => {
          const isCritical = event.alert_configs.condition === 'gt'
          return (
            <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              {isCritical
                ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              }
              <span className="text-xs text-muted-foreground shrink-0 w-32">
                {format(new Date(event.notified_at), 'MMM d, HH:mm')}
              </span>
              <span className="text-sm text-foreground flex-1">
                {event.alert_configs.collector_id.replace(/_/g, ' ')} triggered
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatTriggeredValue(event)}
              </span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </section>
  )
}
```

**Step 5: Run tests to confirm they pass**

```bash
npx vitest run "src/app/(app)/dashboard/\[serviceId\]/__tests__/events-section.test.tsx"
```
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/app/api/alert-events/route.ts \
        "src/app/(app)/dashboard/[serviceId]/events-section.tsx" \
        "src/app/(app)/dashboard/[serviceId]/__tests__/events-section.test.tsx"
git commit -m "feat: add EventsSection and GET /api/alert-events route"
```

---

## Task 9: Update AppSidebar Links + Active State

**Files:**
- Modify: `src/components/app-sidebar.tsx:59-65`

**Step 1: Write the test**

```typescript
// src/components/__tests__/app-sidebar-links.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppSidebar } from '../app-sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/svc-123',
}))

const services = [
  { id: 'svc-123', label: 'My OpenRouter', providerId: 'openrouter', status: 'healthy' as const },
  { id: 'svc-456', label: 'My Resend', providerId: 'resend', status: 'unknown' as const },
]

describe('AppSidebar service links', () => {
  it('links each service to its detail page', () => {
    render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const links = screen.getAllByRole('link')
    const serviceLinks = links.filter((l) => l.getAttribute('href')?.startsWith('/dashboard/'))
    expect(serviceLinks).toHaveLength(2)
    expect(serviceLinks[0].getAttribute('href')).toBe('/dashboard/svc-123')
    expect(serviceLinks[1].getAttribute('href')).toBe('/dashboard/svc-456')
  })

  it('marks the active service with active styling', () => {
    const { container } = render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const activeLink = container.querySelector('a[href="/dashboard/svc-123"]')
    expect(activeLink?.className).toContain('bg-secondary')
  })

  it('does not mark inactive service as active', () => {
    const { container } = render(<AppSidebar services={services} userEmail="dev@test.com" />)
    const inactiveLink = container.querySelector('a[href="/dashboard/svc-456"]')
    expect(inactiveLink?.className).not.toContain('bg-secondary')
  })
})
```

**Step 2: Run test to confirm it fails**

```bash
npx vitest run src/components/__tests__/app-sidebar-links.test.tsx
```
Expected: FAIL — links point to `/dashboard` not `/dashboard/svc-123`.

**Step 3: Update AppSidebar**

In `src/components/app-sidebar.tsx`, change lines 59-65:

```typescript
// OLD:
const isActive = pathname === `/dashboard`
return (
  <Link
    key={service.id}
    href="/dashboard"

// NEW:
const isActive = pathname.startsWith(`/dashboard/${service.id}`)
return (
  <Link
    key={service.id}
    href={`/dashboard/${service.id}`}
```

**Step 4: Run test to confirm it passes**

```bash
npx vitest run src/components/__tests__/app-sidebar-links.test.tsx
```
Expected: All tests PASS.

**Step 5: Run full test suite to catch regressions**

```bash
npx vitest run
```
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/components/app-sidebar.tsx src/components/__tests__/app-sidebar-links.test.tsx
git commit -m "feat: link sidebar service items to /dashboard/[serviceId]"
```

---

## Task 10: ServiceCard — Link to Detail Page

**Files:**
- Modify: `src/components/service-card.tsx`

The service card on the dashboard grid should navigate to the detail page when clicked.

**Step 1: Read the current ServiceCard**

```bash
# Read src/components/service-card.tsx to see current structure
```

**Step 2: Wrap card in a Link**

In `service-card.tsx`, import `Link` from `next/link` and wrap the outer card `div` or use `asChild` on the card:

```typescript
import Link from 'next/link'

// Wrap the card root:
<Link href={`/dashboard/${id}`} className="block hover:opacity-90 transition-opacity">
  {/* existing card content */}
</Link>
```

**Step 3: Verify no broken layouts**

```bash
npx tsc --noEmit
npx vitest run
```
Expected: No TypeScript errors, all tests PASS.

**Step 4: Commit**

```bash
git add src/components/service-card.tsx
git commit -m "feat: make ServiceCard navigate to service detail page"
```

---

## Task 11: Integration Smoke Test

**Goal:** Verify the complete flow works end-to-end in the browser.

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Manual checklist**

1. Log in at `http://localhost:4567/login` with `dev@stackpulse.local` / `Test1234!`
2. On `/dashboard`, verify the sidebar shows service items
3. Click a service card — should navigate to `/dashboard/[serviceId]`
4. Verify: back link shows "← Services", provider icon + label visible
5. Verify: METRICS section shows collector cards with charts
6. Verify: ALERT RULES section loads (may be empty initially)
7. Click `+ Add alert rule` — form should expand
8. Select a preset if available — form should auto-fill
9. Save a rule — it should appear in the list
10. Toggle the enabled circle — should update without page reload
11. Edit a rule — form should re-open with existing values
12. Delete the rule — should disappear
13. Verify RECENT EVENTS section shows empty state or events
14. Click sidebar service items — active item gets emerald left border

**Step 3: Run full test suite one final time**

```bash
npx vitest run
```
Expected: All tests PASS.

**Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration issues found during smoke test"
```

---

*Plan written by: Claude, 2026-02-17*
