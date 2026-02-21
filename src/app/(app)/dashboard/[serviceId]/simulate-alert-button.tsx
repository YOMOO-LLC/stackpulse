'use client'

import { useState } from 'react'
import { FlaskConical, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react'
import type { Collector } from '@/lib/providers/types'

interface SimulateAlertButtonProps {
  serviceId: string
  collectors: Collector[]
}

interface TriggerResult {
  ruleId: string
  collectorId: string
  condition: string
  threshold: number | string
}

interface SimulateResponse {
  triggered: TriggerResult[]
  totalRules: number
  message: string
}

const CONDITION_LABEL: Record<string, string> = {
  lt: '<', gt: '>', eq: '=', status_is: '=',
}

export function SimulateAlertButton({ serviceId, collectors }: SimulateAlertButtonProps) {
  const [open, setOpen] = useState(false)
  const [collectorId, setCollectorId] = useState(collectors[0]?.id ?? '')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimulateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedCollector = collectors.find((c) => c.id === collectorId)
  const isStatus = selectedCollector?.metricType === 'status'

  async function handleSimulate() {
    if (!value.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`/api/services/${serviceId}/simulate-metric`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collector_id: collectorId,
          value: isStatus ? value : Number(value),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Request failed')
      } else {
        setResult(json)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
          <FlaskConical className="h-4 w-4" />
          Simulate Alert
        </span>
        {open
          ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
          : <ChevronDown className="h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
        }
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-4" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="text-xs pt-3" style={{ color: 'var(--sp-text-tertiary)' }}>
            注入一个假指标值，立即触发告警评估（忽略冷却时间）。
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Collector select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                指标
              </label>
              <select
                value={collectorId}
                onChange={(e) => { setCollectorId(e.target.value); setValue(''); setResult(null) }}
                className="text-sm rounded-lg px-3 py-2"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Value input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                模拟值
              </label>
              {isStatus ? (
                <select
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setResult(null) }}
                  className="text-sm rounded-lg px-3 py-2"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="">选择状态…</option>
                  {['healthy', 'warning', 'critical', 'unknown'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setResult(null) }}
                  placeholder={selectedCollector?.metricType === 'currency' ? '0.00' : '0'}
                  className="text-sm rounded-lg px-3 py-2"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
              )}
            </div>
          </div>

          <button
            onClick={handleSimulate}
            disabled={loading || !value.trim()}
            className="flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-opacity disabled:opacity-50"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            {loading ? '测试中…' : '运行测试'}
          </button>

          {/* Result */}
          {error && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--sp-error)' }}>
              <XCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              <div
                className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg"
                style={{
                  background: result.triggered.length > 0 ? 'var(--sp-warning-muted)' : 'var(--sp-success-muted)',
                  color: result.triggered.length > 0 ? 'var(--sp-warning)' : 'var(--sp-success)',
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{result.message}</span>
              </div>

              {result.triggered.length > 0 && (
                <div className="flex flex-col gap-1">
                  {result.triggered.map((t) => {
                    const col = collectors.find((c) => c.id === t.collectorId)
                    return (
                      <div
                        key={t.ruleId}
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                        style={{ background: 'var(--sp-error-muted)', color: 'var(--sp-error)' }}
                      >
                        <XCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {col?.name ?? t.collectorId} {CONDITION_LABEL[t.condition]} {t.threshold}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
