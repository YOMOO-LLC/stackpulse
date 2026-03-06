-- Data retention cleanup: automatically delete old metric_snapshots
-- based on user's subscription plan retention limits.
--
-- Retention policy (from src/lib/subscription.ts):
--   free     -> 7 days
--   pro      -> 30 days
--   business -> 90 days
--
-- Requires pg_cron extension (available on Supabase Pro plan).
-- On Supabase free tier or local development, pg_cron is not available
-- and this migration will fail — it can be safely skipped in those environments.

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-old-snapshots',
  '0 3 * * *',
  $$
  DELETE FROM public.metric_snapshots ms
  WHERE ms.fetched_at < now() - (
    SELECT CASE COALESCE(s.plan, 'free')
      WHEN 'business' THEN interval '90 days'
      WHEN 'pro'      THEN interval '30 days'
      ELSE                  interval '7 days'
    END
    FROM public.connected_services cs
    LEFT JOIN public.subscriptions s ON s.user_id = cs.user_id
    WHERE cs.id = ms.connected_service_id
  )
  $$
);
