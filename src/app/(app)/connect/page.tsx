import Link from 'next/link'
import { getAllProviders } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import type { ServiceProvider } from '@/lib/providers'

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI / LLM',
  email: 'Email',
  monitoring: 'Monitoring',
  payment: 'Payments',
  hosting: 'DevOps',
  infrastructure: 'Infrastructure',
  other: 'Other',
}

const CATEGORY_ORDER = ['ai', 'payment', 'hosting', 'infrastructure', 'monitoring', 'email', 'other']

export default function ConnectPage() {
  const providers = getAllProviders()

  const grouped = providers.reduce((acc, p) => {
    const cat = p.category ?? 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {} as Record<string, ServiceProvider[]>)

  const sortedCategories = CATEGORY_ORDER.filter((cat) => grouped[cat]?.length)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">Connect a Service</h1>
        <p className="text-sm text-muted-foreground mt-1">Select an API service to connect</p>
      </div>

      <div className="space-y-8">
        {sortedCategories.map((category) => (
          <section key={category}>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {grouped[category].map((provider) => (
                <Link key={provider.id} href={`/connect/${provider.id}`}>
                  <div className="bg-card border border-border rounded-xl p-5 hover:border-emerald-500/30 hover:bg-card/80 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3 mb-3">
                      <ProviderIcon providerId={provider.id} size={36} />
                      <div>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                          {provider.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[provider.category] ?? provider.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {provider.authType === 'oauth2' ? 'OAuth' :
                         provider.authType === 'hybrid' ? 'OAuth / API Key' : 'API Key'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Tracks {provider.collectors.length} metric{provider.collectors.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
