import { describe, it, expect } from 'vitest'
import { getAllProviders } from '../index'

describe('keyGuide — all non-OAuth providers must have key guide', () => {
  const allProviders = getAllProviders()
  const credentialProviders = allProviders.filter(p => p.authType !== 'oauth2')

  it('there are at least 8 non-OAuth providers', () => {
    expect(credentialProviders.length).toBeGreaterThanOrEqual(8)
  })

  for (const provider of credentialProviders) {
    describe(provider.id, () => {
      it('has keyGuide defined', () => {
        expect(provider.keyGuide).toBeDefined()
      })

      it('has a valid URL in keyGuide', () => {
        expect(provider.keyGuide!.url).toMatch(/^https:\/\//)
      })

      it('has at least one step in keyGuide', () => {
        expect(provider.keyGuide!.steps.length).toBeGreaterThanOrEqual(1)
      })
    })
  }
})
