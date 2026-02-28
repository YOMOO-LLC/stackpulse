#!/usr/bin/env npx tsx
/**
 * Seed the demo account for StackPulse.
 *
 * Run once at initial deployment:
 *   npx tsx scripts/seed-demo.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ENCRYPTION_KEY
 *   NEXT_PUBLIC_DEMO_EMAIL
 *   DEMO_USER_PASSWORD
 *   NEXT_PUBLIC_APP_URL  (for reset call)
 *   DEMO_RESET_SECRET
 */

import { createClient } from '@supabase/supabase-js'
import { encrypt } from '../src/lib/crypto'
import { ALL_DEMO_SEQUENCES } from '../src/lib/providers/demo-sequences'

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!
const DEMO_EMAIL     = process.env.NEXT_PUBLIC_DEMO_EMAIL!
const DEMO_PASSWORD  = process.env.DEMO_USER_PASSWORD!
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4567'
const RESET_SECRET   = process.env.DEMO_RESET_SECRET!

if (!SUPABASE_URL || !SERVICE_KEY || !ENCRYPTION_KEY || !DEMO_EMAIL || !DEMO_PASSWORD || !RESET_SECRET) {
  console.error('Missing required env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Seeding demo account...')

  // 1. Create or find demo user
  console.log(`  Creating user ${DEMO_EMAIL}...`)
  const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })

  let demoUser = createData?.user ?? null

  if (createErr) {
    const msg = createErr.message ?? JSON.stringify(createErr)
    if (!msg.includes('already been registered') && !msg.includes('already registered') && !msg.includes('already exists')) {
      throw new Error(`Failed to create demo user: ${msg} | ${JSON.stringify(createErr)}`)
    }
    // User already exists — look up by paginating admin listUsers
    console.log(`  User already exists, looking up...`)
    let found = false
    let page = 1
    while (!found) {
      const { data: pageData, error: pageErr } = await supabase.auth.admin.listUsers({ page, perPage: 50 })
      if (pageErr) throw new Error(`listUsers failed: ${pageErr.message}`)
      const match = pageData?.users.find((u) => u.email === DEMO_EMAIL)
      if (match) { demoUser = match; found = true; break }
      if (!pageData?.users.length) throw new Error(`Cannot find existing demo user after pagination`)
      page++
    }
    console.log(`  Found existing user ${demoUser!.id}`)
  } else {
    console.log(`  Created user ${demoUser!.id}`)
  }

  const userId = demoUser!.id

  // 2. Sentinel credentials (AES-encrypted)
  const sentinelCredentials = encrypt(JSON.stringify({ __demo__: 'true' }), ENCRYPTION_KEY)

  // 3. Delete existing connected_services for demo user (idempotent re-seed)
  const { error: delErr } = await supabase
    .from('connected_services')
    .delete()
    .eq('user_id', userId)
  if (delErr) console.warn(`  Warning: could not delete existing services: ${delErr.message}`)

  // 4. Insert connected_services rows
  const rows = ALL_DEMO_SEQUENCES.map((seq) => ({
    user_id: userId,
    provider_id: seq.providerId,
    label: null,
    enabled: true,
    credentials: sentinelCredentials,
    consecutive_failures: 0,
    auth_expired: false,
  }))

  const { error: insErr } = await supabase.from('connected_services').insert(rows)
  if (insErr) {
    throw new Error(`Failed to insert connected_services: ${insErr.message}`)
  }
  console.log(`  Inserted ${rows.length} connected_services`)

  // 4. Seed initial metric data via reset endpoint
  console.log('  Calling /api/demo/reset to seed metric data...')
  const res = await fetch(`${APP_URL}/api/demo/reset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESET_SECRET}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Reset failed (${res.status}): ${text}`)
  }

  const body = await res.json()
  console.log(`  Demo data seeded at ${body.reset_at}`)
  console.log('Demo account ready!')
  console.log(`  Email:    ${DEMO_EMAIL}`)
  console.log(`  Entry:    ${APP_URL}/demo`)
  console.log(`  User ID:  ${demoUser!.id}`)
  console.log()
  console.log('ACTION REQUIRED: Add to your environment variables:')
  console.log(`  DEMO_USER_ID=${demoUser!.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
