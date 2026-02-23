import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getProvider } from '@/lib/providers'
import {
  Server, CheckCircle, TriangleAlert, CircleX, CircleCheck,
} from 'lucide-react'
import {
  timeAgo, groupByProvider, formatAlertTitle,
  type ServiceRow, type CollectorRow,
} from './helpers'
import { CollapsibleServiceTable } from './collapsible-service-table'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

// ── Status helpers ────────────────────────────────────────────────────────────

function serviceStatus(collectors: CollectorRow[]): Status {
  if (collectors.some((c) => c.snapshot?.status === 'critical')) return 'critical'
  if (collectors.some((c) => c.snapshot?.status === 'warning'))  return 'warning'
  if (collectors.every((c) => !c.snapshot || c.snapshot.status === 'healthy')) return 'healthy'
  return 'unknown'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Services ─────────────────────────────────────────────────────────────
  const { data: services } = await supabase
    .from('connected_services')
    .select(`
      id, provider_id, label, enabled, auth_expired, created_at,
      metric_snapshots (
        collector_id, value, value_text, unit, status, fetched_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const servicesWithMeta: ServiceRow[] = (services ?? []).map((service) => {
    const provider = getProvider(service.provider_id)
    const snapshots = (service.metric_snapshots ?? []) as Array<{
      collector_id: string; value: number | null; value_text: string | null
      unit: string | null; status: string; fetched_at: string
    }>

    const latestByCollector = new Map<string, typeof snapshots[number]>()
    for (const snap of [...snapshots].sort(
      (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )) {
      if (!latestByCollector.has(snap.collector_id)) latestByCollector.set(snap.collector_id, snap)
    }

    const collectors: CollectorRow[] = (provider?.collectors ?? []).map((c) => ({
      id: c.id, name: c.name,
      snapshot: (latestByCollector.get(c.id) ?? null) as CollectorRow['snapshot'],
    }))

    const lastUpdated = collectors
      .map((c) => c.snapshot?.fetched_at).filter(Boolean).sort().pop()

    const status: Status = service.auth_expired ? 'critical' : serviceStatus(collectors)

    return {
      id: service.id,
      providerId: service.provider_id,
      label: service.label ?? provider?.name ?? service.provider_id,
      providerName: provider?.name ?? service.provider_id,
      status,
      collectors,
      lastUpdated,
    }
  })

  // Summary counts
  const totalCount   = servicesWithMeta.length
  const healthyCount = servicesWithMeta.filter((s) => s.status === 'healthy').length
  const warningCount = servicesWithMeta.filter((s) => s.status === 'warning').length
  const errorCount   = servicesWithMeta.filter((s) => s.status === 'critical').length
  const warningNames = servicesWithMeta.filter((s) => s.status === 'warning').map((s) => s.label).join(', ')
  const failedNames  = servicesWithMeta.filter((s) => s.status === 'critical').map((s) => s.label).join(', ')

  const groups = groupByProvider(servicesWithMeta)

  // ── Recent alert events ───────────────────────────────────────────────────
  const serviceIds = servicesWithMeta.map((s) => s.id)
  let recentAlerts: Array<{
    id: string
    notified_at: string
    collector_id: string
    condition: string
    threshold_numeric: number | null
    serviceLabel: string
    severity: Status
  }> = []

  if (serviceIds.length > 0) {
    const { data: configs } = await supabase
      .from('alert_configs')
      .select('id, collector_id, condition, threshold_numeric, connected_service_id')
      .in('connected_service_id', serviceIds)

    const configIds = (configs ?? []).map((c) => c.id)
    if (configIds.length > 0) {
      const { data: events } = await supabase
        .from('alert_events')
        .select('id, notified_at, alert_config_id')
        .in('alert_config_id', configIds)
        .order('notified_at', { ascending: false })
        .limit(5)

      const configMap = new Map((configs ?? []).map((c) => [c.id, c]))
      recentAlerts = (events ?? []).map((e) => {
        const cfg = configMap.get(e.alert_config_id)
        const svc = servicesWithMeta.find((s) => s.id === cfg?.connected_service_id)
        return {
          id: e.id,
          notified_at: e.notified_at,
          collector_id: cfg?.collector_id ?? '',
          condition: cfg?.condition ?? '',
          threshold_numeric: cfg?.threshold_numeric ?? null,
          serviceLabel: svc?.label ?? 'Unknown service',
          severity: (cfg?.condition === 'gt' ? 'critical' : 'warning') as Status,
        }
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col gap-6"
      style={{ padding: '28px 32px', background: 'var(--background)', minHeight: '100%' }}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1
            className="text-2xl font-bold"
            style={{ color: '#F0F0F5', letterSpacing: '-0.5px' }}
          >
            Dashboard
          </h1>
          <p className="text-sm" style={{ color: '#8888A0' }}>
            Monitor all your connected services at a glance
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            asChild
            variant="outline"
            size="sm"
            style={{ border: '1px solid #1E1E2A', background: 'transparent', color: '#F0F0F5' }}
          >
            <Link href="/connect">+ Add Service</Link>
          </Button>
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Active Services */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: '#111118', border: '1px solid #1E1E2A' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#8888A0' }}>Active Services</span>
            <Server className="h-4 w-4" style={{ color: '#555570' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: '#F0F0F5', letterSpacing: '-1px' }}>
            {totalCount}
          </span>
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#10B981' }}>
            {totalCount > 0 ? `${totalCount} connected` : 'No services yet'}
          </span>
        </div>

        {/* Healthy */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: '#111118', border: '1px solid #1E1E2A' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#8888A0' }}>Healthy</span>
            <CircleCheck className="h-4 w-4" style={{ color: '#10B981' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: '#10B981', letterSpacing: '-1px' }}>
            {healthyCount}
          </span>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: '#1E1E2A' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0}%`,
                background: '#10B981',
              }}
            />
          </div>
        </div>

        {/* Warnings */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: '#111118', border: '1px solid #1E1E2A' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#8888A0' }}>Warnings</span>
            <TriangleAlert className="h-4 w-4" style={{ color: '#F59E0B' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: '#F59E0B', letterSpacing: '-1px' }}>
            {warningCount}
          </span>
          {warningCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: '#F59E0B' }} />
              <span className="text-xs truncate" style={{ color: '#555570' }}>{warningNames}</span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#555570' }}>All clear</span>
          )}
        </div>

        {/* Failed */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: '#111118', border: '1px solid #1E1E2A' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: '#8888A0' }}>Failed</span>
            <CircleX className="h-4 w-4" style={{ color: '#EF4444' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: '#EF4444', letterSpacing: '-1px' }}>
            {errorCount}
          </span>
          {errorCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: '#EF4444' }} />
              <span className="text-xs truncate" style={{ color: '#555570' }}>{failedNames}</span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: '#555570' }}>No failures</span>
          )}
        </div>
      </div>

      {/* ── Connected Services ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: '#F0F0F5' }}>
            Connected Services
          </h2>
          <Link
            href="/connect"
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: '#10B981' }}
          >
            View All
          </Link>
        </div>

        {servicesWithMeta.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
            style={{ background: '#111118', border: '1px solid #1E1E2A' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: '#1A1A24', border: '1px solid #1E1E2A' }}
            >
              <Server className="h-6 w-6" style={{ color: '#555570' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: '#F0F0F5' }}>
              No services connected
            </p>
            <p className="text-xs mb-4" style={{ color: '#8888A0' }}>
              Connect your first API service to start monitoring
            </p>
            <Button
              asChild size="sm"
              style={{ background: '#10B981', color: '#000' }}
            >
              <Link href="/connect">Connect a service</Link>
            </Button>
          </div>
        ) : (
          <CollapsibleServiceTable groups={groups} />
        )}
      </section>

      {/* ── Recent Alert Events ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: '#F0F0F5' }}>
            Recent Alert Events
          </h2>
          <Link
            href="/dashboard/history"
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: '#10B981' }}
          >
            View History
          </Link>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#111118', border: '1px solid #1E1E2A' }}
        >
          {recentAlerts.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: '#10B98120' }}
              >
                <CheckCircle className="h-4 w-4" style={{ color: '#10B981' }} />
              </div>
              <span className="text-sm" style={{ color: '#8888A0' }}>
                No alert events recently
              </span>
            </div>
          ) : (
            recentAlerts.map((alert, i) => {
              const isLast = i === recentAlerts.length - 1
              const isCritical = alert.severity === 'critical'
              const accentColor = isCritical ? '#EF4444' : '#F59E0B'
              const accentBg   = isCritical ? '#EF444420' : '#F59E0B20'
              const badgeLabel = isCritical ? 'Critical' : 'Warning'
              const title = formatAlertTitle(
                alert.serviceLabel,
                alert.collector_id,
                alert.condition,
                alert.threshold_numeric,
              )

              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3.5 px-4 py-3.5"
                  style={{ borderBottom: isLast ? undefined : '1px solid #1E1E2A' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: accentBg }}
                  >
                    <TriangleAlert className="h-4 w-4" style={{ color: accentColor }} />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate" style={{ color: '#F0F0F5' }}>
                      {title}
                    </span>
                    <span className="text-[11px]" style={{ color: '#555570' }}>
                      Triggered {timeAgo(alert.notified_at)}
                      {user?.email ? ` • Sent email to ${user.email}` : ''}
                    </span>
                  </div>
                  <span
                    className="rounded-full text-[11px] font-medium flex-shrink-0 px-2 py-0.5"
                    style={{ background: accentBg, color: accentColor }}
                  >
                    {badgeLabel}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </section>

    </div>
  )
}
