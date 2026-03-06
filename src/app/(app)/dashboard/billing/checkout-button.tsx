'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CheckoutButtonProps {
  variantId: string | null
  label: string
  highlighted?: boolean
}

export function CheckoutButton({ variantId, label, highlighted }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    if (!variantId) return
    setLoading(true)
    try {
      const res = await fetch('/api/ls/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.assign(data.url)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={highlighted ? 'default' : 'outline'}
      className="w-full"
      onClick={handleCheckout}
      disabled={!variantId || loading}
    >
      {loading ? 'Processing...' : label}
    </Button>
  )
}

interface SwitchPlanButtonProps {
  variantId: string | null
  label: string
  highlighted?: boolean
  currentPlan: string
}

async function pollForPlanChange(currentPlan: string): Promise<boolean> {
  const MAX_ATTEMPTS = 20
  let delay = 500

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, delay))
    delay = Math.min(delay + 250, 3000)

    try {
      const res = await fetch('/api/subscription/plan')
      if (!res.ok) continue
      const data = await res.json()
      if (data.plan !== currentPlan) return true
    } catch {
      // ignore and retry
    }
  }
  return false
}

export function SwitchPlanButton({ variantId, label, highlighted, currentPlan }: SwitchPlanButtonProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSwitch() {
    if (!variantId) return
    setLoading(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/ls/switch-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to switch plan. Please try again.')
        return
      }

      setStatus('Waiting for confirmation...')
      const changed = await pollForPlanChange(currentPlan)
      if (changed) {
        window.location.reload()
      } else {
        setError('Plan switch is taking longer than expected. Please refresh the page in a moment.')
      }
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <div className="w-full">
      <Button
        variant={highlighted ? 'default' : 'outline'}
        className="w-full"
        onClick={handleSwitch}
        disabled={!variantId || loading}
      >
        {loading ? (status ?? 'Switching...') : label}
      </Button>
      {error && (
        <p className="mt-2 text-xs text-center" style={{ color: 'var(--destructive, #ef4444)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
