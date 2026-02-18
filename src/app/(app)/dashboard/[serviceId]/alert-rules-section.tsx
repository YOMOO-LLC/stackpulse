'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    <section className="mb-8">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground mb-3">ALERT RULES</h2>

      {rules.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground mb-3">No alert rules configured.</p>
      )}

      <div className="space-y-2 mb-3">
        {rules.map((rule) => {
          const collector = collectors.find((c) => c.id === rule.collector_id)
          const threshold = rule.threshold_numeric != null
            ? (collector?.metricType === 'currency' ? `$${rule.threshold_numeric}` : String(rule.threshold_numeric))
            : rule.threshold_text ?? ''

          return (
            <div key={rule.id} className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-2.5">
              <button
                onClick={() => toggleEnabled(rule)}
                className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${rule.enabled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground'}`}
                title={rule.enabled ? 'Enabled' : 'Disabled'}
              />
              <span className="text-sm text-foreground flex-1">
                {collector?.name ?? rule.collector_id}{' '}
                <span className="text-muted-foreground">{CONDITION_LABELS[rule.condition] ?? rule.condition}</span>{' '}
                <span className="font-medium">{threshold}</span>
              </span>
              <button onClick={() => startEdit(rule)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 mb-3 space-y-4">
          {alertTemplates.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Presets</p>
              <div className="flex gap-2 flex-wrap">
                {alertTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyPreset(t)}
                    className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
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
                className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
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
                className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
              >
                {isNumeric
                  ? <>
                      <option value="lt">is less than</option>
                      <option value="gt">is greater than</option>
                    </>
                  : <option value="status_is">status is</option>
                }
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
                  className="w-full mt-1 text-sm bg-background border border-border rounded-md px-2 py-1.5 text-foreground"
                >
                  {['healthy', 'warning', 'critical', 'unknown'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || (isNumeric && !thresholdNumeric)}>
              {saving ? 'Saving\u2026' : editingId ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        Add alert rule
      </button>
    </section>
  )
}
