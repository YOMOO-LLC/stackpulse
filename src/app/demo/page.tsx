'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProviderIcon } from '@/components/provider-icon'
import {
  Server, CircleCheck, TriangleAlert, CircleX,
  ChevronDown, ChevronUp, Zap, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Mock data ────────────────────────────────────────────────────────────────

type DemoMetric = {
  name: string
  value: string
  status: 'healthy' | 'warning' | 'critical'
}

type DemoService = {
  id: string
  providerId: string
  name: string
  status: 'healthy' | 'warning' | 'critical'
  metrics: DemoMetric[]
  history: { time: string; value: string }[]
}

const DEMO_SERVICES: DemoService[] = [
  {
    id: 'github',
    providerId: 'github',
    name: 'GitHub',
    status: 'healthy',
    metrics: [
      { name: 'Rate Limit Remaining', value: '4,782 / 5,000', status: 'healthy' },
      { name: 'Rate Limit Used', value: '218', status: 'healthy' },
      { name: 'Public Repos', value: '42', status: 'healthy' },
    ],
    history: [
      { time: '5m ago', value: '4,782' },
      { time: '10m ago', value: '4,650' },
      { time: '15m ago', value: '4,510' },
      { time: '20m ago', value: '4,320' },
      { time: '25m ago', value: '4,100' },
    ],
  },
  {
    id: 'stripe',
    providerId: 'stripe',
    name: 'Stripe',
    status: 'healthy',
    metrics: [
      { name: 'Account Balance', value: '$12,450.00', status: 'healthy' },
    ],
    history: [
      { time: '5m ago', value: '$12,450.00' },
      { time: '1h ago', value: '$12,380.00' },
      { time: '3h ago', value: '$12,210.00' },
      { time: '6h ago', value: '$11,950.00' },
    ],
  },
  {
    id: 'openai',
    providerId: 'openai',
    name: 'OpenAI',
    status: 'warning',
    metrics: [
      { name: 'Credit Balance', value: '$2.50', status: 'warning' },
      { name: 'Monthly Usage', value: '$47.50', status: 'healthy' },
    ],
    history: [
      { time: '5m ago', value: '$2.50' },
      { time: '1h ago', value: '$3.80' },
      { time: '3h ago', value: '$6.20' },
      { time: '6h ago', value: '$10.00' },
    ],
  },
  {
    id: 'vercel',
    providerId: 'vercel',
    name: 'Vercel',
    status: 'healthy',
    metrics: [
      { name: 'Bandwidth Used', value: '42 GB', status: 'healthy' },
      { name: 'Deployment Status', value: 'Ready', status: 'healthy' },
    ],
    history: [
      { time: '5m ago', value: '42 GB' },
      { time: '1h ago', value: '41.5 GB' },
      { time: '3h ago', value: '39.2 GB' },
      { time: '6h ago', value: '35.8 GB' },
    ],
  },
]

const DEMO_ALERTS = [
  {
    id: 'alert-1',
    message: 'OpenAI credits below $5 threshold',
    time: '2m ago',
    severity: 'critical' as const,
  },
  {
    id: 'alert-2',
    message: 'GitHub rate limit recovered to 4,782',
    time: '15m ago',
    severity: 'healthy' as const,
  },
]

const STAT_CARDS = [
  { label: 'Active Services', value: '4', icon: Server, color: 'var(--foreground)', iconColor: 'var(--sp-text-tertiary)' },
  { label: 'Healthy', value: '3', icon: CircleCheck, color: 'var(--primary)', iconColor: 'var(--primary)' },
  { label: 'Warnings', value: '1', icon: TriangleAlert, color: 'var(--sp-warning)', iconColor: 'var(--sp-warning)' },
  { label: 'Critical', value: '0', icon: CircleX, color: 'var(--sp-error)', iconColor: 'var(--sp-error)' },
]

// ── Status helpers ───────────────────────────────────────────────────────────

function statusStyle(status: 'healthy' | 'warning' | 'critical') {
  const map = {
    healthy:  { label: 'Healthy',  color: 'var(--primary)',    bg: 'var(--sp-success-muted)', dot: 'var(--primary)' },
    warning:  { label: 'Warning',  color: 'var(--sp-warning)', bg: 'var(--sp-warning-muted)', dot: 'var(--sp-warning)' },
    critical: { label: 'Critical', color: 'var(--sp-error)',   bg: 'var(--sp-error-muted)',   dot: 'var(--sp-error)' },
  }
  return map[status]
}

// ── Page component ───────────────────────────────────────────────────────────

export default function DemoPage() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      {/* ── Demo banner ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-center gap-3 px-4 py-3 text-sm"
        style={{ background: 'var(--sp-info-muted)', borderBottom: '1px solid var(--border)' }}
      >
        <span style={{ color: 'var(--foreground)' }}>
          This is a demo with sample data.
        </span>
        <Link
          href="/login"
          className="font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--primary)' }}
        >
          Sign up free →
        </Link>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-8 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
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
          <span
            className="ml-2 px-2 py-0.5 rounded text-[10px] font-medium"
            style={{ background: 'var(--sp-info-muted)', color: 'var(--sp-info)' }}
          >
            DEMO
          </span>
        </div>
        <Button size="sm" asChild>
          <Link href="/login">
            <Zap className="size-4" />
            Get Started Free
          </Link>
        </Button>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="flex-1 px-8 py-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-6">

          {/* Page title */}
          <div className="flex flex-col gap-1">
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--foreground)', letterSpacing: '-0.5px' }}
            >
              Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Monitor all your connected services at a glance
            </p>
          </div>

          {/* ── Stat cards ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_CARDS.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-3 p-5 rounded-xl"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                      {stat.label}
                    </span>
                    <Icon className="h-4 w-4" style={{ color: stat.iconColor }} />
                  </div>
                  <span
                    className="text-3xl font-bold"
                    style={{ color: stat.color, letterSpacing: '-1px' }}
                  >
                    {stat.value}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Connected Services ─────────────────────────────────────────────── */}
          <section className="flex flex-col gap-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Connected Services
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEMO_SERVICES.map((svc) => {
                const badge = statusStyle(svc.status)
                const isExpanded = expanded === svc.id

                return (
                  <div
                    key={svc.id}
                    className="flex flex-col rounded-xl"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
                  >
                    {/* Card header — clickable */}
                    <button
                      type="button"
                      onClick={() => toggle(svc.id)}
                      className="flex items-center justify-between w-full text-left"
                      style={{ padding: 18 }}
                      data-testid={`service-card-${svc.id}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProviderIcon providerId={svc.providerId} size={36} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold truncate" style={{ color: 'var(--foreground)' }}>
                            {svc.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="flex items-center gap-1.5 rounded-full text-[11px] font-medium flex-shrink-0 px-2.5 py-1"
                          style={{ background: badge.bg, color: badge.color }}
                        >
                          <span
                            className="rounded-full flex-shrink-0"
                            style={{ width: 6, height: 6, background: badge.dot }}
                          />
                          {badge.label}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                        ) : (
                          <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                        )}
                      </div>
                    </button>

                    {/* Card metrics */}
                    <div className="flex flex-col gap-2 px-[18px] pb-3">
                      {svc.metrics.map((m) => {
                        const valueColor = m.status === 'warning'
                          ? 'var(--sp-warning)'
                          : m.status === 'critical'
                            ? 'var(--sp-error)'
                            : 'var(--foreground)'
                        return (
                          <div key={m.name} className="flex items-center justify-between">
                            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {m.name}
                            </span>
                            <span className="text-xs font-semibold" style={{ color: valueColor }}>
                              {m.value}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Expanded: metric history */}
                    {isExpanded && (
                      <div
                        className="flex flex-col gap-2 px-[18px] pb-4 pt-3"
                        style={{ borderTop: '1px solid var(--border)' }}
                      >
                        <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                          Metric History
                        </span>
                        {svc.history.map((h, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
                              {h.time}
                            </span>
                            <span className="text-[11px] font-medium" style={{ color: 'var(--foreground)' }}>
                              {h.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── Recent Alerts ──────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
              Recent Alerts
            </h2>
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {DEMO_ALERTS.map((alert, i) => {
                const isCritical = alert.severity === 'critical'
                const accentColor = isCritical ? 'var(--sp-error)' : 'var(--primary)'
                const accentBg = isCritical ? 'var(--sp-error-muted)' : 'var(--sp-success-muted)'

                return (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{ borderBottom: i < DEMO_ALERTS.length - 1 ? '1px solid var(--border)' : undefined }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: accentBg }}
                    >
                      {isCritical ? (
                        <TriangleAlert className="h-4 w-4" style={{ color: accentColor }} />
                      ) : (
                        <CircleCheck className="h-4 w-4" style={{ color: accentColor }} />
                      )}
                    </div>
                    <span className="text-[13px] font-medium flex-1" style={{ color: 'var(--foreground)' }}>
                      {alert.message}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--sp-text-tertiary)' }}>
                      {alert.time}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </main>

      {/* ── Bottom CTA bar ──────────────────────────────────────────────────── */}
      <div
        className="sticky bottom-0 flex items-center justify-center gap-4 px-8 py-4"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Ready to monitor your own APIs?
        </span>
        <Button size="sm" asChild>
          <Link href="/login">
            Sign up free
            <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
