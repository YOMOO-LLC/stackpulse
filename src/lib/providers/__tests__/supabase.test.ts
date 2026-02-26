import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { supabaseProvider, fetchSupabaseMetrics } from '../supabase'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PROJECT_REF = 'abc123ref'

function mockAll({
  projectsStatus = 200,
  projects = [{ id: PROJECT_REF, name: 'my-project', status: 'ACTIVE_HEALTHY' }],
  functions = [{ id: 'fn1' }, { id: 'fn2' }, { id: 'fn3' }],
  functionsStatus = 200,
  apiCount = 12480,
  apiCountStatus = 200,
  dbRow = { conn_count: 24, db_size_bytes: 116343599 },
  dbStatus = 200,
  healthServices = [
    { name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' },
    { name: 'auth', healthy: true, status: 'ACTIVE_HEALTHY' },
    { name: 'realtime', healthy: true, status: 'ACTIVE_HEALTHY' },
    { name: 'storage', healthy: true, status: 'ACTIVE_HEALTHY' },
  ],
  healthStatus = 200,
} = {}) {
  server.use(
    http.get('https://api.supabase.com/v1/projects', () => {
      if (projectsStatus === 401) return new HttpResponse(null, { status: 401 })
      if (projectsStatus !== 200) return new HttpResponse(null, { status: projectsStatus })
      return HttpResponse.json(projects)
    }),
    http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, () => {
      if (functionsStatus !== 200) return new HttpResponse(null, { status: functionsStatus })
      return HttpResponse.json(functions)
    }),
    http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-requests-count`, () => {
      if (apiCountStatus !== 200) return new HttpResponse(null, { status: apiCountStatus })
      return HttpResponse.json({ result: [{ count: apiCount }] })
    }),
    http.post(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, () => {
      if (dbStatus !== 200) return new HttpResponse(null, { status: dbStatus })
      return HttpResponse.json([dbRow])
    }),
    http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/health`, () => {
      if (healthStatus !== 200) return new HttpResponse(null, { status: healthStatus })
      return HttpResponse.json(healthServices)
    }),
  )
}

// --- Metadata ---

describe('Supabase Provider — metadata', () => {
  it('has correct metadata with api_key auth', () => {
    expect(supabaseProvider.id).toBe('supabase')
    expect(supabaseProvider.category).toBe('infrastructure')
    expect(supabaseProvider.authType).toBe('api_key')
    expect(supabaseProvider.collectors).toHaveLength(9)
  })

  it('has connection_status collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
  })

  it('has api_requests_24h collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'api_requests_24h')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('req')
  })

  it('has active_db_connections collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'active_db_connections')
    expect(col).toBeDefined()
  })

  it('has disk_usage_bytes collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'disk_usage_bytes')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('bytes')
  })

  it('has edge_function_count collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'edge_function_count')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('functions')
  })

  it.each(['db_health', 'auth_health', 'realtime_health', 'storage_health'])(
    'has %s collector with status-badge hint',
    (id) => {
      const col = supabaseProvider.collectors.find(c => c.id === id)
      expect(col).toBeDefined()
      expect(col?.displayHint).toBe('status-badge')
    },
  )
})

// --- fetchSupabaseMetrics ---

