import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ProviderIcon } from '@/components/provider-icon'
import { Zap } from 'lucide-react'

// ── Provider data for SEO page (static, no runtime registry dependency) ──────

interface IntegrationInfo {
  id: string
  name: string
  description: string
  authType: 'OAuth' | 'API Key' | 'Token'
  category: string
  metrics: string[]
}

const INTEGRATIONS: IntegrationInfo[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Monitor API rate limits, GraphQL quota, search quota, and public repository count across your GitHub organization.',
    authType: 'OAuth',
    category: 'Hosting',
    metrics: ['Rate Limit Remaining', 'Rate Limit Used', 'GraphQL Rate Limit', 'Search Rate Limit', 'Public Repos'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Track account balance, daily charges, active disputes, and subscription counts to stay on top of your payment infrastructure.',
    authType: 'API Key',
    category: 'Payment',
    metrics: ['Account Balance', 'Charges (24h)', 'Active Disputes', 'Active Subscriptions'],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Monitor deployments, success rates, serverless invocations, and project counts for your Vercel hosting platform.',
    authType: 'API Key',
    category: 'Hosting',
    metrics: ['Deployments (24h)', 'Deploy Success Rate', 'Serverless Invocations', 'Projects'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Keep an eye on credit balance, monthly usage, API request volume, and per-model usage breakdown.',
    authType: 'API Key',
    category: 'AI',
    metrics: ['Credit Balance', 'Monthly Usage', 'API Requests', 'Usage by Model'],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Track credit balance, monthly spend, request volume, and model utilization across the OpenRouter AI gateway.',
    authType: 'API Key',
    category: 'AI',
    metrics: ['Credit Balance', 'Monthly Spend', 'Requests (24h)', 'Models Used'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Monitor unresolved errors, Apdex scores, and event volume to catch application issues before users report them.',
    authType: 'OAuth',
    category: 'Monitoring',
    metrics: ['Unresolved Errors', 'Apdex', 'Events (24h)'],
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Track email delivery volume, bounce rates, domain health, and delivery success rates for your transactional emails.',
    authType: 'API Key',
    category: 'Email',
    metrics: ['Emails Sent (24h)', 'Bounce Rate', 'Domain Health'],
  },
  {
    id: 'upstash-redis',
    name: 'Upstash Redis',
    description: 'Monitor daily commands, memory usage, active connections, throughput, and performance metrics for your serverless Redis.',
    authType: 'API Key',
    category: 'Infrastructure',
    metrics: ['Daily Commands', 'Memory Usage', 'Connections', 'Throughput'],
  },
  {
    id: 'upstash-qstash',
    name: 'Upstash QStash',
    description: 'Track message delivery, failure rates, dead letter queue depth, and monthly quota usage for your message queue.',
    authType: 'Token',
    category: 'Infrastructure',
    metrics: ['Messages Delivered', 'Messages Failed', 'DLQ Depth', 'Monthly Quota'],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'Monitor connection status, response latency, API call volume, and uptime for the MiniMax AI platform.',
    authType: 'API Key',
    category: 'AI',
    metrics: ['Connection Status', 'Response Latency', 'API Calls (24h)', 'Uptime'],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Track database requests, auth activity, storage usage, active connections, and service health across your Supabase project.',
    authType: 'API Key',
    category: 'Infrastructure',
    metrics: ['DB Requests (24h)', 'Auth Requests', 'Active Connections', 'Disk Usage'],
  },
]

// ── Metadata (SEO) ──────────────────────────────────────────────────────────

const providerNames = INTEGRATIONS.map((p) => p.name).join(', ')

export const metadata: Metadata = {
  title: 'Integrations — Monitor GitHub, Stripe, OpenAI, Vercel & More',
  description: `StackPulse integrates with ${INTEGRATIONS.length}+ API providers including ${providerNames}. Monitor rate limits, credit balances, error counts, and deployment status from a single dashboard.`,
  keywords: [
    'API monitoring integrations',
    'GitHub API monitoring',
    'Stripe API monitoring',
    'OpenAI credit monitoring',
    'Vercel deployment monitoring',
    'Sentry error monitoring',
    'API rate limit alerts',
    'SaaS dependency monitoring',
  ],
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/connect')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-14 py-4"
        style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            SP
          </span>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            StackPulse
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/login">Get Started Free</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section
          className="flex flex-col items-center text-center px-14 pt-20 pb-16"
          style={{ background: 'var(--background)' }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
          >
            Integrations
          </span>

          <h1
            className="text-5xl font-bold leading-tight mb-6 max-w-3xl"
            style={{ color: 'var(--foreground)' }}
          >
            One Dashboard for{' '}
            <span style={{ color: 'var(--primary)' }}>All Your API Integrations</span>
          </h1>

          <p
            className="text-lg leading-relaxed mb-10 max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            StackPulse connects to {INTEGRATIONS.length}+ providers for seamless API monitoring.
            Track rate limits, credit balances, error counts, and deployment status — with
            zero code changes and instant integration setup.
          </p>
        </section>

        {/* Provider Grid */}
        <section
          className="px-14 pb-20"
          style={{ background: 'var(--background)' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {INTEGRATIONS.map((provider) => (
              <div
                key={provider.id}
                className="flex flex-col gap-4 p-6 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <ProviderIcon providerId={provider.id} size={40} />
                  <div>
                    <h3
                      className="font-semibold"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {provider.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: provider.authType === 'OAuth'
                            ? 'var(--sp-success-muted)'
                            : 'var(--muted)',
                          color: provider.authType === 'OAuth'
                            ? 'var(--primary)'
                            : 'var(--muted-foreground)',
                        }}
                      >
                        {provider.authType}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {provider.category}
                      </span>
                    </div>
                  </div>
                </div>

                <p
                  className="text-sm leading-relaxed flex-1"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {provider.description}
                </p>

                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--sp-text-tertiary)' }}
                  >
                    Monitored Metrics
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {provider.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="text-[10px] px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--muted)',
                          color: 'var(--muted-foreground)',
                        }}
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          className="flex flex-col items-center text-center px-14 py-20"
          style={{
            background: 'linear-gradient(to bottom, var(--sidebar-accent) 0%, var(--background) 80%)',
          }}
        >
          <h2
            className="text-4xl font-bold mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Ready to monitor your API integrations?
          </h2>
          <p
            className="text-base mb-8 max-w-md"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Free to start. No credit card required. Connect your first service in under 60 seconds.
          </p>
          <Button size="lg" asChild>
            <Link href="/connect">
              <Zap className="size-4" />
              Connect Your First Service
            </Link>
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="px-14 py-8"
        style={{ background: 'var(--background)', borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs text-center" style={{ color: 'var(--sp-text-tertiary)' }}>
          &copy; 2026 StackPulse. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
