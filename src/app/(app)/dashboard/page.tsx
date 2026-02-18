import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/components/service-card'
import { getProvider } from '@/lib/providers'

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
    const snapshots = service.metric_snapshots ?? []

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
      label: service.label ?? provider?.name ?? service.provider_id,
      providerName: provider?.name ?? service.provider_id,
      category: provider?.category ?? 'other',
      authExpired: service.auth_expired,
      collectors: (provider?.collectors ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.metricType,
        snapshot: latestByCollector.get(c.id) ?? null,
      })),
    }
  })

  const hasIssues = servicesWithMeta.some((s) =>
    s.collectors.some((c) => c.snapshot?.status === 'warning' || c.snapshot?.status === 'critical')
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">服务监控</h1>
          {servicesWithMeta.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {hasIssues ? '⚠ 部分服务需要关注' : '● 全部服务运行正常'}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/connect">+ 添加服务</Link>
        </Button>
      </div>

      {servicesWithMeta.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <p className="text-lg">还没有连接任何服务</p>
          <p className="text-sm mt-2">点击「添加服务」开始监控你的第三方 API</p>
          <Button asChild className="mt-4">
            <Link href="/connect">添加第一个服务</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicesWithMeta.map((service) => (
            <ServiceCard key={service.id} {...service} />
          ))}
        </div>
      )}
    </div>
  )
}
