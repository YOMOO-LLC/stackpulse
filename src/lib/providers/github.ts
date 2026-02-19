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
    { id: 'rate_limit_remaining', name: 'API Rate Limit Remaining', metricType: 'count', unit: 'requests', refreshInterval: 300 },
    { id: 'rate_limit_used', name: 'API Rate Limit Used', metricType: 'count', unit: 'requests', refreshInterval: 300 },
    { id: 'graphql_rate_limit_remaining', name: 'GraphQL Rate Limit Remaining', metricType: 'count', unit: 'requests', refreshInterval: 300 },
    { id: 'search_rate_limit_remaining', name: 'Search Rate Limit Remaining', metricType: 'count', unit: 'requests', refreshInterval: 300 },
    { id: 'public_repos', name: 'Public Repositories', metricType: 'count', unit: 'repos', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'rate-limit-low', name: 'Rate Limit Low', collectorId: 'rate_limit_remaining', condition: 'lt', defaultThreshold: 500, message: 'GitHub API rate limit below 500 requests' },
  ],
}

export interface GitHubMetricResult {
  rateLimitRemaining: number | null
  rateLimitUsed: number | null
  rateLimitTotal: number | null
  graphqlRemaining: number | null
  searchRemaining: number | null
  publicRepos: number | null
  status: 'healthy' | 'warning' | 'unknown'
  error?: string
}

export async function fetchGitHubMetrics(token: string): Promise<GitHubMetricResult> {
  const headers = {
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    Accept: 'application/vnd.github+json',
  }

  const empty: GitHubMetricResult = {
    rateLimitRemaining: null, rateLimitUsed: null, rateLimitTotal: null,
    graphqlRemaining: null, searchRemaining: null, publicRepos: null,
    status: 'unknown',
  }

  try {
    const [rateLimitRes, userRes] = await Promise.all([
      fetch('https://api.github.com/rate_limit', { headers }),
      fetch('https://api.github.com/user', { headers }),
    ])

    if (!rateLimitRes.ok) {
      return { ...empty, error: `HTTP ${rateLimitRes.status}` }
    }

    const rl = await rateLimitRes.json()
    const core = rl.resources?.core ?? rl.rate
    const remaining = core?.remaining ?? null
    const limit = core?.limit ?? null
    const used = core?.used ?? null
    const graphqlRemaining = rl.resources?.graphql?.remaining ?? null
    const searchRemaining = rl.resources?.search?.remaining ?? null

    let publicRepos: number | null = null
    if (userRes.ok) {
      const user = await userRes.json()
      publicRepos = user.public_repos ?? null
    }

    const pct = limit && limit > 0 ? (limit - (remaining ?? 0)) / limit : 0
    return {
      rateLimitRemaining: remaining,
      rateLimitUsed: used,
      rateLimitTotal: limit,
      graphqlRemaining,
      searchRemaining,
      publicRepos,
      status: pct > 0.8 ? 'warning' : 'healthy',
    }
  } catch {
    return { ...empty, error: 'Network error' }
  }
}
