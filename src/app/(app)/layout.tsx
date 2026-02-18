import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 查询服务列表（用于侧边栏）
  const { data: services } = await supabase
    .from('connected_services')
    .select(`
      id, provider_id, label,
      metric_snapshots ( status, fetched_at )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const sidebarServices = (services ?? []).map((s) => {
    const snapshots = (s.metric_snapshots ?? []) as Array<{ status: string; fetched_at: string }>
    const sortedSnaps = [...snapshots].sort(
      (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )
    const latestStatus = sortedSnaps[0]?.status as Status | undefined
    return {
      id: s.id,
      label: s.label ?? s.provider_id,
      providerId: s.provider_id,
      status: (latestStatus ?? 'unknown') as Status,
    }
  })

  return (
    <div className="flex min-h-screen">
      <AppSidebar services={sidebarServices} userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
