import { demoSnapshots as githubSnapshots, mockFetchMetrics as githubMock } from './github'
import { demoSnapshots as stripeSnapshots, mockFetchMetrics as stripeMock } from './stripe'
import { demoSnapshots as openaiSnapshots, mockFetchMetrics as openaiMock } from './openai'
import { demoSnapshots as vercelSnapshots, mockFetchMetrics as vercelMock } from './vercel'
import { demoSnapshots as openrouterSnapshots, mockFetchMetrics as openrouterMock } from './openrouter'
import { demoSnapshots as resendSnapshots, mockFetchMetrics as resendMock } from './resend'
import { demoSnapshots as sentrySnapshots, mockFetchMetrics as sentryMock } from './sentry'
import { demoSnapshots as upstashRedisSnapshots, mockFetchMetrics as upstashRedisMock } from './upstash-redis'
import { demoSnapshots as upstashQstashSnapshots, mockFetchMetrics as upstashQstashMock } from './upstash-qstash'
import { demoSnapshots as minimaxSnapshots, mockFetchMetrics as minimaxMock } from './minimax'
import { demoSnapshots as supabaseSnapshots, mockFetchMetrics as supabaseMock } from './supabase'

export type DemoSnapshot = {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
  hoursAgo: number
}

export interface ProviderDemoSequence {
  providerId: string
  snapshots: DemoSnapshot[]
  mockFetchMetrics: () => Promise<import('../fetch').SnapshotResult[]>
}

export const ALL_DEMO_SEQUENCES: ProviderDemoSequence[] = [
  { providerId: 'github',         snapshots: githubSnapshots,       mockFetchMetrics: githubMock },
  { providerId: 'stripe',         snapshots: stripeSnapshots,       mockFetchMetrics: stripeMock },
  { providerId: 'openai',         snapshots: openaiSnapshots,       mockFetchMetrics: openaiMock },
  { providerId: 'vercel',         snapshots: vercelSnapshots,       mockFetchMetrics: vercelMock },
  { providerId: 'openrouter',     snapshots: openrouterSnapshots,   mockFetchMetrics: openrouterMock },
  { providerId: 'resend',         snapshots: resendSnapshots,       mockFetchMetrics: resendMock },
  { providerId: 'sentry',         snapshots: sentrySnapshots,       mockFetchMetrics: sentryMock },
  { providerId: 'upstash-redis',  snapshots: upstashRedisSnapshots, mockFetchMetrics: upstashRedisMock },
  { providerId: 'upstash-qstash', snapshots: upstashQstashSnapshots,mockFetchMetrics: upstashQstashMock },
  { providerId: 'minimax',        snapshots: minimaxSnapshots,       mockFetchMetrics: minimaxMock },
  { providerId: 'supabase',       snapshots: supabaseSnapshots,     mockFetchMetrics: supabaseMock },
]
