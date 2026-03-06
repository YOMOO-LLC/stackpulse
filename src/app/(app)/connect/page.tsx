import Link from 'next/link'
import { getAllProviders } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'

// Provider descriptions (shown on cards)
const DESCRIPTIONS: Record<string, string> = {
  github:        'Monitor rate limits, repository count, and API usage via OAuth2.',
  stripe:        'Track account balance, payment status, and revenue metrics.',
  vercel:        'Monitor bandwidth usage, deployment status, and project health.',
  openai:        'Track credit balance, monthly usage, and spending trends.',
  sentry:        'Monitor error counts, issue tracking, and application health.',
  resend:        'Track email delivery, connection status, and sending health.',
  openrouter:    'Monitor credit balance and model usage across OpenRouter AI.',
  'upstash-redis':  'Track daily commands, memory usage, and database health.',
  'upstash-qstash': 'Monitor message delivery, failures, and monthly quota usage.',
}

const AUTH_LABEL: Record<string, string> = {
  api_key: 'API Key',
  oauth2:  'OAuth2',
  hybrid:  'OAuth2',
  token:   'Token',
}

export default async function ConnectPage() {
  const providers = getAllProviders()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { limits } = await getUserPlan(user!.id)
  const { count: serviceCount } = await supabase
    .from('connected_services')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user!.id)

  const atLimit = (serviceCount ?? 0) >= limits.maxServices
  const showBanner = atLimit && limits.maxServices !== Infinity

  return (
    <div className="p-8 flex flex-col gap-6" style={{ background: 'var(--background)' }}>

      {/* Limit warning banner */}
      {showBanner && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: 'color-mix(in srgb, #f59e0b 15%, transparent)',
            border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
            color: '#fbbf24',
          }}
        >
          <span>
            You&apos;ve used {serviceCount}/{limits.maxServices} services. Upgrade to connect more.
          </span>
          <Link
            href="/dashboard/billing"
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
          Connect a Service
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Choose a provider to connect and start monitoring metrics
        </p>
      </div>

      {/* Section label */}
      <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        Available Providers
      </p>

      {/* Provider grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <Link
            key={provider.id}
            href={atLimit ? '/dashboard/billing' : `/connect/${provider.id}`}
            className="group block"
          >
            <div
              className="sp-provider-card flex flex-col gap-4 p-5 rounded-xl h-full transition-colors"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                opacity: atLimit ? 0.6 : 1,
              }}
            >
              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <ProviderIcon providerId={provider.id} size={40} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {provider.name}
                </h3>
              </div>

              {/* Description */}
              <p
                className="text-xs leading-relaxed flex-1"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {DESCRIPTIONS[provider.id] ?? `Connect ${provider.name} to monitor metrics.`}
              </p>

              {/* Footer: auth badge + connect button */}
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{
                    background: 'var(--muted)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  {AUTH_LABEL[provider.authType] ?? provider.authType}
                </span>
                {atLimit ? (
                  <span
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: 'var(--muted)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    Upgrade required
                  </span>
                ) : (
                  <span
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{
                      background: 'var(--primary)',
                      color: 'var(--primary-foreground)',
                    }}
                  >
                    Connect
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
