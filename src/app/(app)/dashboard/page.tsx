import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProviderIcon } from '@/components/provider-icon'
import { getProvider } from '@/lib/providers'
import {
  Server, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, AlertOctagon,
} from 'lucide-react'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function serviceStatus(collectors: Array<{ snapshot: { status: string } | null }>): Status {
  if (collectors.some((c) => c.snapshot?.status === 'critical')) return 'critical'
  if (collectors.some((c) => c.snapshot?.status === 'warning'))  return 'warning'
  if (collectors.every((c) => !c.snapshot || c.snapshot.status === 'healthy')) return 'healthy'
  return 'unknown'
}

const STATUS_BADGE: Record<Status, { label: string; bg: string; color: string }> = {
  healthy:  { label: 'Healthy',  bg: 'var(--sp-success-muted)', color: 'var(--sp-success)' },
  warning:  { label: 'Warning',  bg: 'var(--sp-warning-muted)', color: 'var(--sp-warning)' },
  critical: { label: 'Critical', bg: 'var(--sp-error-muted)',   color: 'var(--sp-error)'   },
  unknown:  { label: 'Unknown',  bg: 'var(--muted)',            color: 'var(--muted-foreground)' },
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon: Icon, iconColor, iconBg, sub, progressPct,
}: {
  label: string
  value: number
  icon: React.ElementType
  iconColor: string
  iconBg: string
  sub?: string
  progressPct?: number
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-xl flex-1"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: iconColor }}>{value}</p>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon className="h-4 w-4" style={{ color: iconColor }} />
        </div>
      </div>
      {progressPct !== undefined && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, background: iconColor }}
          />
        </div>
      )}
      {sub && (
        <p className="text-xs" style={{ color: 'var(--sp-text-tertiary)' }}>{sub}</p>
      )}
    </div>
  )
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

  const servicesWithMeta = (services ?? []).map((service) => {
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

    const collectors = (provider?.collectors ?? []).map((c) => ({
      id: c.id, name: c.name, type: c.metricType,
      snapshot: (latestByCollector.get(c.id) ?? null) as {
        collector_id: string; value: number | null; value_text: string | null
        unit: string | null; status: Status; fetched_at: string
      } | null,
    }))

    const lastUpdated = collectors
      .map((c) => c.snapshot?.fetched_at).filter(Boolean).sort().pop()

    const status = service.auth_expired ? 'critical' as Status : serviceStatus(collectors)

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

  // ── Recent alert events ───────────────────────────────────────────────────
  const serviceIds = servicesWithMeta.map((s) => s.id)
  let recentAlerts: Array<{
    id: string
    notified_at: string
    collector_id: string
    condition: string
    threshold_numeric: number | null
    triggered_value_numeric: number | null
    triggered_value_text: string | null
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
        .select('id, notified_at, triggered_value_numeric, triggered_value_text, alert_config_id')
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
          triggered_value_numeric: e.triggered_value_numeric,
          triggered_value_text: e.triggered_value_text,
          serviceLabel: svc?.label ?? 'Unknown service',
          severity: (cfg?.condition === 'gt' ? 'critical' : 'warning') as Status,
        }
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-8" style={{ background: 'var(--background)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Monitor all your connected services at a glance
          </p>
        </div>
        <Button asChild size="sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          <Link href="/connect">+ Add Service</Link>
        </Button>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <MetricCard
          label="Active Services"
          value={totalCount}
          icon={Server}
          iconColor="var(--foreground)"
          iconBg="var(--muted)"
        />
        <MetricCard
          label="Healthy"
          value={healthyCount}
          icon={CheckCircle2}
          iconColor="var(--sp-success)"
          iconBg="var(--sp-success-muted)"
          progressPct={totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0}
        />
        <MetricCard
          label="Warnings"
          value={warningCount}
          icon={AlertTriangle}
          iconColor="var(--sp-warning)"
          iconBg="var(--sp-warning-muted)"
          sub={warningCount > 0 ? 'Needs attention' : undefined}
        />
        <MetricCard
          label="Errors"
          value={errorCount}
          icon={XCircle}
          iconColor="var(--sp-error)"
          iconBg="var(--sp-error-muted)"
          sub={errorCount > 0 ? 'Verify auth/config' : undefined}
        />
      </div>

      {/* ── Connected Services ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Connected Services
          </h2>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            View All <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {servicesWithMeta.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <Server className="h-6 w-6" style={{ color: 'var(--muted-foreground)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              No services connected
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Connect your first API service to start monitoring
            </p>
            <Button asChild size="sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              <Link href="/connect">Connect a service</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {servicesWithMeta.map((svc) => {
              const badge = STATUS_BADGE[svc.status]
              // Pick primary metrics to show (max 2)
              const keyMetrics = svc.collectors
                .filter((c) => c.snapshot)
                .slice(0, 2)
              return (
                <Link
                  key={svc.id}
                  href={`/dashboard/${svc.id}`}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors hover:opacity-90"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  {/* Provider icon */}
                  <ProviderIcon providerId={svc.providerId} size={36} />

                  {/* Name */}
                  <div className="flex flex-col gap-0.5 w-36 flex-shrink-0">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                      {svc.label}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                      {svc.providerName}
                    </span>
                  </div>

                  {/* Status badge */}
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ background: badge.bg, color: badge.color }}
                  >
                    {badge.label}
                  </span>

                  {/* Key metrics */}
                  <div className="flex gap-6 flex-1">
                    {keyMetrics.map((c) => (
                      <div key={c.id} className="flex flex-col gap-0.5">
                        <span className="text-[10px]" style={{ color: 'var(--sp-text-tertiary)' }}>{c.name}</span>
                        <span className="text-sm font-semibold font-mono" style={{ color: 'var(--foreground)' }}>
                          {c.snapshot?.value_text
                            ?? (c.snapshot?.value !== null && c.snapshot?.value !== undefined
                              ? `${c.snapshot.value.toLocaleString()}${c.snapshot.unit ? ' ' + c.snapshot.unit : ''}`
                              : '—')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Last synced */}
                  {svc.lastUpdated && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--sp-text-tertiary)' }}>
                      Last synced {timeAgo(svc.lastUpdated)}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Recent Alert Events ────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Recent Alert Events
          </h2>
          <Link
            href="/dashboard/history"
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            View History <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--sp-success)' }} />
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No alert events in the last 24 hours
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentAlerts.map((alert) => {
              const isError = alert.severity === 'critical'
              const accentColor = isError ? 'var(--sp-error)' : 'var(--sp-warning)'
              const accentBg   = isError ? 'var(--sp-error-muted)' : 'var(--sp-warning-muted)'
              const badge = isError ? 'Critical' : 'Warning'
              const description = [
                alert.serviceLabel,
                alert.collector_id.replace(/_/g, ' '),
                alert.condition,
                alert.threshold_numeric !== null ? String(alert.threshold_numeric) : null,
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-xl"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${accentColor}`,
                  }}
                >
                  <AlertOctagon className="h-4 w-4 flex-shrink-0" style={{ color: accentColor }} />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>
                      {description}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--sp-text-tertiary)' }}>
                      {timeAgo(alert.notified_at)}
                    </span>
                  </div>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ background: accentBg, color: accentColor }}
                  >
                    {badge}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

    </div>
  )
}
