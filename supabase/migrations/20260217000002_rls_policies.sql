-- 启用 RLS
alter table public.connected_services enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.alert_configs enable row level security;
alter table public.alert_events enable row level security;
alter table public.notification_channels enable row level security;

-- connected_services: 用户只能操作自己的数据
create policy "Users manage own services"
  on public.connected_services for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- metric_snapshots: 通过 connected_services 关联查权限
create policy "Users read own snapshots"
  on public.metric_snapshots for select
  using (
    exists (
      select 1 from public.connected_services cs
      where cs.id = connected_service_id and cs.user_id = auth.uid()
    )
  );

-- Service role 可以写入 snapshots（轮询 worker 用）
create policy "Service role insert snapshots"
  on public.metric_snapshots for insert
  with check (true);

-- alert_configs
create policy "Users manage own alerts"
  on public.alert_configs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- alert_events: 通过 alert_configs 关联查权限
create policy "Users read own alert events"
  on public.alert_events for select
  using (
    exists (
      select 1 from public.alert_configs ac
      where ac.id = alert_config_id and ac.user_id = auth.uid()
    )
  );

create policy "Service role insert alert events"
  on public.alert_events for insert
  with check (true);

-- notification_channels
create policy "Users manage own channels"
  on public.notification_channels for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
