-- 已连接的服务
create table public.connected_services (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  provider_id text not null,
  label       text,
  credentials text not null,  -- AES-256-GCM 加密后的 base64
  auth_expired boolean default false,
  consecutive_failures int default 0,
  enabled     boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 指标快照（保留最近 7 天）
create table public.metric_snapshots (
  id                   uuid primary key default gen_random_uuid(),
  connected_service_id uuid references public.connected_services on delete cascade not null,
  collector_id         text not null,
  value                numeric,
  value_text           text,
  unit                 text,
  status               text not null default 'unknown',
  fetched_at           timestamptz default now()
);

create index metric_snapshots_service_collector_idx
  on public.metric_snapshots(connected_service_id, collector_id, fetched_at desc);

-- 告警配置
create table public.alert_configs (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users on delete cascade not null,
  connected_service_id uuid references public.connected_services on delete cascade not null,
  collector_id         text not null,
  condition            text not null,  -- "lt" | "gt" | "eq" | "status_is"
  threshold_numeric    numeric,
  threshold_text       text,
  enabled              boolean default true,
  created_at           timestamptz default now()
);

-- 告警事件历史
create table public.alert_events (
  id              uuid primary key default gen_random_uuid(),
  alert_config_id uuid references public.alert_configs on delete cascade not null,
  triggered_value_numeric numeric,
  triggered_value_text    text,
  notified_at     timestamptz default now()
);

-- 通知渠道
create table public.notification_channels (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name    text not null,
  type    text not null,   -- "email" | "slack" | "discord" | "webhook"
  config  jsonb not null,  -- { url, token, ... }
  enabled boolean default true,
  created_at timestamptz default now()
);

-- 自动更新 updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger connected_services_updated_at
  before update on public.connected_services
  for each row execute procedure public.handle_updated_at();
