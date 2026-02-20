import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { MetricSection } from './metric-section'
import { AlertRulesSection } from './alert-rules-section'
import { RecentSnapshotsPanel } from './events-section'
import { DeleteServiceButton } from './delete-service-button'
import { SyncButton } from './sync-button'
import { CredentialReauthBanner } from '@/components/credential-reauth-banner'
import { ChevronRight } from 'lucide-react'
import { SimulateAlertButton } from './simulate-alert-button'
import { CustomDetailViewLoader } from '@/lib/providers/ui/loader'

interface PageProps {
  params: Promise<{ serviceId: string }>
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { serviceId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: service } = await supabase
    .from('connected_services')
    .select('id, provider_id, label, enabled, auth_expired')
    .eq('id', serviceId)
    .eq('user_id', user!.id)
    .single()

  if (!service) notFound()

  const provider = getProvider(service.provider_id)

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('collector_id, value, value_text, unit, status, fetched_at')
    .eq('connected_service_id', serviceId)
    .gte('fetched_at', since)
    .order('fetched_at', { ascending: true })

  const serviceName = service.label ?? provider?.name ?? service.provider_id

  return (
    <div className="p-8 flex flex-col gap-6" style={{ background: 'var(--background)' }}>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          Services
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span style={{ color: 'var(--foreground)' }}>{serviceName}</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProviderIcon providerId={service.provider_id} size={44} />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
              {serviceName}
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {provider?.name ?? service.provider_id} · {service.enabled ? 'Active' : 'Disabled'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton serviceId={serviceId} />
          <DeleteServiceButton serviceId={serviceId} />
        </div>
      </div>

      {service.auth_expired && provider && (
        <CredentialReauthBanner
          serviceId={serviceId}
          providerId={service.provider_id}
          credentialFields={provider.credentials ?? []}
          authType={provider.authType}
        />
      )}

      {/* Metrics Cards — horizontal row */}
      <MetricSection
        serviceId={serviceId}
        collectors={provider?.collectors ?? []}
        snapshots={snapshots ?? []}
      />

      {/* Provider-specific custom detail view (optional slot) */}
      <CustomDetailViewLoader
        providerId={service.provider_id}
        serviceId={serviceId}
        snapshots={snapshots ?? []}
        collectors={provider?.collectors ?? []}
      />

      {/* Two-column: Alert Rules | Recent Metric Snapshots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AlertRulesSection
          serviceId={serviceId}
          alertTemplates={provider?.alerts ?? []}
          collectors={provider?.collectors ?? []}
        />
        <RecentSnapshotsPanel
          snapshots={snapshots ?? []}
          collectors={provider?.collectors ?? []}
        />
      </div>

      {/* Simulate Alert — dev/test tool */}
      {(provider?.collectors ?? []).length > 0 && (
        <SimulateAlertButton
          serviceId={serviceId}
          collectors={provider?.collectors ?? []}
        />
      )}

    </div>
  )
}
