import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookies = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (key: string) => mockCookies.has(key) ? { value: mockCookies.get(key) } : undefined,
    set: (key: string, value: string) => { mockCookies.set(key, value) },
    delete: (key: string) => { mockCookies.delete(key) },
  })),
}))

import { generateState, setStateCookie, verifyStateCookie, setLabelCookie, getLabelCookie, setCodeVerifierCookie, getCodeVerifierCookie } from '../state'

describe('generateState', () => {
  it('returns a 64-char hex string', () => {
    const state = generateState()
    expect(state).toMatch(/^[0-9a-f]{64}$/)
  })

  it('generates unique values', () => {
    expect(generateState()).not.toBe(generateState())
  })
})

describe('state cookie round-trip', () => {
  beforeEach(() => { mockCookies.clear() })

  it('verifies matching state', async () => {
    await setStateCookie('abc123')
    const valid = await verifyStateCookie('abc123')
    expect(valid).toBe(true)
  })

  it('rejects mismatched state', async () => {
    await setStateCookie('abc123')
    const valid = await verifyStateCookie('wrong')
    expect(valid).toBe(false)
  })

  it('clears cookie after verification', async () => {
    await setStateCookie('abc123')
    await verifyStateCookie('abc123')
    const validAgain = await verifyStateCookie('abc123')
    expect(validAgain).toBe(false)
  })
})

describe('code_verifier cookie round-trip', () => {
  beforeEach(() => { mockCookies.clear() })

  it('stores and retrieves code_verifier', async () => {
    await setCodeVerifierCookie('verifier123')
    const v = await getCodeVerifierCookie()
    expect(v).toBe('verifier123')
  })

  it('returns null when no code_verifier set', async () => {
    expect(await getCodeVerifierCookie()).toBeNull()
  })

  it('clears cookie after retrieval', async () => {
    await setCodeVerifierCookie('v')
    await getCodeVerifierCookie()
    expect(await getCodeVerifierCookie()).toBeNull()
  })
})

describe('label cookie round-trip', () => {
  beforeEach(() => { mockCookies.clear() })

  it('retrieves stored label', async () => {
    await setLabelCookie('My GitHub')
    const label = await getLabelCookie()
    expect(label).toBe('My GitHub')
  })

  it('returns null when no label set', async () => {
    const label = await getLabelCookie()
    expect(label).toBeNull()
  })

  it('clears cookie after retrieval', async () => {
    await setLabelCookie('test')
    await getLabelCookie()
    const second = await getLabelCookie()
    expect(second).toBeNull()
  })
})
