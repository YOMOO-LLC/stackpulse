import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'
import { AlertToastContainer } from '@/components/alert-toast'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Count recent alert events (last 24h) for sidebar badge
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: services } = await supabase
    .from('connected_services')
    .select('id')
    .eq('user_id', user.id)

  const serviceIds = (services ?? []).map((s) => s.id)
  let alertCount = 0

  if (serviceIds.length > 0) {
    const { data: configs } = await supabase
      .from('alert_configs')
      .select('id')
      .in('connected_service_id', serviceIds)

    const configIds = (configs ?? []).map((c) => c.id)
    if (configIds.length > 0) {
      const { count } = await supabase
        .from('alert_events')
        .select('id', { count: 'exact', head: true })
        .in('alert_config_id', configIds)
        .gte('notified_at', since)
      alertCount = count ?? 0
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <AppSidebar userEmail={user.email ?? ''} alertCount={alertCount} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <AlertToastContainer />
    </div>
  )
}
