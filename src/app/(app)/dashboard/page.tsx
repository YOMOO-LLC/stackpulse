import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { getProvider } from '@/lib/providers'
import {
  Server, CheckCircle, TriangleAlert, CircleX, CircleCheck,
  Search, Plus, TrendingUp, ArrowUpRight,
} from 'lucide-react'
import {
  timeAgo, formatAlertTitle, pickKeyMetrics,
  type ServiceRow, type CollectorRow,
} from './helpers'
import { ProviderIcon } from '@/components/provider-icon'
import { DemoBanner } from '@/components/demo-banner'
import { UpgradeBanner } from '@/components/upgrade-banner'
import { getUserPlan } from '@/lib/subscription'
import { formatUsage, isAtLimit, getAddServiceAction } from './plan-helpers'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

// ── Status helpers ────────────────────────────────────────────────────────────

function serviceStatus(collectors: CollectorRow[]): Status {
  if (collectors.some((c) => c.snapshot?.status === 'critical')) return 'critical'
  if (collectors.some((c) => c.snapshot?.status === 'warning'))  return 'warning'
  if (collectors.every((c) => !c.snapshot || c.snapshot.status === 'healthy')) return 'healthy'
  return 'unknown'
}

function getStatusDisplay(status: Status, authExpired?: boolean) {
  if (status === 'critical' && authExpired) {
    return { label: 'Failed', color: 'var(--sp-error)', bg: 'var(--sp-error-muted)', dot: 'var(--sp-error)' }
  }
  const map: Record<Status, { label: string; color: string; bg: string; dot: string }> = {
    healthy:  { label: 'Healthy',  color: 'var(--primary)',          bg: 'var(--sp-success-muted)',  dot: 'var(--primary)' },
    warning:  { label: 'Warning',  color: 'var(--sp-warning)',       bg: 'var(--sp-warning-muted)',  dot: 'var(--sp-warning)' },
    critical: { label: 'Critical', color: 'var(--sp-error)',         bg: 'var(--sp-error-muted)',    dot: 'var(--sp-error)' },
    unknown:  { label: 'Unknown',  color: 'var(--sp-text-tertiary)', bg: 'var(--sp-bg-elevated)',    dot: 'var(--sp-text-tertiary)' },
  }
  return map[status]
}

