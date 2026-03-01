# Pricing & Subscription System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a 3-tier pricing system (Free / Pro $4.99 / Business $19.99) with Stripe billing, enforced limits, and a landing page pricing section.

**Architecture:** Supabase `subscriptions` table tracks each user's plan. A `src/lib/subscription.ts` helper resolves the current user's plan + limits. Stripe Checkout handles payment, Stripe Webhooks sync subscription state. Limits are enforced at API boundaries (service creation, alert rules, QStash cron frequency).

**Tech Stack:** Stripe (checkout + webhooks), Supabase (subscriptions table + RLS), Next.js API routes, existing QStash scheduling

**Design Doc:** `docs/plans/2026-03-01-pricing-strategy-design.md`

---

## Task 1: Database — Subscriptions Table

**Files:**
- Create: `supabase/migrations/20260301000001_subscriptions.sql`

**Step 1: Write the migration**

```sql
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only service_role can insert/update (via webhooks)
CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Apply migration**

Run: `supabase db reset`
Expected: Database recreated with new `subscriptions` table.

**Step 3: Commit**

```bash
git add supabase/migrations/20260301000001_subscriptions.sql
git commit -m "feat(db): add subscriptions table with RLS"
```

---

## Task 2: Subscription Helper — Plan Limits

**Files:**
- Create: `src/lib/subscription.ts`
- Test: `src/lib/__tests__/subscription.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/subscription.test.ts
import { describe, it, expect } from 'vitest'
import { getPlanLimits, PLAN_LIMITS } from '../subscription'

describe('getPlanLimits', () => {
  it('returns free limits by default', () => {
    const limits = getPlanLimits('free')
    expect(limits.maxServices).toBe(3)
    expect(limits.pollCron).toBe('0 * * * *')
    expect(limits.maxAlertRules).toBe(3)
    expect(limits.maxTeamMembers).toBe(1)
    expect(limits.retentionDays).toBe(7)
  })

  it('returns pro limits', () => {
    const limits = getPlanLimits('pro')
    expect(limits.maxServices).toBe(15)
    expect(limits.pollCron).toBe('*/15 * * * *')
    expect(limits.maxAlertRules).toBe(20)
    expect(limits.maxTeamMembers).toBe(3)
    expect(limits.retentionDays).toBe(30)
  })

  it('returns business limits', () => {
    const limits = getPlanLimits('business')
    expect(limits.maxServices).toBe(Infinity)
    expect(limits.pollCron).toBe('*/5 * * * *')
    expect(limits.maxAlertRules).toBe(Infinity)
    expect(limits.maxTeamMembers).toBe(10)
    expect(limits.retentionDays).toBe(90)
  })

  it('falls back to free for unknown plan', () => {
    const limits = getPlanLimits('unknown' as any)
    expect(limits.maxServices).toBe(3)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/subscription.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/subscription.ts
import { createClient } from '@/lib/supabase/server'

export type Plan = 'free' | 'pro' | 'business'

export interface PlanLimits {
  maxServices: number
  pollCron: string
  maxAlertRules: number
  maxTeamMembers: number
  retentionDays: number
  channels: string[]
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxServices: 3,
    pollCron: '0 * * * *',
    maxAlertRules: 3,
    maxTeamMembers: 1,
    retentionDays: 7,
    channels: ['email'],
  },
  pro: {
    maxServices: 15,
    pollCron: '*/15 * * * *',
    maxAlertRules: 20,
    maxTeamMembers: 3,
    retentionDays: 30,
    channels: ['email', 'slack'],
  },
  business: {
    maxServices: Infinity,
    pollCron: '*/5 * * * *',
    maxAlertRules: Infinity,
    maxTeamMembers: 10,
    retentionDays: 90,
    channels: ['email', 'slack', 'webhook', 'pagerduty'],
  },
}

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free
}

export async function getUserPlan(userId: string): Promise<{ plan: Plan; limits: PlanLimits }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = (data?.plan as Plan) ?? 'free'
  return { plan, limits: getPlanLimits(plan) }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/subscription.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/subscription.ts src/lib/__tests__/subscription.test.ts
git commit -m "feat: add subscription plan limits helper"
```

---

## Task 3: Enforce Service Count Limit

**Files:**
- Modify: `src/app/api/services/route.ts` (POST handler)
- Test: `src/app/api/services/__tests__/route.test.ts` (add limit test)

**Step 1: Write the failing test**

Add to existing test file or create new:

```typescript
// src/app/api/services/__tests__/limit.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/crypto', () => ({ encrypt: vi.fn(() => 'encrypted') }))
vi.mock('@/lib/providers', () => ({ getProvider: vi.fn(() => ({ name: 'Test', collectors: [] })) }))
vi.mock('@/lib/providers/fetch', () => ({ fetchProviderMetrics: vi.fn(async () => []) }))
vi.mock('@/lib/qstash', () => ({ registerServiceSchedule: vi.fn(async () => 'scd_1') }))

import { createClient } from '@/lib/supabase/server'
import { POST } from '../route'

function makeReq(body: object) {
  return new Request('http://localhost/api/services', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/services — plan limits', () => {
  it('returns 403 when free user exceeds 3 services', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'subscriptions') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan: 'free' }, error: null }) }
        }
        if (table === 'connected_services') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { id: 'svc-1' }, error: null }),
            // count query returns 3 (at limit)
            then: undefined,
          }
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() }
      }),
    }
    // Mock count query: user already has 3 services
    mockSupabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { plan: 'free' }, error: null }) }
      }
      if (table === 'connected_services') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              // For count query
              then: vi.fn(),
              single: vi.fn().mockResolvedValue({ data: { id: 'svc-1' }, error: null }),
            }),
          }),
          insert: vi.fn().mockReturnThis(),
        }
      }
      return {}
    })

    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const res = await POST(makeReq({ providerId: 'test', credentials: { key: 'abc' } }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/limit/)
  })
})
```

**Step 2: Modify POST handler to check limit**

In `src/app/api/services/route.ts`, after auth check (line 73), add:

```typescript
import { getUserPlan } from '@/lib/subscription'

