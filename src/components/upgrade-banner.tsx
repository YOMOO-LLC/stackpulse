'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

export function UpgradeBanner({ planName }: { planName: string }) {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: 'var(--sp-success-muted)', border: '1px solid var(--primary)' }}
    >
      <div className="flex items-center gap-2.5">
        <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          {planName === 'Free'
            ? 'Your upgrade is being processed. It may take a moment to activate.'
            : `Welcome to ${planName}! Your plan has been upgraded.`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}
