import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { supabaseProvider, fetchSupabaseMetrics, fetchSupabaseProjects } from '../supabase'

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
  apiCounts = { total_rest_requests: 2885, total_auth_requests: 873, total_storage_requests: 3, total_realtime_requests: 106 },
  apiCountsStatus = 200,
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
    http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts`, () => {
      if (apiCountsStatus !== 200) return new HttpResponse(null, { status: apiCountsStatus })
      return HttpResponse.json([{ ...apiCounts, timestamp: '2026-02-26T00:00:00Z' }])
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
    expect(supabaseProvider.collectors).toHaveLength(12)
  })

  it('has connection_status collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
  })

  it('has db_requests_24h collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'db_requests_24h')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('req')
    expect(col?.trend).toBe(true)
  })

  it('has auth_requests_24h collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'auth_requests_24h')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('req')
    expect(col?.trend).toBe(true)
  })

  it('has storage_requests_24h collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'storage_requests_24h')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('req')
    expect(col?.trend).toBe(true)
  })

  it('has realtime_requests_24h collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'realtime_requests_24h')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('req')
    expect(col?.trend).toBe(true)
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
    'has %s collector with status-badge hint and health section',
    (id) => {
      const col = supabaseProvider.collectors.find(c => c.id === id)
      expect(col).toBeDefined()
      expect(col?.displayHint).toBe('status-badge')
      expect(col?.section).toBe('health')
    },
  )

  it('connection_status has header section', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'connection_status')
    expect(col?.section).toBe('header')
  })

  it('has projectSelector with key project_ref', () => {
    expect(supabaseProvider.projectSelector).toBeDefined()
    expect(supabaseProvider.projectSelector?.key).toBe('project_ref')
    expect(supabaseProvider.projectSelector?.label).toBe('Select Project')
  })

  it('metric collectors have no section', () => {
    const metricIds = ['db_requests_24h', 'auth_requests_24h', 'storage_requests_24h', 'realtime_requests_24h', 'active_db_connections', 'disk_usage_bytes', 'edge_function_count']
    for (const id of metricIds) {
      const col = supabaseProvider.collectors.find(c => c.id === id)
      expect(col?.section).toBeUndefined()
    }
  })
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

  it('fetches db requests 24h', async () => {
    mockAll({ apiCounts: { total_rest_requests: 5000, total_auth_requests: 100, total_storage_requests: 50, total_realtime_requests: 20 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.dbRequests24h).toBe(5000)
  })

  it('fetches auth requests 24h', async () => {
    mockAll({ apiCounts: { total_rest_requests: 5000, total_auth_requests: 100, total_storage_requests: 50, total_realtime_requests: 20 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.authRequests24h).toBe(100)
  })

  it('fetches storage requests 24h', async () => {
    mockAll({ apiCounts: { total_rest_requests: 5000, total_auth_requests: 100, total_storage_requests: 50, total_realtime_requests: 20 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.storageRequests24h).toBe(50)
  })

  it('fetches realtime requests 24h', async () => {
    mockAll({ apiCounts: { total_rest_requests: 5000, total_auth_requests: 100, total_storage_requests: 50, total_realtime_requests: 20 } })
    const result = await fetchSupabaseMetrics('token')
    expect(result.realtimeRequests24h).toBe(20)
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

  it('falls back to null for api counts on error', async () => {
    mockAll({ apiCountsStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.dbRequests24h).toBeNull()
    expect(result.authRequests24h).toBeNull()
    expect(result.storageRequests24h).toBeNull()
    expect(result.realtimeRequests24h).toBeNull()
  })

  it('handles api-counts response wrapped in result field', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([{ id: PROJECT_REF, name: 'my-project', status: 'ACTIVE_HEALTHY' }]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`, () =>
        HttpResponse.json([]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/usage.api-counts`, () =>
        HttpResponse.json({ result: [{ total_rest_requests: 1000, total_auth_requests: 200, total_storage_requests: 30, total_realtime_requests: 50, timestamp: '2026-02-26T00:00:00Z' }] }),
      ),
      http.post(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, () =>
        HttpResponse.json([{ conn_count: 10, db_size_bytes: 100000 }]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${PROJECT_REF}/health`, () =>
        HttpResponse.json([
          { name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'auth', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'realtime', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'storage', healthy: true, status: 'ACTIVE_HEALTHY' },
        ]),
      ),
    )
    const result = await fetchSupabaseMetrics('token')
    expect(result.dbRequests24h).toBe(1000)
    expect(result.authRequests24h).toBe(200)
    expect(result.storageRequests24h).toBe(30)
    expect(result.realtimeRequests24h).toBe(50)
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
    expect(result.dbRequests24h).toBeNull()
    expect(result.authRequests24h).toBeNull()
    expect(result.storageRequests24h).toBeNull()
    expect(result.realtimeRequests24h).toBeNull()
    expect(result.activeDbConnections).toBeNull()
    expect(result.diskUsageBytes).toBeNull()
    expect(result.dbHealth).toBeNull()
  })
})