// ... inside POST handler, after auth check:

// Check service count limit
const { limits } = await getUserPlan(user.id)
const { count } = await supabase
  .from('connected_services')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)

if ((count ?? 0) >= limits.maxServices) {
  return NextResponse.json(
    { error: `Plan limit reached: max ${limits.maxServices} services. Upgrade to add more.` },
    { status: 403 },
  )
}
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass

**Step 4: Commit**

```bash
git add src/app/api/services/route.ts src/app/api/services/__tests__/limit.test.ts
git commit -m "feat: enforce service count limit per subscription plan"
```

---

## Task 4: Tier-Aware QStash Polling Frequency

**Files:**
- Modify: `src/lib/qstash.ts`
- Modify: `src/app/api/services/route.ts` (pass userId to registerServiceSchedule)
- Modify: `src/app/api/oauth/callback/[provider]/route.ts` (pass userId)

**Step 1: Update `registerServiceSchedule` signature**

```typescript
// src/lib/qstash.ts
import { getPlanLimits } from '@/lib/subscription'
import { createClient } from '@/lib/supabase/server'

export async function registerServiceSchedule(serviceId: string, userId: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const limits = getPlanLimits(data?.plan ?? 'free')

  const result = await qstash.schedules.create({
    destination: `${APP_URL}/api/cron/poll-service`,
    cron: limits.pollCron,
    body: JSON.stringify({ serviceId }),
    headers: { 'Content-Type': 'application/json' },
  })
  return result.scheduleId
}
```

**Step 2: Update callers**

In `src/app/api/services/route.ts` line 124:
```typescript
const scheduleId = await registerServiceSchedule(data.id, user.id)
```

In `src/app/api/oauth/callback/[provider]/route.ts` (find `registerServiceSchedule(data.id)` and add `userId`):
```typescript
const scheduleId = await registerServiceSchedule(data.id, userId)
```

In `src/app/api/services/[id]/credentials/route.ts` (same pattern):
```typescript
scheduleId = await registerServiceSchedule(id, user.id)
```

**Step 3: Run tests**

Run: `npx vitest run`
Expected: All pass (existing tests may need mock updates for new signature)

**Step 4: Commit**

```bash
git add src/lib/qstash.ts src/app/api/services/route.ts src/app/api/oauth/callback/*/route.ts src/app/api/services/*/credentials/route.ts
git commit -m "feat: tier-aware QStash polling frequency"
```

---

## Task 5: Install Stripe & Add Env Vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/lib/stripe.ts`

**Step 1: Install Stripe**

Run: `pnpm add stripe @stripe/stripe-js`

**Step 2: Add env vars to `.env.example`**

