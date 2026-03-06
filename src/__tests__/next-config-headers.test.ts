import { describe, it, expect } from 'vitest'

describe('next.config security headers', () => {
  it('exports a headers function that returns security headers for all routes', async () => {
    const config = (await import('../../next.config')).default

    expect(config.headers).toBeDefined()
    expect(typeof config.headers).toBe('function')

    const headerEntries = await config.headers!()
    expect(headerEntries).toHaveLength(1)
    expect(headerEntries[0].source).toBe('/(.*)')

    const headers = headerEntries[0].headers
    const headerMap = Object.fromEntries(headers.map((h: { key: string; value: string }) => [h.key, h.value]))

    expect(headerMap['X-Frame-Options']).toBe('DENY')
    expect(headerMap['X-Content-Type-Options']).toBe('nosniff')
    expect(headerMap['Referrer-Policy']).toBe('origin-when-cross-origin')
    expect(headerMap['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains'
    )
  })
})
