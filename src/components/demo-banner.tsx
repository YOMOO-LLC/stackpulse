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
      style={{ background: '#1A1A2E', border: '1px solid #2D2D4A' }}
    >
      <span className="text-sm" style={{ color: '#A0A0C0' }}>
        Demo Mode &nbsp;&middot;&nbsp; Data resets automatically every 2 hours
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={resetting}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: '#10B981', color: '#000' }}
        >
          {resetting ? 'Resetting\u2026' : 'Reset Now'}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: '#1E1E2A', color: '#8888A0' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