Append:
```bash
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_MONTHLY_PRICE_ID=
STRIPE_PRO_YEARLY_PRICE_ID=
STRIPE_BUSINESS_MONTHLY_PRICE_ID=
STRIPE_BUSINESS_YEARLY_PRICE_ID=
```

**Step 3: Create Stripe server client**

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})

export const PRICE_TO_PLAN: Record<string, { plan: string; cycle: string }> = {
  [process.env.STRIPE_PRO_MONTHLY_PRICE_ID!]: { plan: 'pro', cycle: 'monthly' },
  [process.env.STRIPE_PRO_YEARLY_PRICE_ID!]: { plan: 'pro', cycle: 'yearly' },
  [process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID!]: { plan: 'business', cycle: 'monthly' },
  [process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID!]: { plan: 'business', cycle: 'yearly' },
}
```

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example src/lib/stripe.ts
git commit -m "feat: add Stripe SDK and server client"
```

---

## Task 6: Stripe Checkout API Route

**Files:**
- Create: `src/app/api/stripe/checkout/route.ts`
- Test: `src/app/api/stripe/checkout/__tests__/route.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } }, error: null }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: null }, error: null }),
    }),
  }),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { create: vi.fn().mockResolvedValue({ id: 'cus_123' }) },
    checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/xxx' }) } },
  },
}))

import { POST } from '../route'

describe('POST /api/stripe/checkout', () => {
  it('returns checkout session URL', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ priceId: 'price_pro_monthly' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('checkout.stripe.com')
  })
})
```

**Step 2: Implement route**

