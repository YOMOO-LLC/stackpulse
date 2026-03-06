import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock provider-icon (client component)
vi.mock('@/components/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <div data-testid={`provider-icon-${providerId}`} />
  ),
}))

import { createClient } from '@/lib/supabase/server'

const EXPECTED_PROVIDERS = [
  'OpenRouter',
  'Resend',
  'Sentry',
  'Stripe',
  'GitHub',
  'Vercel',
  'OpenAI',
  'Upstash Redis',
  'Upstash QStash',
  'MiniMax',
  'Supabase',
]

describe('IntegrationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)
  })

  async function renderPage() {
    const { default: IntegrationsPage } = await import('../page')
    const Page = await IntegrationsPage()
    render(Page)
  }

  it('renders the page title "Integrations"', async () => {
    await renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Integrations')
  })

  it('renders all 11 provider names', async () => {
    await renderPage()
    for (const name of EXPECTED_PROVIDERS) {
      const headings = screen.getAllByRole('heading', { level: 3 })
      const found = headings.some((h) => h.textContent?.includes(name))
      expect(found, `Provider "${name}" should be rendered as h3`).toBe(true)
    }
  })

  it('shows auth type for each provider (OAuth or API Key)', async () => {
    await renderPage()
    // At least some providers should show OAuth and some API Key
    expect(screen.getAllByText(/OAuth/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/API Key/i).length).toBeGreaterThan(0)
  })

  it('contains a CTA with "Connect Your First Service"', async () => {
    await renderPage()
    const matches = screen.getAllByText(/Connect Your First Service/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('CTA links to /connect', async () => {
    await renderPage()
    const matches = screen.getAllByText(/Connect Your First Service/i)
    const ctaLink = matches.find((el) => el.closest('a')?.getAttribute('href') === '/connect')
    expect(ctaLink).toBeTruthy()
  })

  it('contains SEO keywords', async () => {
    await renderPage()
    const body = document.body.textContent ?? ''
    expect(body).toContain('monitoring')
    expect(body).toContain('integration')
  })

  it('redirects logged-in users to /connect', async () => {
    const { redirect } = await import('next/navigation')
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
      },
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never)

    const { default: IntegrationsPage } = await import('../page')
    await IntegrationsPage()
    expect(redirect).toHaveBeenCalledWith('/connect')
  })

  it('exports metadata with title and description', async () => {
    const { metadata } = await import('../page')
    expect(metadata).toBeDefined()
    expect(metadata.title).toBeTruthy()
    expect(metadata.description).toBeTruthy()
    // Description should mention provider names for SEO
    const desc = metadata.description as string
    expect(desc).toContain('GitHub')
    expect(desc).toContain('Stripe')
    expect(desc).toContain('OpenAI')
  })
})
