import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY")!
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!

const IV_LENGTH = 12
const TAG_LENGTH = 16
const FETCH_TIMEOUT = 10_000

// ─── AES-256-GCM Decrypt (Web Crypto API, compatible with Node.js format) ───

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function decrypt(ciphertext: string, hexKey: string): Promise<string> {
  const keyBytes = hexToBytes(hexKey)
  const buf = base64Decode(ciphertext)

  const iv = buf.slice(0, IV_LENGTH)
  const tag = buf.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.slice(IV_LENGTH + TAG_LENGTH)

  // Web Crypto expects ciphertext + tag concatenated
  const ciphertextWithTag = new Uint8Array(encrypted.length + tag.length)
  ciphertextWithTag.set(encrypted)
  ciphertextWithTag.set(tag, encrypted.length)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  )

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertextWithTag
  )

  return new TextDecoder().decode(decrypted)
}

// ─── Threshold Check (inline version of alerts/engine.ts) ───

function checkThreshold(
  condition: string,
  threshold: number | string,
  currentValue: number | string
): boolean {
  switch (condition) {
    case "lt":
      return Number(currentValue) < Number(threshold)
    case "gt":
      return Number(currentValue) > Number(threshold)
    case "eq":
    case "status_is":
      return String(currentValue) === String(threshold)
    default:
      return false
  }
}

// ─── Inline Provider Fetchers ───

interface FetchResult {
  collectorId: string
  value: number | null
  valueText: string | null
  unit: string
  status: string
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchOpenRouter(creds: { apiKey: string }): Promise<FetchResult> {
  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    })
    if (!res.ok) {
      return { collectorId: "credit_balance", value: null, valueText: null, unit: "USD", status: "unknown" }
    }
    const json = await res.json()
    const remaining = (json.data.total_credits as number) - (json.data.total_usage as number)
    const rounded = Math.round(remaining * 100) / 100
    return {
      collectorId: "credit_balance",
      value: rounded,
      valueText: null,
      unit: "USD",
      status: rounded < 5 ? "warning" : "healthy",
    }
  } catch {
    return { collectorId: "credit_balance", value: null, valueText: null, unit: "USD", status: "unknown" }
  }
}

async function fetchResend(creds: { apiKey: string }): Promise<FetchResult> {
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
    })
    if (res.status === 401) {
      return { collectorId: "connection_status", value: null, valueText: "auth_failed", unit: "", status: "critical" }
    }
    if (!res.ok) {
      return { collectorId: "connection_status", value: null, valueText: "error", unit: "", status: "unknown" }
    }
    return { collectorId: "connection_status", value: null, valueText: "connected", unit: "", status: "healthy" }
  } catch {
    return { collectorId: "connection_status", value: null, valueText: "error", unit: "", status: "unknown" }
  }
}

async function fetchSentry(creds: { authToken: string; orgSlug: string }): Promise<FetchResult> {
  try {
    const authRes = await fetchWithTimeout("https://sentry.io/api/0/organizations/", {
      headers: { Authorization: `Bearer ${creds.authToken}` },
    })
    if (!authRes.ok) {
      return { collectorId: "error_count", value: null, valueText: null, unit: "events", status: "unknown" }
    }

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end = now.toISOString()
    const statsUrl = `https://sentry.io/api/0/organizations/${creds.orgSlug}/stats_v2/?field=sum(quantity)&groupBy=outcome&category=error&start=${start}&end=${end}`

    const statsRes = await fetchWithTimeout(statsUrl, {
      headers: { Authorization: `Bearer ${creds.authToken}` },
    })
    if (!statsRes.ok) {
      return { collectorId: "error_count", value: null, valueText: null, unit: "events", status: "unknown" }
    }

    const data = await statsRes.json()
    const total = (data.groups as Array<{ totals: { "sum(quantity)": number } }>).reduce(
      (sum, g) => sum + g.totals["sum(quantity)"],
      0
    )
    return { collectorId: "error_count", value: total, valueText: null, unit: "events", status: "healthy" }
  } catch {
    return { collectorId: "error_count", value: null, valueText: null, unit: "events", status: "unknown" }
  }
}

const providerFetchers: Record<string, (creds: Record<string, string>) => Promise<FetchResult[]>> = {
  openrouter: async (creds) => [await fetchOpenRouter(creds as { apiKey: string })],
  resend: async (creds) => [await fetchResend(creds as { apiKey: string })],
  sentry: async (creds) => [await fetchSentry(creds as { authToken: string; orgSlug: string })],
}

