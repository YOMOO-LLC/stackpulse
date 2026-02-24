import { describe, it, expect } from 'vitest'
import * as github from '../github'
import * as stripe from '../stripe'
import * as openai from '../openai'
import * as vercel from '../vercel'
import * as openrouter from '../openrouter'
import * as resend from '../resend'
import * as sentry from '../sentry'
import * as upstashRedis from '../upstash-redis'
import * as upstashQstash from '../upstash-qstash'
import * as minimax from '../minimax'
import * as supabase from '../supabase'
import { ALL_DEMO_SEQUENCES } from '../index'

const ALL_MODULES = { github, stripe, openai, vercel, openrouter, resend, sentry, upstashRedis, upstashQstash, minimax, supabase }

describe('demo sequences structure', () => {
  for (const [name, mod] of Object.entries(ALL_MODULES)) {
    describe(name, () => {
      it('exports mockFetchMetrics function', () => {
        expect(typeof mod.mockFetchMetrics).toBe('function')
      })

      it('mockFetchMetrics returns array with collectorId, value, valueText, unit, status', async () => {
        const results = await mod.mockFetchMetrics()
        expect(Array.isArray(results)).toBe(true)
        expect(results.length).toBeGreaterThan(0)
        for (const r of results) {
          expect(r).toHaveProperty('collectorId')
          expect(r).toHaveProperty('unit')
          expect(r).toHaveProperty('status')
          expect(['healthy', 'warning', 'critical', 'unknown']).toContain(r.status)
        }
      })

      it('exports demoSnapshots array', () => {
        expect(Array.isArray(mod.demoSnapshots)).toBe(true)
        expect(mod.demoSnapshots.length).toBeGreaterThan(0)
      })

      it('demoSnapshots have required fields including hoursAgo', () => {
        for (const snap of mod.demoSnapshots) {
          expect(snap).toHaveProperty('collectorId')
          expect(snap).toHaveProperty('unit')
          expect(snap).toHaveProperty('status')
          expect(typeof snap.hoursAgo).toBe('number')
          expect(snap.hoursAgo).toBeGreaterThanOrEqual(0)
          expect(snap.hoursAgo).toBeLessThanOrEqual(48)
        }
      })
    })
  }

  it('ALL_DEMO_SEQUENCES index contains all 11 providers', () => {
    const ids = ALL_DEMO_SEQUENCES.map((s) => s.providerId)
    expect(ids).toContain('github')
    expect(ids).toContain('stripe')
    expect(ids).toContain('openai')
    expect(ids).toContain('vercel')
    expect(ids).toContain('openrouter')
    expect(ids).toContain('resend')
    expect(ids).toContain('sentry')
    expect(ids).toContain('upstash-redis')
    expect(ids).toContain('upstash-qstash')
    expect(ids).toContain('minimax')
    expect(ids).toContain('supabase')
    expect(ids).toHaveLength(11)
  })
})