describe('fetchSupabaseMetrics', () => {
  it('returns healthy when PAT is valid', async () => {
    mockAll()
    const result = await fetchSupabaseMetrics('valid-pat')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401', async () => {
    mockAll({ projectsStatus: 401 })
    const result = await fetchSupabaseMetrics('bad-pat')
    expect(result.status).toBe('critical')
    expect(result.value).toBe('auth_failed')
  })

  it('returns unknown on network error', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => HttpResponse.error()),
    )
    const result = await fetchSupabaseMetrics('any-token')
    expect(result.status).toBe('unknown')
  })

  // Existing metrics
  it('fetches edge function count', async () => {
    mockAll({ functions: [{ id: 'a' }, { id: 'b' }] })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBe(2)
  })

  it('fetches api requests 24h', async () => {
    mockAll({ apiCount: 9876 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.apiRequests24h).toBe(9876)
  })

  it('fetches active db connections from combined query', async () => {
    mockAll({ dbRow: { conn_count: 18, db_size_bytes: 500000 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.activeDbConnections).toBe(18)
  })

  // New: disk usage
  it('fetches disk usage bytes from combined query', async () => {
    mockAll({ dbRow: { conn_count: 10, db_size_bytes: 116343599 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.diskUsageBytes).toBe(116343599)
  })

  // New: service health
  it('fetches all 4 service health statuses', async () => {
    mockAll()
    const result = await fetchSupabaseMetrics('token')
    expect(result.dbHealth).toBe('ACTIVE_HEALTHY')
    expect(result.authHealth).toBe('ACTIVE_HEALTHY')
    expect(result.realtimeHealth).toBe('ACTIVE_HEALTHY')
    expect(result.storageHealth).toBe('ACTIVE_HEALTHY')
  })

  it('maps unhealthy service correctly', async () => {
    mockAll({
      healthServices: [
        { name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'auth', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'realtime', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'storage', healthy: false, status: 'COMING_UP' },
      ],
    })
    const result = await fetchSupabaseMetrics('token')
    expect(result.storageHealth).toBe('COMING_UP')
    expect(result.dbHealth).toBe('ACTIVE_HEALTHY')
  })

  // Fallbacks
  it('falls back to null for edge functions on error', async () => {
    mockAll({ functionsStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBeNull()
    expect(result.status).toBe('healthy')
  })

  it('falls back to null for api requests on error', async () => {
    mockAll({ apiCountStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.apiRequests24h).toBeNull()
  })

  it('falls back to null for db query on error', async () => {
    mockAll({ dbStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.activeDbConnections).toBeNull()
    expect(result.diskUsageBytes).toBeNull()
  })

  it('falls back to null for health on error', async () => {
    mockAll({ healthStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.dbHealth).toBeNull()
    expect(result.authHealth).toBeNull()
    expect(result.realtimeHealth).toBeNull()
    expect(result.storageHealth).toBeNull()
  })

  it('handles empty project list', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => HttpResponse.json([])),
    )
    const result = await fetchSupabaseMetrics('token')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
    expect(result.edgeFunctionCount).toBeNull()
    expect(result.apiRequests24h).toBeNull()
    expect(result.activeDbConnections).toBeNull()
    expect(result.diskUsageBytes).toBeNull()
    expect(result.dbHealth).toBeNull()
  })
})

// --- fetchMetrics snapshots ---

describe('supabaseProvider.fetchMetrics', () => {
  it('returns snapshots for all 9 collectors', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    expect(results).toHaveLength(9)
    const ids = results.map(r => r.collectorId)
    expect(ids).toContain('connection_status')
    expect(ids).toContain('api_requests_24h')
    expect(ids).toContain('active_db_connections')
    expect(ids).toContain('disk_usage_bytes')
    expect(ids).toContain('edge_function_count')
    expect(ids).toContain('db_health')
    expect(ids).toContain('auth_health')
    expect(ids).toContain('realtime_health')
    expect(ids).toContain('storage_health')
  })

  it('connection_status snapshot has valueText connected', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'connection_status')
    expect(snap?.valueText).toBe('connected')
    expect(snap?.status).toBe('healthy')
  })

  it('disk_usage_bytes snapshot has numeric value', async () => {
    mockAll({ dbRow: { conn_count: 5, db_size_bytes: 999000 } })
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'disk_usage_bytes')
    expect(snap?.value).toBe(999000)
  })

  it('health snapshots have correct valueText and status', async () => {
    mockAll({
      healthServices: [
        { name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'auth', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'realtime', healthy: true, status: 'ACTIVE_HEALTHY' },
        { name: 'storage', healthy: false, status: 'COMING_UP' },
      ],
    })
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })

    const db = results.find(r => r.collectorId === 'db_health')
    expect(db?.valueText).toBe('ACTIVE_HEALTHY')
    expect(db?.status).toBe('healthy')

    const storage = results.find(r => r.collectorId === 'storage_health')
    expect(storage?.valueText).toBe('COMING_UP')
    expect(storage?.status).toBe('warning')
  })
})
