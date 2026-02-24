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
  const { data: listData } = await supabase.auth.admin.listUsers()
  let demoUser = listData?.users.find((u) => u.email === DEMO_EMAIL)

  if (!demoUser) {
    console.log(`  Creating user ${DEMO_EMAIL}...`)
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`Failed to create demo user: ${error.message}`)
    demoUser = data.user
    console.log(`  Created user ${demoUser.id}`)
  } else {
    console.log(`  Found existing user ${demoUser.id}`)
  }

  const userId = demoUser.id

  // 2. Sentinel credentials (AES-encrypted)
  const sentinelCredentials = encrypt(JSON.stringify({ __demo__: 'true' }), ENCRYPTION_KEY)

  // 3. Insert connected_services rows (upsert by user_id + provider_id)
  for (const seq of ALL_DEMO_SEQUENCES) {
    const { error } = await supabase.from('connected_services').upsert(
      {
        user_id: userId,
        provider_id: seq.providerId,
        label: null,
        enabled: true,
        credentials: sentinelCredentials,
        consecutive_failures: 0,
        auth_expired: false,
      },
      { onConflict: 'user_id,provider_id' }
    )
    if (error) {
      console.error(`  Failed to upsert ${seq.providerId}: ${error.message}`)
    } else {
      console.log(`  Upserted ${seq.providerId}`)
    }
  }

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
  console.log(`  Email: ${DEMO_EMAIL}`)
  console.log(`  Entry: ${APP_URL}/demo`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