```typescript
// src/app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { priceId } = await req.json()
  if (!priceId) {
    return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
  }

  // Get or create Stripe customer
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  let customerId = sub?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email!, metadata: { userId: user.id } })
    customerId = customer.id
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${APP_URL}/dashboard`,
    metadata: { userId: user.id },
  })

  return NextResponse.json({ url: session.url })
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run src/app/api/stripe/checkout/__tests__/route.test.ts
git add src/app/api/stripe/checkout/
git commit -m "feat: add Stripe Checkout API route"
```

---

## Task 7: Stripe Webhook Handler

**Files:**
- Create: `src/app/api/stripe/webhook/route.ts`
- Test: `src/app/api/stripe/webhook/__tests__/route.test.ts`

**Step 1: Write test**

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
  },
  PRICE_TO_PLAN: { 'price_pro': { plan: 'pro', cycle: 'monthly' } },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}))

import { stripe } from '@/lib/stripe'
import { POST } from '../route'

describe('POST /api/stripe/webhook', () => {
  it('handles checkout.session.completed event', async () => {
    vi.mocked(stripe.webhooks.constructEvent).mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'u1' },
          customer: 'cus_123',
          subscription: 'sub_456',
        },
      },
    } as any)

    const req = new Request('http://localhost', {
      method: 'POST',
      body: 'raw-body',
      headers: { 'stripe-signature': 'sig_test' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Implement webhook handler**

```typescript
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { stripe, PRICE_TO_PLAN } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.metadata?.userId
    if (!userId) return NextResponse.json({ error: 'No userId' }, { status: 400 })

    // Fetch subscription to get price ID
    const sub = await stripe.subscriptions.retrieve(session.subscription)
    const priceId = sub.items.data[0]?.price.id
    const planInfo = PRICE_TO_PLAN[priceId] ?? { plan: 'pro', cycle: 'monthly' }

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      plan: planInfo.plan,
      billing_cycle: planInfo.cycle,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as any
    const priceId = sub.items.data[0]?.price.id
    const planInfo = PRICE_TO_PLAN[priceId]

    if (planInfo) {
      await supabase.from('subscriptions')
        .update({
          plan: planInfo.plan,
          billing_cycle: planInfo.cycle,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', sub.id)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as any
    await supabase.from('subscriptions')
      .update({ plan: 'free', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', sub.id)
  }

  return NextResponse.json({ received: true })
}
```

**Step 3: Run tests, commit**

```bash
npx vitest run src/app/api/stripe/webhook/__tests__/route.test.ts
git add src/app/api/stripe/webhook/
git commit -m "feat: add Stripe webhook handler for subscription sync"
```

---

## Task 8: Landing Page Pricing Section

**Files:**
- Modify: `src/app/page.tsx` — add Pricing section between Features and CTA

**Step 1: Add pricing data and section**

Insert after the Features section closing `</section>` (around line 362):

```typescript
{/* ── Pricing ──────────────────────────────────────────────────────── */}
<section
  id="pricing"
  className="flex flex-col items-center px-14 py-20"
  style={{ background: 'var(--background)' }}
>
  <span
    className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
    style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
  >
    Pricing
  </span>

  <h2
    className="text-4xl font-bold text-center mb-4"
    style={{ color: 'var(--foreground)' }}
  >
    Simple, transparent pricing
  </h2>
  <p
    className="text-base text-center mb-12 max-w-xl"
    style={{ color: 'var(--muted-foreground)' }}
  >
    Start free, upgrade when you need more. No hidden fees.
  </p>

  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
    {/* Free */}
    <div
      className="flex flex-col p-6 rounded-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>Free</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>For side projects</p>
      <p className="text-4xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
        $0<span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>/month</span>
      </p>
      <ul className="flex flex-col gap-2 mb-6 flex-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <li>3 connected services</li>
        <li>Hourly polling</li>
        <li>3 alert rules</li>
        <li>Email notifications</li>
        <li>7-day data retention</li>
      </ul>
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Start Free</Link>
      </Button>
    </div>

    {/* Pro — highlighted */}
    <div
      className="flex flex-col p-6 rounded-xl relative"
      style={{ background: 'var(--card)', border: '2px solid var(--primary)' }}
    >
      <span
        className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-0.5 rounded-full"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        Popular
      </span>
      <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>Pro</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>For indie developers</p>
      <p className="text-4xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
        $4.99<span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>/month</span>
      </p>
      <ul className="flex flex-col gap-2 mb-6 flex-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <li>15 connected services</li>
        <li>Every 15 min polling</li>
        <li>3 team members</li>
        <li>20 alert rules</li>
        <li>Email + Slack notifications</li>
        <li>30-day data retention</li>
      </ul>
      <Button size="sm" asChild>
        <Link href="/login">Get Started</Link>
      </Button>
    </div>

    {/* Business */}
    <div
      className="flex flex-col p-6 rounded-xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--foreground)' }}>Business</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>For teams</p>
      <p className="text-4xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
        $19.99<span className="text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>/month</span>
      </p>
      <ul className="flex flex-col gap-2 mb-6 flex-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        <li>Unlimited services</li>
        <li>Every 5 min polling</li>
        <li>10 team members</li>
        <li>Unlimited alert rules</li>
        <li>All notification channels</li>
        <li>90-day data retention</li>
      </ul>
      <Button variant="outline" size="sm" asChild>
        <Link href="/login">Get Started</Link>
      </Button>
    </div>
  </div>
</section>
```

**Step 2: Update Pricing nav link**

Change line 76 from `href="#"` to `href="#pricing"` for the Pricing link.

**Step 3: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add pricing section to landing page"
```

---

## Task 9: Dynamic Plan Display in Sidebar

**Files:**
- Modify: `src/components/app-sidebar.tsx` — accept `planName` prop
- Modify: `src/app/(app)/layout.tsx` — fetch plan and pass to sidebar

**Step 1: Update sidebar props**

In `src/components/app-sidebar.tsx`:

```typescript
interface AppSidebarProps {
  userEmail: string
  alertCount?: number
  planName?: string
}
```

Replace the "Free Plan" text (line ~110):
```typescript
<span className="text-[10px]" style={{ color: 'var(--sp-text-tertiary)' }}>
  {planName ?? 'Free Plan'}
</span>
```

**Step 2: Update layout to fetch plan**

In `src/app/(app)/layout.tsx`, after fetching user, add:

```typescript
const { data: subscription } = await supabase
  .from('subscriptions')
  .select('plan')
  .eq('user_id', user.id)
  .single()

const planDisplayNames: Record<string, string> = {
  free: 'Free Plan',
  pro: 'Pro Plan',
  business: 'Business Plan',
}
const planName = planDisplayNames[subscription?.plan ?? 'free']
```

Pass to sidebar:
```typescript
<AppSidebar userEmail={user.email!} alertCount={alertCount} planName={planName} />
```

**Step 3: Build check, commit**

```bash
npm run build
git add src/components/app-sidebar.tsx src/app/\(app\)/layout.tsx
git commit -m "feat: show dynamic plan name in sidebar"
```

---

## Task 10: Final Verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Visual verification**

Run: `npm run dev` and check:
- Landing page: Pricing section displays 3 cards
- Dashboard sidebar: Shows "Free Plan" for users without subscription
- Connecting a 4th service on free plan returns 403 error

**Step 4: Final commit**

If any loose changes remain, commit them.
