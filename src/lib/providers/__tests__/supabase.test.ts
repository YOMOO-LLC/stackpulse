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
  projects = [
    { id: PROJECT_REF, name: 'my-project', status: 'ACTIVE_HEALTHY' },
    { id: 'other-ref', name: 'other-project', status: 'ACTIVE_HEALTHY' },
  ],
  functions = [{ id: 'fn1' }, { id: 'fn2' }, { id: 'fn3' }],
  functionsStatus = 200,
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
  )
}

describe('Supabase Provider — metadata', () => {
  it('has correct metadata', () => {
    expect(supabaseProvider.id).toBe('supabase')
    expect(supabaseProvider.category).toBe('infrastructure')
    expect(supabaseProvider.authType).toBe('oauth2')
    expect(supabaseProvider.collectors).toHaveLength(4)
  })

  it('has connection_status collector with status-badge hint', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'connection_status')
    expect(col).toBeDefined()
    expect(col?.displayHint).toBe('status-badge')
  })

  it('has project_count collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'project_count')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('projects')
  })

  it('has edge_function_count collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'edge_function_count')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('functions')
  })

  it('has active_project_count collector', () => {
    const col = supabaseProvider.collectors.find(c => c.id === 'active_project_count')
    expect(col).toBeDefined()
    expect(col?.unit).toBe('projects')
  })
})

describe('fetchSupabaseMetrics', () => {
  it('returns healthy when OAuth access token is valid', async () => {
    mockAll()
    const result = await fetchSupabaseMetrics('valid-access-token')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
  })

  it('returns critical on 401 (expired or invalid OAuth token)', async () => {
    mockAll({ projectsStatus: 401 })
    const result = await fetchSupabaseMetrics('invalid-access-token')
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

  it('fetches project count', async () => {
    mockAll({ projects: [
      { id: PROJECT_REF, name: 'p1', status: 'ACTIVE_HEALTHY' },
      { id: 'ref2', name: 'p2', status: 'ACTIVE_HEALTHY' },
      { id: 'ref3', name: 'p3', status: 'INACTIVE' },
    ]})
    const result = await fetchSupabaseMetrics('token')
    expect(result.projectCount).toBe(3)
  })

  it('fetches active project count (ACTIVE_HEALTHY only)', async () => {
    mockAll({ projects: [
      { id: PROJECT_REF, name: 'p1', status: 'ACTIVE_HEALTHY' },
      { id: 'ref2', name: 'p2', status: 'ACTIVE_HEALTHY' },
      { id: 'ref3', name: 'p3', status: 'INACTIVE' },
    ]})
    const result = await fetchSupabaseMetrics('token')
    expect(result.activeProjectCount).toBe(2)
  })

  it('fetches edge function count', async () => {
    mockAll({ functions: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBe(4)
  })

  it('falls back to null for edge functions on API error', async () => {
    mockAll({ functionsStatus: 500 })
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBeNull()
    expect(result.status).toBe('healthy') // connection still healthy
  })

  it('handles empty project list', async () => {
    server.use(
      http.get('https://api.supabase.com/v1/projects', () => HttpResponse.json([])),
    )
    const result = await fetchSupabaseMetrics('token')
    expect(result.status).toBe('healthy')
    expect(result.value).toBe('connected')
    expect(result.projectCount).toBe(0)
    expect(result.activeProjectCount).toBe(0)
    expect(result.edgeFunctionCount).toBeNull()
  })

  it('uses first project ref for edge functions call', async () => {
    const customRef = 'my-custom-ref'
    server.use(
      http.get('https://api.supabase.com/v1/projects', () =>
        HttpResponse.json([{ id: customRef, name: 'proj', status: 'ACTIVE_HEALTHY' }])
      ),
      http.get(`https://api.supabase.com/v1/projects/${customRef}/functions`, () =>
        HttpResponse.json([{ id: 'fn1' }, { id: 'fn2' }])
      ),
    )
    const result = await fetchSupabaseMetrics('token')
    expect(result.edgeFunctionCount).toBe(2)
  })
})

describe('supabaseProvider.fetchMetrics', () => {
  it('returns snapshots for all 4 collectors', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ access_token: 'oauth-token' })
    expect(results).toHaveLength(4)
    const ids = results.map(r => r.collectorId)
    expect(ids).toContain('connection_status')
    expect(ids).toContain('project_count')
    expect(ids).toContain('active_project_count')
    expect(ids).toContain('edge_function_count')
  })

  it('connection_status snapshot has valueText connected', async () => {
    mockAll()
    const results = await supabaseProvider.fetchMetrics({ access_token: 'token' })
    const snap = results.find(r => r.collectorId === 'connection_status')
    expect(snap?.valueText).toBe('connected')
    expect(snap?.status).toBe('healthy')
  })

  it('project_count snapshot has numeric value', async () => {
    mockAll({ projects: [
      { id: PROJECT_REF, name: 'p1', status: 'ACTIVE_HEALTHY' },
      { id: 'ref2', name: 'p2', status: 'ACTIVE_HEALTHY' },
    ]})
    const results = await supabaseProvider.fetchMetrics({ access_token: 'token' })
    const snap = results.find(r => r.collectorId === 'project_count')
    expect(snap?.value).toBe(2)
  })

  it('active_project_count snapshot counts only healthy projects', async () => {
    mockAll({ projects: [
      { id: PROJECT_REF, name: 'p1', status: 'ACTIVE_HEALTHY' },
      { id: 'ref2', name: 'p2', status: 'INACTIVE' },
    ]})
    const results = await supabaseProvider.fetchMetrics({ access_token: 'token' })
    const snap = results.find(r => r.collectorId === 'active_project_count')
    expect(snap?.value).toBe(1)
  })

  it('edge_function_count snapshot has numeric value', async () => {
    mockAll({ functions: [{ id: 'a' }, { id: 'b' }] })
    const results = await supabaseProvider.fetchMetrics({ access_token: 'token' })
    const snap = results.find(r => r.collectorId === 'edge_function_count')
    expect(snap?.value).toBe(2)
  })
})
