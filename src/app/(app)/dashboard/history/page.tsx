import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, XCircle } from 'lucide-react'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

interface AlertConfig {
  id: string
  collector_id: string
  condition: string
  threshold_numeric: number | null
  connected_service_id: string
  connected_services: { provider_id: string; label: string | null }[] | null
}

interface AlertEvent {
  id: string
  notified_at: string
  triggered_value_numeric: number | null
  triggered_value_text: string | null
  alert_config_id: string
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all user's connected services
  const { data: services } = await supabase
    .from('connected_services')
    .select('id')
    .eq('user_id', user.id)

  const serviceIds = (services ?? []).map((s: { id: string }) => s.id)

  // Get alert configs for those services
  const { data: configs } = serviceIds.length > 0
    ? await supabase
        .from('alert_configs')
        .select('id, collector_id, condition, threshold_numeric, connected_service_id, connected_services(provider_id, label)')
        .in('connected_service_id', serviceIds)
    : { data: [] }

  const configIds = (configs ?? []).map((c: { id: string }) => c.id)
  const configMap = new Map((configs ?? []).map((c: AlertConfig) => [c.id, c]))

  // Get alert events
  const { data: events } = configIds.length > 0
    ? await supabase
        .from('alert_events')
        .select('id, notified_at, triggered_value_numeric, triggered_value_text, alert_config_id')
        .in('alert_config_id', configIds)
        .order('notified_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const items = events ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground mb-6">Alert History</h1>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alert events recorded yet.</p>
      ) : (
        <div className="space-y-1">
          {items.map((event: AlertEvent) => {
            const config = configMap.get(event.alert_config_id) as AlertConfig | undefined
            const isCritical = config?.condition === 'gt'
            const svc = config?.connected_services?.[0]
            const serviceName = svc?.label ?? svc?.provider_id ?? 'Unknown'
            const metricName = config?.collector_id?.replace(/_/g, ' ') ?? 'Unknown'

            let triggeredDisplay = event.triggered_value_text ?? ''
            if (event.triggered_value_numeric != null) {
              const threshold = config?.threshold_numeric
              if (threshold != null && threshold < 1000) {
                triggeredDisplay = `$${event.triggered_value_numeric.toFixed(2)}`
              } else {
                triggeredDisplay = String(event.triggered_value_numeric)
              }
            }

            return (
              <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                {isCritical
                  ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                }
                <span className="text-xs text-muted-foreground shrink-0 w-36">
                  {formatDate(event.notified_at)}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {serviceName}
                </span>
                <span className="text-sm text-foreground flex-1">
                  {metricName} triggered
                </span>
                <span className="text-sm font-medium text-foreground">
                  {triggeredDisplay}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
