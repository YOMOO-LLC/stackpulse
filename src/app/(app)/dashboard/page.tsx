import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/components/service-card'
import { StatusDot } from '@/components/status-dot'
import { getProvider } from '@/lib/providers'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
      collector_id: string; value: number | null; value_text: string | null;
      unit: string | null; status: string; fetched_at: string
    }>

    const latestByCollector = new Map<string, typeof snapshots[number]>()
    for (const snap of [...snapshots].sort((a, b) =>
      new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )) {
      if (!latestByCollector.has(snap.collector_id)) {
        latestByCollector.set(snap.collector_id, snap)
      }
    }

    return {
      id: service.id,
      providerId: service.provider_id,
      label: service.label ?? provider?.name ?? service.provider_id,
      providerName: provider?.name ?? service.provider_id,
      category: provider?.category ?? 'other',
      authExpired: service.auth_expired,
      collectors: (provider?.collectors ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.metricType,
        snapshot: (latestByCollector.get(c.id) ?? null) as {
          collector_id: string; value: number | null; value_text: string | null;
          unit: string | null; status: Status; fetched_at: string
        } | null,
      })),
    }
  })

  const totalCount = servicesWithMeta.length
  const healthyCount = servicesWithMeta.filter((s) =>
    s.collectors.every((c) => !c.snapshot || c.snapshot.status === 'healthy')
  ).length
  const hasIssues = healthyCount < totalCount

  return (
    <div className="p-8">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">服务监控</h1>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StatusDot status={hasIssues ? 'warning' : 'healthy'} />
              <span className="text-sm text-muted-foreground">
                {hasIssues
                  ? `${totalCount - healthyCount} 个服务需要关注`
                  : `全部 ${totalCount} 个服务运行正常`
                }
              </span>
            </div>
          )}
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/connect">+ 添加服务</Link>
        </Button>
      </div>

      {/* 空状态 */}
      {servicesWithMeta.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-6">
            <span className="text-2xl">📡</span>
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">还没有连接任何服务</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            连接你的 API 服务，实时掌握余额、状态和错误量
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/connect">连接第一个服务</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servicesWithMeta.map((service) => (
            <ServiceCard key={service.id} {...service} />
          ))}
        </div>
      )}
    </div>
  )
}
