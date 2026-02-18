import type { ServiceProvider } from './types'

export const githubProvider: ServiceProvider = {
  id: 'github',
  name: 'GitHub',
  category: 'hosting',
  icon: '/icons/github.svg',
  authType: 'oauth2',
  credentials: [
    { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_...' },
  ],
  collectors: [
    { id: 'actions_minutes_used', name: 'Actions Minutes Used', metricType: 'count', unit: 'minutes', refreshInterval: 300 },
    { id: 'actions_minutes_limit', name: 'Actions Minutes Limit', metricType: 'count', unit: 'minutes', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'actions-usage', name: 'High Actions Usage', collectorId: 'actions_minutes_used', condition: 'gt', defaultThreshold: 1600, message: 'GitHub Actions usage > 80%' },
  ],
}

export interface GitHubMetricResult {
  minutesUsed: number | null
  minutesLimit: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchGitHubMetrics(token: string): Promise<GitHubMetricResult> {
  try {
    const res = await fetch('https://api.github.com/user/settings/billing/actions', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
      },
    })
    if (!res.ok) return { minutesUsed: null, minutesLimit: null, status: 'unknown', error: `HTTP ${res.status}` }
    const json = await res.json()
    const minutesUsed = json.total_minutes_used ?? 0
    const minutesLimit = json.included_minutes ?? 0
    const pct = minutesLimit > 0 ? minutesUsed / minutesLimit : 0
    return { minutesUsed, minutesLimit, status: pct > 0.8 ? 'warning' : 'healthy' }
  } catch {
    return { minutesUsed: null, minutesLimit: null, status: 'unknown', error: 'Network error' }
  }
}