// --- fetchMetrics snapshots ---

describe('supabaseProvider.fetchMetrics', () => {
  it('returns snapshots for all 12 collectors', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    expect(results).toHaveLength(12)
    const ids = results.map(r => r.collectorId)
    expect(ids).toContain('connection_status')
    expect(ids).toContain('db_requests_24h')
    expect(ids).toContain('auth_requests_24h')
    expect(ids).toContain('storage_requests_24h')
    expect(ids).toContain('realtime_requests_24h')
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

  it('request count snapshots have correct values', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const db = results.find(r => r.collectorId === 'db_requests_24h')
    expect(db?.value).toBe(2885)
    const auth = results.find(r => r.collectorId === 'auth_requests_24h')
    expect(auth?.value).toBe(873)
    const storage = results.find(r => r.collectorId === 'storage_requests_24h')
    expect(storage?.value).toBe(3)
    const realtime = results.find(r => r.collectorId === 'realtime_requests_24h')
    expect(realtime?.value).toBe(106)
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

// --- fetchSupabaseProjects ---

describe('fetchSupabaseProjects', () => {
  it('returns project options', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([
          { id: 'ref-aaa', name: 'Project A', status: 'ACTIVE_HEALTHY' },
          { id: 'ref-bbb', name: 'Project B', status: 'ACTIVE_HEALTHY' },
        ]),
      ),
    )
    const options = await fetchSupabaseProjects('token')
    expect(options).toHaveLength(2)
    expect(options[0]).toEqual({ value: 'ref-aaa', label: 'Project A' })
    expect(options[1]).toEqual({ value: 'ref-bbb', label: 'Project B' })
  })

  it('returns empty array on API error', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => new HttpResponse(null, { status: 401 })),
    )
    const options = await fetchSupabaseProjects('bad-token')
    expect(options).toEqual([])
  })
})

// --- fetchSupabaseMetrics with projectRef ---

describe('fetchSupabaseMetrics with projectRef', () => {
  const SECOND_REF = 'second-project-ref'

  it('uses provided projectRef instead of first project', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([
          { id: PROJECT_REF, name: 'First', status: 'ACTIVE_HEALTHY' },
          { id: SECOND_REF, name: 'Second', status: 'ACTIVE_HEALTHY' },
        ]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${SECOND_REF}/functions`, () =>
        HttpResponse.json([{ id: 'fn1' }]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${SECOND_REF}/analytics/endpoints/usage.api-counts`, () =>
        HttpResponse.json([{ total_rest_requests: 500, total_auth_requests: 200, total_storage_requests: 10, total_realtime_requests: 30, timestamp: '2026-02-26T00:00:00Z' }]),
      ),
      http.post(`https://api.supabase.com/v1/projects/${SECOND_REF}/database/query`, () =>
        HttpResponse.json([{ conn_count: 5, db_size_bytes: 100000 }]),
      ),
      http.get(`https://api.supabase.com/v1/projects/${SECOND_REF}/health`, () =>
        HttpResponse.json([
          { name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'auth', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'realtime', healthy: true, status: 'ACTIVE_HEALTHY' },
          { name: 'storage', healthy: true, status: 'ACTIVE_HEALTHY' },
        ]),
      ),
    )

    const result = await fetchSupabaseMetrics('token', SECOND_REF)
    expect(result.status).toBe('healthy')
    expect(result.projectRef).toBe(SECOND_REF)
    expect(result.edgeFunctionCount).toBe(1)
    expect(result.dbRequests24h).toBe(500)
    expect(result.authRequests24h).toBe(200)
    expect(result.storageRequests24h).toBe(10)
    expect(result.realtimeRequests24h).toBe(30)
    expect(result.activeDbConnections).toBe(5)
  })

  it('returns connected with nulls when projectRef not found in list', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([{ id: PROJECT_REF, name: 'First', status: 'ACTIVE_HEALTHY' }]),
      ),
    )
    const result = await fetchSupabaseMetrics('token', 'nonexistent-ref')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
    expect(result.edgeFunctionCount).toBeNull()
  })
})
