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
  dbRows = [{ count: 24 }],
  dbStatus = 200,
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
      return HttpResponse.json(dbRows)
    }),
  )
}

describe('Supabase Provider — metadata', () => {
  it('has correct metadata with api_key auth', () => {
    expect(supabaseProvider.id).toBe('supabase')
    expect(supabaseProvider.category).toBe('infrastructure')
    expect(supabaseProvider.authType).toBe('api_key')
    expect(supabaseProvider.collectors).toHaveLength(4)
  })

  it('has a token credential field', () => {
    expect(supabaseProvider.credentials).toHaveLength(1)
    expect(supabaseProvider.credentials[0].key).toBe('token')
    expect(supabaseProvider.credentials[0].type).toBe('password')
  })

  it('has connection_status collector with status-badge hint', () => {
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

  it('has edge_function_count collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'edge_function_count')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('functions')
  })
})

describe('fetchSupabaseMetrics', () => {
  it('returns healthy when PAT is valid', async () => {
    mockAll()
    const result = await fetchSupabaseMetrics('valid-pat')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401 (invalid PAT)', async () => {
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

  it('fetches edge function count', async () => {
    mockAll({ functions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBe(4)
  })

  it('fetches api requests 24h', async () => {
    mockAll({ apiCount: 9876 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.apiRequests24h).toBe(9876)
  })

  it('fetches active db connections', async () => {
    mockAll({ dbRows: [{ count: 18 }] })
    const result = await fetchSupabaseMetrics('token')
    expect(result.activeDbConnections).toBe(18)
  })

  it('falls back to null for edge functions on API error', async () => {
    mockAll({ functionsStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBeNull()
    expect(result.status).toBe('healthy')
  })

  it('falls back to null for api requests on API error', async () => {
    mockAll({ apiCountStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.apiRequests24h).toBeNull()
  })

  it('falls back to null for db connections on API error', async () => {
    mockAll({ dbStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.activeDbConnections).toBeNull()
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
  })

  it('uses first project ref for sub-resource calls', async () => {
    const customRef = 'my-custom-ref'
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([{ id: customRef, name: 'proj', status: 'ACTIVE_HEALTHY' }])
      ),
      http.get(`https://api.supabase.com/v1/projects/${customRef}/functions`, () =>
        HttpResponse.json([{ id: 'fn1' }, { id: 'fn2' }])
      ),
      http.get(`https://api.supabase.com/v1/projects/${customRef}/analytics/endpoints/usage.api-requests-count`, () =>
        HttpResponse.json({ result: [{ count: 500 }] })
      ),
      http.post(`https://api.supabase.com/v1/projects/${customRef}/database/query`, () =>
        HttpResponse.json([{ count: 7 }])
      ),
    )
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBe(2)
    expect(result.apiRequests24h).toBe(500)
    expect(result.activeDbConnections).toBe(7)
  })
})

describe('supabaseProvider.fetchMetrics', () => {
  it('returns snapshots for all 4 collectors', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    expect(results).toHaveLength(4)
    const ids = results.map(r => r.collectorId)
    expect(ids).toContain('connection_status')
    expect(ids).toContain('api_requests_24h')
    expect(ids).toContain('active_db_connections')
    expect(ids).toContain('edge_function_count')
  })

  it('reads token from credentials.token', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'connection_status')
    expect(snap?.valueText).toBe('connected')
    expect(snap?.status).toBe('healthy')
  })

  it('edge_function_count snapshot has numeric value', async () => {
    mockAll({ functions: [{ id: 'a' }, { id: 'b' }] })
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'edge_function_count')
    expect(snap?.value).toBe(2)
  })

  it('api_requests_24h snapshot has numeric value', async () => {
    mockAll({ apiCount: 9999 })
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'api_requests_24h')
    expect(snap?.value).toBe(9999)
  })

  it('active_db_connections snapshot has numeric value', async () => {
    mockAll({ dbRows: [{ count: 12 }] })
    const results = await supabaseProvider.fetchMetrics({ token: 'my-pat' })
    const snap = results.find(r => r.collectorId === 'active_db_connections')
    expect(snap?.value).toBe(12)
  })
})
