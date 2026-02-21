import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Activity, Grid3x3, Bell, ShieldCheck, Zap, Play } from 'lucide-react'

// ── Data ──────────────────────────────────────────────────────────────────────

const NAV_LINKS = ['Features', 'Integrations', 'Pricing', 'Docs']

const STATS = [
  { value: '10,000+', label: 'Services Monitored', emerald: false },
  { value: '99.9%',   label: 'Uptime SLA',         emerald: true  },
  { value: '<30s',    label: 'Alert Latency',       emerald: false },
  { value: '500+',    label: 'Customers Trusting',  emerald: false },
]

const FEATURES = [
  {
    Icon: Activity,
    accent: 'success' as const,
    title: 'Real-Time Metrics',
    description:
      'Continuously refreshed every 15 minutes. Track rate limits, credit balances, error counts, and more — with a unified dashboard.',
  },
  {
    Icon: Grid3x3,
    accent: 'success' as const,
    title: '9+ Integrations',
    description:
      'Connect GitHub, Stripe, Vercel, Sentry, OpenAI, Resend, Upstash and more. OAuth and API key auth both supported.',
  },
  {
    Icon: Bell,
    accent: 'success' as const,
    title: 'Smart Alerts',
    description:
      'Set custom thresholds with conditions like "less than", "greater than", or "status equals". Get notified via email before issues impact your users.',
  },
  {
    Icon: ShieldCheck,
    accent: 'warning' as const,
    title: 'End-to-End Security',
    description:
      'AES-256-GCM encryption of credentials at rest. OAuth token rotation. Automatic service disablement after 5 consecutive failures.',
  },
]