function formatMetricValue(snapshot: CollectorRow['snapshot']): string {
  if (!snapshot) return '—'
  if (snapshot.value_text) return snapshot.value_text
  if (snapshot.value !== null) {
    const formatted = Number(snapshot.value).toLocaleString()
    return snapshot.unit ? `${formatted} ${snapshot.unit}` : formatted
  }
  return '—'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Plan data
  const { plan, limits } = await getUserPlan(user!.id)
  const maxServices = limits.maxServices
  const planDisplayNames: Record<string, string> = { free: 'Free', pro: 'Pro', business: 'Business' }
  const planLabel = planDisplayNames[plan] ?? plan

  // Upgraded toast
  const params = await searchParams
  const showUpgraded = params.upgraded === 'true'

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
      authExpired: !!service.auth_expired,
      collectors,
      lastUpdated,
    }
  })

  // Services added this week
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const servicesAddedThisWeek = (services ?? []).filter(
    (s) => s.created_at && s.created_at >= oneWeekAgo,
  ).length

  // Summary counts
  const totalCount   = servicesWithMeta.length
  const healthyCount = servicesWithMeta.filter((s) => s.status === 'healthy').length
  const warningCount = servicesWithMeta.filter((s) => s.status === 'warning').length
  const errorCount   = servicesWithMeta.filter((s) => s.status === 'critical').length
  const warningNames = servicesWithMeta.filter((s) => s.status === 'warning').map((s) => s.label).join(', ')
  const failedNames  = servicesWithMeta.filter((s) => s.status === 'critical').map((s) => s.label).join(', ')

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

      {showUpgraded && <UpgradeBanner planName={planLabel} />}

      {user?.email === process.env.NEXT_PUBLIC_DEMO_EMAIL && (
        <DemoBanner />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--foreground)', letterSpacing: '-0.5px' }}
          >
            Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Monitor all your connected services at a glance
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center gap-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--border)', padding: '8px 14px', color: 'var(--muted-foreground)' }}
          >
            <Search className="h-4 w-4 flex-shrink-0" />
            <span>Search...</span>
          </div>
          {(() => {
            const action = getAddServiceAction(totalCount, maxServices)
            return (
              <Button
                asChild
                size="sm"
                style={{
                  background: action.isUpgrade ? 'var(--primary)' : 'var(--primary)',
                  color: 'var(--primary-foreground)',
                }}
              >
                <Link href={action.href} className="flex items-center gap-1.5">
                  {action.isUpgrade ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {action.label}
                </Link>
              </Button>
            )
          })()}
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Active Services */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Active Services</span>
            <Server className="h-4 w-4" style={{ color: 'var(--sp-text-tertiary)' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: 'var(--foreground)', letterSpacing: '-1px' }}>
            {formatUsage(totalCount, maxServices)}
          </span>
          {isFinite(maxServices) && (
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(Math.round((totalCount / maxServices) * 100), 100)}%`,
                  background: isAtLimit(totalCount, maxServices) ? 'var(--sp-warning)' : 'var(--primary)',
                }}
              />
            </div>
          )}
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: isAtLimit(totalCount, maxServices) ? 'var(--sp-warning)' : 'var(--primary)' }}>
            {isAtLimit(totalCount, maxServices) ? (
              'Limit reached'
            ) : servicesAddedThisWeek > 0 ? (
              <>
                <TrendingUp className="h-3.5 w-3.5" />
                +{servicesAddedThisWeek} this week
              </>
            ) : totalCount > 0 ? (
              `${totalCount} connected`
            ) : (
              'No services yet'
            )}
          </span>
        </div>

        {/* Healthy */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Healthy</span>
            <CircleCheck className="h-4 w-4" style={{ color: 'var(--primary)' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: 'var(--primary)', letterSpacing: '-1px' }}>
            {healthyCount}
          </span>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0}%`,
                background: 'var(--primary)',
              }}
            />
          </div>
        </div>

        {/* Warnings */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Warnings</span>
            <TriangleAlert className="h-4 w-4" style={{ color: 'var(--sp-warning)' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: 'var(--sp-warning)', letterSpacing: '-1px' }}>
            {warningCount}
          </span>
          {warningCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: 'var(--sp-warning)' }} />
              <span className="text-xs truncate" style={{ color: 'var(--sp-text-tertiary)' }}>{warningNames}</span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--sp-text-tertiary)' }}>All clear</span>
          )}
        </div>

        {/* Failed */}
        <div
          className="flex flex-col gap-3 p-5 rounded-xl"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Critical</span>
            <CircleX className="h-4 w-4" style={{ color: 'var(--sp-error)' }} />
          </div>
          <span className="text-3xl font-bold" style={{ color: 'var(--sp-error)', letterSpacing: '-1px' }}>
            {errorCount}
          </span>
          {errorCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="rounded-full flex-shrink-0" style={{ width: 6, height: 6, background: 'var(--sp-error)' }} />
              <span className="text-xs truncate" style={{ color: 'var(--sp-text-tertiary)' }}>{failedNames}</span>
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--sp-text-tertiary)' }}>All clear</span>
          )}
        </div>
      </div>

      {/* ── Connected Services ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Connected Services
          </h2>
          <Link
            href="/connect"
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            View All
          </Link>
        </div>

        {servicesWithMeta.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--sp-bg-elevated)', border: '1px solid var(--border)' }}
            >
              <Server className="h-6 w-6" style={{ color: 'var(--sp-text-tertiary)' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>
              No services connected
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
              Connect your first API service to start monitoring
            </p>
            <Button
              asChild size="sm"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              <Link href="/connect">Connect a service</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {servicesWithMeta.map((svc) => {
              const badge = getStatusDisplay(svc.status, svc.authExpired)
              const metrics = pickKeyMetrics(svc.collectors, 3)
              return (
                <Link
                  key={svc.id}
                  href={`/dashboard/${svc.id}`}
                  className="flex flex-col rounded-xl transition-colors hover:border-primary/30"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: 18 }}
                >
                  {/* Card header: icon + name + status badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProviderIcon providerId={svc.providerId} size={36} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                          {svc.label}
                        </span>
                        <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                          {svc.providerName}
                        </span>
                      </div>
                    </div>
                    <span
                      className="flex items-center gap-1.5 rounded-full text-[11px] font-medium flex-shrink-0 px-2.5 py-1"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      <span
                        className="rounded-full flex-shrink-0"
                        style={{ width: 6, height: 6, background: badge.dot }}
                      />
                      {badge.label}
                    </span>
                  </div>

                  {/* Card metrics */}
                  {metrics.length > 0 && (
                    <div className="flex flex-col gap-2 mt-4">
                      {metrics.map((c) => {
                        const valueColor = c.snapshot?.status === 'warning'
                          ? 'var(--sp-warning)'
                          : c.snapshot?.status === 'critical'
                            ? 'var(--sp-error)'
                            : 'var(--foreground)'
                        return (
                          <div key={c.id} className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {c.name}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: valueColor }}>
                              {formatMetricValue(c.snapshot)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Card footer: last synced */}
                  <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <span className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
                      {svc.lastUpdated ? `Last synced ${timeAgo(svc.lastUpdated)}` : 'Not synced yet'}
                    </span>
                  </div>
                </Link>
              )
            })}

            {/* Upgrade prompt card when at service limit */}
            {isAtLimit(totalCount, maxServices) && (
              <Link
                href="/dashboard/billing"
                className="flex flex-col items-center justify-center gap-3 rounded-xl transition-colors hover:border-primary/40"
                style={{
                  border: '2px dashed var(--border)',
                  padding: 18,
                  minHeight: 160,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--sp-bg-elevated)' }}
                >
                  <ArrowUpRight className="h-5 w-5" style={{ color: 'var(--primary)' }} />
                </div>
                <p className="text-sm font-medium text-center" style={{ color: 'var(--muted-foreground)' }}>
                  Need more services?
                </p>
                <span
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  Upgrade Plan
                </span>
              </Link>
            )}
          </div>
        )}
      </section>

      {/* ── Recent Alert Events ────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Recent Alert Events
          </h2>
          <Link
            href="/dashboard/history"
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            View History
          </Link>
        </div>

        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {recentAlerts.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--sp-success-muted)' }}
              >
                <CheckCircle className="h-4 w-4" style={{ color: 'var(--primary)' }} />
              </div>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                No alert events recently
              </span>
            </div>
          ) : (
            recentAlerts.map((alert, i) => {
              const isLast = i === recentAlerts.length - 1
              const isCritical = alert.severity === 'critical'
              const accentColor = isCritical ? 'var(--sp-error)' : 'var(--sp-warning)'
              const accentBg   = isCritical ? 'var(--sp-error-muted)' : 'var(--sp-warning-muted)'
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
                  style={{ borderBottom: isLast ? undefined : '1px solid var(--border)' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: accentBg }}
                  >
                    <TriangleAlert className="h-4 w-4" style={{ color: accentColor }} />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {title}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
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
