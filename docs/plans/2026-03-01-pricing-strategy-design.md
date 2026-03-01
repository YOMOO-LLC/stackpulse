# StackPulse Pricing Strategy Design

**Date:** 2026-03-01
**Status:** Approved

## Context

StackPulse needs a pricing model that:
- Attracts indie developers with a generous free tier
- Converts to paid via clear value differentiation
- Covers infrastructure costs ($25-50/month fixed)
- Is simple enough to display on a landing page

## Cost Structure

### Fixed Costs
- Supabase Pro: $25/month
- QStash: Free tier 1,000 messages/day, then $1/100K
- Vercel: Free tier (scale to Pro $20/month later)
- Resend: Free tier 100 emails/day

### Per-User Marginal Cost
- QStash: ~$0.43/month per Pro user (15 services × 96 msgs/day × 30 days)
- Negligible for Supabase row storage and Resend alerts
- **Total marginal cost ≈ $0.50/user/month**

### Break-Even
- At $4.99/month Pro: 6 paying users covers $25 Supabase
- At $19.99/month Business: 3 paying users covers $50 total infra

## Pricing Tiers

### Free — $0/month
- 3 connected services
- Hourly polling (every 60 minutes)
- 1 team member
- 3 alert rules
- Email notifications only
- 7-day data retention
- Community support

### Pro — $4.99/month ($49.99/year, save 17%)
- 15 connected services
- 15-minute polling
- 3 team members
- 20 alert rules
- Email + Slack notifications
- 30-day data retention
- Email support

### Business — $19.99/month ($199.99/year, save 17%)
- Unlimited connected services
- 5-minute polling
- 10 team members
- Unlimited alert rules
- Email + Slack + Webhook + PagerDuty
- 90-day data retention
- Priority email support

## Tier Positioning

| Tier | Target | Upgrade Trigger |
|------|--------|-----------------|
| Free | Side projects, evaluation | Hits 3-service limit or needs faster polling |
| Pro | Indie devs, small teams | "Coffee money" impulse price, covers most needs |
| Business | Startups, engineering teams | Needs team collaboration, high-frequency monitoring, multi-channel alerts |

## Enforced Limits (Implementation)

| Limit | Where Enforced |
|-------|----------------|
| Service count | `POST /api/services` — check count before insert |
| Polling frequency | `registerServiceSchedule()` — cron expression per tier |
| Team members | `POST /api/team/invite` — check member count |
| Alert rules | `POST /api/alerts` — check rule count |
| Notification channels | `POST /api/channels` — check channel type against tier |
| Data retention | Supabase cron job — delete snapshots older than tier limit |

## Database Schema Addition

```sql
-- Add plan column to auth.users metadata or a new subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
```

## Payment Integration

Stripe Checkout for subscriptions:
- 4 Stripe Price objects: Pro monthly, Pro yearly, Business monthly, Business yearly
- Webhook endpoint to sync subscription status
- Graceful downgrade: when subscription expires, stop creating new services beyond free limit but don't delete existing ones

## Landing Page Pricing Section

Three-column card layout matching existing design system:
- Free card: outlined border
- Pro card: highlighted with "Popular" badge
- Business card: outlined border
- Toggle for monthly/yearly billing
- "Start Free" / "Upgrade" / "Contact Sales" CTAs
