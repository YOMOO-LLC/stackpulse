'use client'

import { useState } from 'react'

export function DemoBanner() {
  const [visible, setVisible] = useState(true)
  const [resetting, setResetting] = useState(false)

  if (!visible) return null

  async function handleReset() {
    setResetting(true)
    try {
      await fetch('/api/demo/reset', { method: 'POST' })
    } finally {
      setResetting(false)
    }
  }

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: 'var(--sp-bg-elevated)', border: '1px solid var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Demo Mode &nbsp;&middot;&nbsp; Data resets automatically every 2 hours
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {resetting ? 'Resetting\u2026' : 'Reset Now'}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
