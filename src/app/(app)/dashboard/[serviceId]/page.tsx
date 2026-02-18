import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { MetricSection } from './metric-section'
import { AlertRulesSection } from './alert-rules-section'
import { EventsSection } from './events-section'
import { DeleteServiceButton } from './delete-service-button'
import { CredentialReauthBanner } from '@/components/credential-reauth-banner'
import { ArrowLeft } from 'lucide-react'

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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Services
          </Link>
          <div className="flex items-center gap-2.5">
            <ProviderIcon providerId={service.provider_id} size={32} />
            <h1 className="text-lg font-semibold text-foreground">
              {service.label ?? provider?.name ?? service.provider_id}
            </h1>
          </div>
        </div>
        <DeleteServiceButton serviceId={serviceId} />
      </div>

      {service.auth_expired && provider && (
        <CredentialReauthBanner
          serviceId={serviceId}
          providerId={service.provider_id}
          credentialFields={provider.credentials ?? []}
          authType={provider.authType}
        />
      )}

      <MetricSection
        serviceId={serviceId}
        collectors={provider?.collectors ?? []}
        snapshots={snapshots ?? []}
      />

      <AlertRulesSection
        serviceId={serviceId}
        alertTemplates={provider?.alerts ?? []}
        collectors={provider?.collectors ?? []}
      />

      <EventsSection serviceId={serviceId} />
    </div>
  )
}
