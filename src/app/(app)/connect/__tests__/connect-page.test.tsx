import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/subscription', () => ({
  getUserPlan: vi.fn(),
}))
vi.mock('@/lib/providers', () => ({
  getAllProviders: vi.fn().mockReturnValue([
    { id: 'github', name: 'GitHub', authType: 'oauth2', collectors: [] },
    { id: 'stripe', name: 'Stripe', authType: 'api_key', collectors: [] },
    { id: 'openai', name: 'OpenAI', authType: 'api_key', collectors: [] },
  ]),
}))
vi.mock('@/components/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <span data-testid={`icon-${providerId}`} />
  ),
}))

import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import ConnectPage from '../page'

const MOCK_USER = { id: 'user-1' }

function mockSupabase(serviceCount: number) {
  const countChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ count: serviceCount, error: null }),
  }
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER }, error: null }),
    },
    from: vi.fn().mockReturnValue(countChain),
  }
  vi.mocked(createClient).mockResolvedValue(client as never)
}

describe('ConnectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders provider cards with connect links when under limit', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })
    mockSupabase(1) // 1 of 3 — under limit

    const page = await ConnectPage()
    render(page)

    // Provider cards should link to /connect/[id]
    const links = screen.getAllByRole('link')
    const hrefs = links.map((l) => l.getAttribute('href'))
    expect(hrefs).toContain('/connect/github')
    expect(hrefs).toContain('/connect/stripe')

    // Should NOT show the limit banner
    expect(screen.queryByText(/Upgrade to connect more/)).toBeNull()

    // Connect buttons should say "Connect"
    const connectButtons = screen.getAllByText('Connect')
    expect(connectButtons.length).toBe(3)
  })

  it('shows warning banner when at service limit', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })
    mockSupabase(3) // 3 of 3 — at limit

    const page = await ConnectPage()
    render(page)

    // Should show the limit banner with usage info
    expect(screen.getByText(/3\/3 services/)).toBeTruthy()
    expect(screen.getByText(/Upgrade to connect more/)).toBeTruthy()

    // Banner should contain an upgrade link
    const upgradeLink = screen.getByText('Upgrade')
    expect(upgradeLink.closest('a')?.getAttribute('href')).toBe('/dashboard/billing')
  })

  it('shows disabled connect buttons when at limit', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'free',
      limits: {
        maxServices: 3,
        pollCron: '0 * * * *',
        maxAlertRules: 3,
        maxTeamMembers: 1,
        retentionDays: 7,
        channels: ['email'],
      },
    })
    mockSupabase(3) // at limit

    const page = await ConnectPage()
    render(page)

    // Cards should link to /dashboard/billing instead of /connect/[id]
    const links = screen.getAllByRole('link')
    const cardLinks = links.filter(
      (l) => l.getAttribute('href')?.startsWith('/connect/') || l.getAttribute('href')?.startsWith('/dashboard/billing')
    )
    // All provider cards should point to billing
    cardLinks.forEach((link) => {
      if (link.textContent?.includes('GitHub') || link.textContent?.includes('Stripe') || link.textContent?.includes('OpenAI')) {
        expect(link.getAttribute('href')).toBe('/dashboard/billing')
      }
    })

    // Buttons should show "Upgrade required" instead of "Connect"
    const upgradeButtons = screen.getAllByText('Upgrade required')
    expect(upgradeButtons.length).toBe(3)
    expect(screen.queryAllByText('Connect').length).toBe(0)
  })

  it('does NOT show banner for business plan (Infinity maxServices)', async () => {
    vi.mocked(getUserPlan).mockResolvedValue({
      plan: 'business',
      limits: {
        maxServices: Infinity,
        pollCron: '*/5 * * * *',
        maxAlertRules: Infinity,
        maxTeamMembers: 10,
        retentionDays: 90,
        channels: ['email', 'slack', 'webhook', 'pagerduty'],
      },
    })
    mockSupabase(50) // 50 services, but Infinity limit — never at limit

    const page = await ConnectPage()
    render(page)

    expect(screen.queryByText(/Upgrade to connect more/)).toBeNull()

    // Cards should link to /connect/[id]
    const connectButtons = screen.getAllByText('Connect')
    expect(connectButtons.length).toBe(3)
  })
})
