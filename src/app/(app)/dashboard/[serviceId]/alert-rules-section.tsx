'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { Collector, AlertTemplate } from '@/lib/providers/types'

interface AlertConfig {
  id: string
  connected_service_id: string
  collector_id: string
  condition: string
  threshold_numeric: number | null
  threshold_text: string | null
  enabled: boolean
}

interface AlertRulesSectionProps {
  serviceId: string
  alertTemplates: AlertTemplate[]
  collectors: Collector[]
}

const CONDITION_LABELS: Record<string, string> = {
  lt: 'is less than',
  gt: 'is greater than',
  eq: 'equals',
  status_is: 'status is',
}

export function AlertRulesSection({ serviceId, alertTemplates, collectors }: AlertRulesSectionProps) {
  const [rules, setRules] = useState<AlertConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [collectorId, setCollectorId] = useState(collectors[0]?.id ?? '')
  const [condition, setCondition] = useState('lt')
  const [thresholdNumeric, setThresholdNumeric] = useState('')
  const [thresholdText, setThresholdText] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadRules() {
    const res = await fetch(`/api/alerts?serviceId=${serviceId}`)
    if (res.ok) setRules(await res.json())
  }

  useEffect(() => { loadRules() }, [serviceId])

  function applyPreset(template: AlertTemplate) {
    setCollectorId(template.collectorId)
    setCondition(template.condition)
    if (typeof template.defaultThreshold === 'number') {
      setThresholdNumeric(String(template.defaultThreshold))
      setThresholdText('')
    } else {
      setThresholdText(String(template.defaultThreshold))
      setThresholdNumeric('')
    }
  }

  function resetForm() {
    setCollectorId(collectors[0]?.id ?? '')
    setCondition('lt')
    setThresholdNumeric('')
    setThresholdText('')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(rule: AlertConfig) {
    setCollectorId(rule.collector_id)
    setCondition(rule.condition)
    setThresholdNumeric(rule.threshold_numeric != null ? String(rule.threshold_numeric) : '')
    setThresholdText(rule.threshold_text ?? '')
    setEditingId(rule.id)
    setShowForm(true)
  }

  const selectedCollector = collectors.find((c) => c.id === collectorId)
  const isNumeric = selectedCollector?.metricType !== 'status'

  async function handleSave() {
    setSaving(true)
    const body = {
      connected_service_id: serviceId,
      collector_id: collectorId,
      condition,
      threshold_numeric: isNumeric && thresholdNumeric ? Number(thresholdNumeric) : null,
      threshold_text: !isNumeric ? thresholdText : null,
      enabled: true,
    }

    if (editingId) {
      await fetch(`/api/alerts/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    await loadRules()
    resetForm()
    setSaving(false)
  }

  async function toggleEnabled(rule: AlertConfig) {
    await fetch(`/api/alerts/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    await loadRules()
  }

  async function deleteRule(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    await loadRules()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Card container */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--foreground)' }}>
            Alert Rules
          </h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Rule
          </button>
        </div>

        {/* Rules list */}
        {rules.length === 0 && !showForm ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              No alert rules configured.
            </p>
          </div>
        ) : (
          <div>
            {rules.map((rule, i) => {
              const collector = collectors.find((c) => c.id === rule.collector_id)
              const threshold = rule.threshold_numeric != null
                ? (collector?.metricType === 'currency' ? `$${rule.threshold_numeric}` : String(rule.threshold_numeric))
                : rule.threshold_text ?? ''

              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
                >
                  <div className="flex flex-col flex-1 gap-0.5 min-w-0">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {collector?.name ?? rule.collector_id}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {CONDITION_LABELS[rule.condition] ?? rule.condition} {threshold}
                    </span>
                  </div>
                  <span
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0"
                    style={{
                      background: rule.enabled ? 'var(--sp-success-muted)' : 'var(--muted)',
                      color: rule.enabled ? 'var(--sp-success)' : 'var(--muted-foreground)',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleEnabled(rule)}
                  >
                    {rule.enabled ? 'Active' : 'Paused'}
                  </span>
                  <button
                    onClick={() => startEdit(rule)}
                    className="p-1 transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-1 transition-colors"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Inline add/edit form */}
      {showForm && (
        <div
          className="rounded-xl p-4 flex flex-col gap-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          {alertTemplates.length > 0 && (
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Presets</p>
              <div className="flex gap-2 flex-wrap">
                {alertTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyPreset(t)}
                    className="text-xs px-2.5 py-1 rounded-md transition-colors"
                    style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Metric</Label>
              <select
                value={collectorId}
                onChange={(e) => setCollectorId(e.target.value)}
                className="w-full mt-1 text-sm rounded-md px-2 py-1.5"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Condition</Label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full mt-1 text-sm rounded-md px-2 py-1.5"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                {isNumeric ? (
                  <>
                    <option value="lt">is less than</option>
                    <option value="gt">is greater than</option>
                  </>
                ) : (
                  <option value="status_is">status is</option>
                )}
              </select>
            </div>
            <div>
              <Label className="text-xs">Threshold</Label>
              {isNumeric ? (
                <Input
                  type="number"
                  value={thresholdNumeric}
                  onChange={(e) => setThresholdNumeric(e.target.value)}
                  placeholder={selectedCollector?.metricType === 'currency' ? '5.00' : '80'}
                  className="mt-1 text-sm"
                />
              ) : (
                <select
                  value={thresholdText}
                  onChange={(e) => setThresholdText(e.target.value)}
                  className="w-full mt-1 text-sm rounded-md px-2 py-1.5"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  {['healthy', 'warning', 'critical', 'unknown'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || (isNumeric && !thresholdNumeric)}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
