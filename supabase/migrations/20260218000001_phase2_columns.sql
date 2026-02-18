-- Phase 2: QStash schedule tracking + alert cooldown

ALTER TABLE public.connected_services
  ADD COLUMN IF NOT EXISTS qstash_schedule_id text;

ALTER TABLE public.alert_configs
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
