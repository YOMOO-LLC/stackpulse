import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CollapsibleServiceTable } from '../collapsible-service-table'
import type { ProviderGroup } from '../helpers'

vi.mock('@/components/provider-icon', () => ({
  ProviderIcon: ({ providerId }: { providerId: string }) => (
    <div data-testid={`icon-${providerId}`} />
  ),
}))

const groupedGroups: ProviderGroup[] = [
  {
    providerId: 'vercel',
    providerName: 'Vercel',
    isGroup: true,
    groupStatus: 'healthy',
    services: [
      { id: 'svc-1', providerId: 'vercel', providerName: 'Vercel', label: 'project-a', status: 'healthy', collectors: [], lastUpdated: undefined },
      { id: 'svc-2', providerId: 'vercel', providerName: 'Vercel', label: 'project-b', status: 'healthy', collectors: [], lastUpdated: undefined },
    ],
  },
]

const singleGroups: ProviderGroup[] = [
  {
    providerId: 'github',
    providerName: 'GitHub',
    isGroup: false,
    groupStatus: 'healthy',
    services: [
      { id: 'svc-gh', providerId: 'github', providerName: 'GitHub', label: 'GitHub', status: 'healthy', collectors: [], lastUpdated: undefined },
    ],
  },
]

describe('CollapsibleServiceTable', () => {
  it('renders group header with provider name and count badge', () => {
    render(<CollapsibleServiceTable groups={groupedGroups} />)
    expect(screen.getByText('Vercel')).toBeInTheDocument()
    expect(screen.getByText('2 projects')).toBeInTheDocument()
  })

  it('shows sub-rows by default (expanded)', () => {
    render(<CollapsibleServiceTable groups={groupedGroups} />)
    expect(screen.getByText('project-a')).toBeInTheDocument()
    expect(screen.getByText('project-b')).toBeInTheDocument()
  })

  it('collapses sub-rows when group header button is clicked', () => {
    render(<CollapsibleServiceTable groups={groupedGroups} />)
    const headerBtn = screen.getByRole('button')
    fireEvent.click(headerBtn)
    expect(screen.queryByText('project-a')).not.toBeInTheDocument()
    expect(screen.queryByText('project-b')).not.toBeInTheDocument()
  })

  it('expands sub-rows again when group header button is clicked twice', () => {
    render(<CollapsibleServiceTable groups={groupedGroups} />)
    const headerBtn = screen.getByRole('button')
    fireEvent.click(headerBtn)
    fireEvent.click(headerBtn)
    expect(screen.getByText('project-a')).toBeInTheDocument()
    expect(screen.getByText('project-b')).toBeInTheDocument()
  })

  it('sub-rows are links to the service detail page', () => {
    render(<CollapsibleServiceTable groups={groupedGroups} />)
    expect(screen.getByRole('link', { name: /project-a/i })).toHaveAttribute('href', '/dashboard/svc-1')
    expect(screen.getByRole('link', { name: /project-b/i })).toHaveAttribute('href', '/dashboard/svc-2')
  })

  it('renders single service as a direct link (no button)', () => {
    render(<CollapsibleServiceTable groups={singleGroups} />)
    const link = screen.getByRole('link', { name: /github/i })
    expect(link).toHaveAttribute('href', '/dashboard/svc-gh')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