const FOOTER_COLS: Record<string, string[]> = {
  Product:   ['Features', 'Integrations', 'Pricing', 'Changelog'],
  Company:   ['About', 'Blog', 'Careers', 'Contact'],
  Resources: ['Documentation', 'API Reference', 'Status Page', 'Report'],
  Legal:     ['Privacy Policy', 'Terms of Service', 'Security'],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-14 py-4"
        style={{ background: '#0A0A0F', borderBottom: '1px solid #151520' }}
      >
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" className="text-sm transition-colors hover:text-foreground"
               style={{ color: 'var(--muted-foreground)' }}>
              {l}
            </a>
          ))}
        </nav>

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

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section
          className="flex flex-col items-center text-center px-14 pt-20 pb-16"
          style={{ background: '#0A0A0F' }}
        >
          {/* Badge */}
          <div
            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-12"
            style={{
              background: 'var(--sp-success-muted)',
              color: 'var(--sp-success)',
              border: '1px solid #10B98133',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--sp-success)' }} />
            Now monitoring 8 providers including GitHub, Stripe &amp; OpenAI
          </div>

          {/* Headline */}
          <h1
            className="text-6xl font-bold leading-tight mb-6 max-w-2xl"
            style={{ color: 'var(--foreground)' }}
          >
            Know Before Your Users Do
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg leading-relaxed mb-10 max-w-xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Unified monitoring for all your SaaS dependencies. Track API rate limits,
            credit balances, error counts, and deployment status — with instant alerts
            before things break.
          </p>

          {/* CTAs */}
          <div className="flex items-center gap-4 mb-16">
            <Button size="lg" asChild>
              <Link href="/login">
                <Zap className="size-4" />
                Start Monitoring Free
              </Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="#">
                <Play className="size-4" />
                Watch Demo
              </Link>
            </Button>
          </div>

          {/* Dashboard preview mock */}
          <div
            className="w-full max-w-4xl rounded-xl overflow-hidden text-left"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#FFBD2E' }} />
              <span className="w-3 h-3 rounded-full" style={{ background: '#28C840' }} />
            </div>

            {/* App layout */}
            <div className="flex" style={{ minHeight: '280px' }}>

              {/* Sidebar */}
              <div
                className="flex flex-col gap-1 px-3 py-4 flex-shrink-0"
                style={{ width: '160px', background: '#08080C', borderRight: '1px solid var(--border)' }}
              >
                {/* Logo */}
                <div className="flex items-center gap-2 px-2 py-1 mb-3">
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >SP</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>StackPulse</span>
                </div>
                {/* Nav items */}
                {[
                  { label: 'Dashboard', active: true },
                  { label: 'Services',  active: false },
                  { label: 'Alerts',    active: false },
                  { label: 'Connect',   active: false },
                  { label: 'History',   active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="px-2 py-1.5 rounded text-xs"
                    style={{
                      color:      item.active ? 'var(--primary)' : 'var(--muted-foreground)',
                      background: item.active ? 'var(--sp-success-muted)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-5 flex flex-col gap-4 overflow-hidden">
                {/* Page title */}
                <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Dashboard</h3>

                {/* Stat cards */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Active Services', value: '8',  color: 'var(--foreground)' },
                    { label: 'Monitor',          value: '6',  color: 'var(--primary)' },
                    { label: 'Warnings',         value: '1',  color: 'var(--sp-warning)' },
                    { label: 'Errors',           value: '1',  color: 'var(--sp-error)' },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col gap-1 p-3 rounded-lg"
                      style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                    >
                      <p className="text-[10px]" style={{ color: 'var(--sp-text-tertiary)' }}>{s.label}</p>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Connected Services */}
                <div>
                  <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Connected Services
                  </p>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {[
                      { name: 'GitHub',  badge: 'Healthy', badgeColor: '#10B98133', badgeText: 'var(--primary)', metric: '4,782', metricLabel: 'API calls' },
                      { name: 'Stripe',  badge: 'Healthy', badgeColor: '#10B98133', badgeText: 'var(--primary)', metric: '$12,450', metricLabel: 'balance' },
                      { name: 'OpenAI',  badge: 'No Error', badgeColor: '#3B82F633', badgeText: 'var(--sp-info)', metric: '$2.5K', metricLabel: 'credits' },
                    ].map((svc, i) => (
                      <div
                        key={svc.name}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                        style={{
                          borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                          background: 'var(--muted)',
                        }}
                      >
                        <span style={{ color: 'var(--foreground)' }}>{svc.name}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: svc.badgeColor, color: svc.badgeText }}
                        >{svc.badge}</span>
                        <span style={{ color: 'var(--foreground)' }}>
                          {svc.metric} <span style={{ color: 'var(--sp-text-tertiary)' }}>{svc.metricLabel}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Alerts */}
                <div>
                  <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    Recent Alerts
                  </p>
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: 'var(--sp-error-muted)', border: '1px solid #EF444433' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--sp-error)' }} />
                    <span style={{ color: 'var(--foreground)' }}>Deploy error — status exceeded threshold 95%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        <section
          className="flex items-center justify-around px-32 py-10 gap-8"
          style={{
            background: '#0A0A0F',
            borderTop: '1px solid #151520',
            borderBottom: '1px solid #151520',
          }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 text-center">
              <span
                className="text-3xl font-bold"
                style={{ color: s.emerald ? 'var(--primary)' : 'var(--foreground)' }}
              >
                {s.value}
              </span>
              <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                {s.label}
              </span>
            </div>
          ))}
        </section>

        {/* ── Features ───────────────────────────────────────────────────────── */}
        <section
          className="flex flex-col items-center px-14 py-20"
          style={{ background: '#0D0D14' }}
        >
          {/* Section label */}
          <span
            className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
          >
            Features
          </span>

          <h2
            className="text-4xl font-bold text-center mb-4 max-w-xl"
            style={{ color: 'var(--foreground)' }}
          >
            Everything you need to stay ahead
          </h2>
          <p
            className="text-base text-center leading-relaxed mb-14 max-w-2xl"
            style={{ color: 'var(--muted-foreground)' }}
          >
            From real-time metrics to intelligent alerts, StackPulse gives you complete
            visibility into your infrastructure dependencies.
          </p>

          {/* 2×2 grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex flex-col gap-4 p-6 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{
                    background: f.accent === 'warning'
                      ? 'var(--sp-warning-muted)'
                      : 'var(--sp-success-muted)',
                  }}
                >
                  <f.Icon
                    className="size-5"
                    style={{
                      color: f.accent === 'warning'
                        ? 'var(--sp-warning)'
                        : 'var(--primary)',
                    }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────────── */}
        <section
          className="flex flex-col items-center text-center px-14 py-20"
          style={{
            background: 'linear-gradient(to bottom, #10B98118 0%, #0A0A0F 80%)',
          }}
        >
          <h2
            className="text-4xl font-bold mb-4"
            style={{ color: 'var(--foreground)' }}
          >
            Start monitoring in minutes
          </h2>
          <p
            className="text-base mb-8 max-w-md"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Free to start. No credit card required. Connect your first service in under 60 seconds.
          </p>
          <div className="flex items-center gap-4">
            <Button size="lg" asChild>
              <Link href="/login">
                <Zap className="size-4" />
                Get Started Free
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="#">Talk to Sales</Link>
            </Button>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="px-14 pt-12 pb-8"
        style={{ background: '#0A0A0F', borderTop: '1px solid #151520' }}
      >
        <div className="flex gap-16 mb-12 flex-wrap">
          {/* Brand column */}
          <div className="flex flex-col gap-4 max-w-xs flex-shrink-0">
            <Logo />
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Unified monitoring for all your SaaS dependencies.
              Know before the first failure.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-12 flex-1 flex-wrap">
            {Object.entries(FOOTER_COLS).map(([col, links]) => (
              <div key={col} className="flex flex-col gap-3 min-w-[120px]">
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--foreground)' }}
                >
                  {col}
                </p>
                {links.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm transition-colors hover:text-foreground"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="flex items-center justify-between pt-6"
          style={{ borderTop: '1px solid #151520' }}
        >
          <p className="text-xs" style={{ color: 'var(--sp-text-tertiary)' }}>
            © 2025 StackPulse. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" aria-label="X / Twitter" style={{ color: 'var(--sp-text-tertiary)' }}
               className="hover:text-foreground transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="#" aria-label="GitHub" style={{ color: 'var(--sp-text-tertiary)' }}
               className="hover:text-foreground transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
      >
        SP
      </span>
      <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
        StackPulse
      </span>
    </div>
  )
}