// ─── Email Notification via Resend ───

async function sendAlertEmail(to: string, subject: string, body: string): Promise<void> {
  try {
    await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StackPulse <alerts@stackpulse.dev>",
        to: [to],
        subject,
        text: body,
      }),
    })
  } catch {
    console.error(`Failed to send alert email to ${to}`)
  }
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  // Verify authorization
  const authHeader = req.headers.get("Authorization")
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. Query all enabled connected services
  const { data: services, error: servicesErr } = await supabase
    .from("connected_services")
    .select("id, user_id, provider_id, credentials, label")
    .eq("enabled", true)

  if (servicesErr) {
    return new Response(JSON.stringify({ error: servicesErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const results: Array<{ serviceId: string; providerId: string; metrics: FetchResult[] }> = []

  // 2. Fetch metrics concurrently for all services
  const fetchPromises = (services ?? []).map(async (service) => {
    const fetcher = providerFetchers[service.provider_id]
    if (!fetcher) {
      console.warn(`No fetcher for provider: ${service.provider_id}`)
      return
    }

    let creds: Record<string, string>
    try {
      const decrypted = await decrypt(service.credentials, ENCRYPTION_KEY)
      creds = JSON.parse(decrypted)
    } catch (err) {
      console.error(`Failed to decrypt credentials for service ${service.id}:`, err)
      // Mark auth as expired
      await supabase
        .from("connected_services")
        .update({ auth_expired: true, consecutive_failures: 999 })
        .eq("id", service.id)
      return
    }

    try {
      const metrics = await fetcher(creds)
      results.push({ serviceId: service.id, providerId: service.provider_id, metrics })
    } catch (err) {
      console.error(`Fetch failed for service ${service.id}:`, err)
      // Increment consecutive_failures
      await supabase.rpc("increment_failures", { service_id: service.id }).catch(() => {
        // If RPC doesn't exist, do manual update
        supabase
          .from("connected_services")
          .update({ consecutive_failures: (service.consecutive_failures ?? 0) + 1 })
          .eq("id", service.id)
      })
    }
  })

  await Promise.allSettled(fetchPromises)

  // 3. Write metric_snapshots and check alerts
  for (const result of results) {
    for (const metric of result.metrics) {
      // Insert snapshot
      await supabase.from("metric_snapshots").insert({
        connected_service_id: result.serviceId,
        collector_id: metric.collectorId,
        value: metric.value,
        value_text: metric.valueText,
        unit: metric.unit,
        status: metric.status,
      })

      // 4. Check alert_configs for this service+collector
      const { data: alertConfigs } = await supabase
        .from("alert_configs")
        .select("id, user_id, condition, threshold_numeric, threshold_text, connected_service_id")
        .eq("connected_service_id", result.serviceId)
        .eq("collector_id", metric.collectorId)
        .eq("enabled", true)

      if (!alertConfigs || alertConfigs.length === 0) continue

      for (const config of alertConfigs) {
        const threshold = config.threshold_numeric ?? config.threshold_text
        const currentValue = metric.value ?? metric.valueText
        if (threshold == null || currentValue == null) continue

        const shouldAlert = checkThreshold(config.condition, threshold, currentValue)
        if (!shouldAlert) continue

        // 5. Insert alert_event
        await supabase.from("alert_events").insert({
          alert_config_id: config.id,
          triggered_value_numeric: typeof currentValue === "number" ? currentValue : null,
          triggered_value_text: typeof currentValue === "string" ? currentValue : null,
        })

        // 6. Send email notification
        // Get user's email from auth
        const { data: userData } = await supabase.auth.admin.getUserById(config.user_id)
        if (userData?.user?.email) {
          const serviceName = result.providerId
          const alertMsg = `Alert triggered for ${serviceName}: ${metric.collectorId} = ${currentValue} (threshold: ${config.condition} ${threshold})`
          await sendAlertEmail(
            userData.user.email,
            `[StackPulse] Alert: ${serviceName}`,
            alertMsg
          )
        }
      }
    }

    // Reset consecutive_failures on success
    await supabase
      .from("connected_services")
      .update({ consecutive_failures: 0, auth_expired: false })
      .eq("id", result.serviceId)
  }

  return new Response(
    JSON.stringify({
      polled: results.length,
      total_services: services?.length ?? 0,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})
