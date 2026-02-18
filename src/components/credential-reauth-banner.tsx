'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CredentialField {
  key: string
  label: string
  type?: string
  placeholder?: string
}

interface CredentialReauthBannerProps {
  serviceId: string
  providerId: string
  credentialFields: CredentialField[]
  onSuccess?: () => void
}

export function CredentialReauthBanner({
  serviceId,
  providerId,
  credentialFields,
  onSuccess,
}: CredentialReauthBannerProps) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/services/${serviceId}/credentials`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentials: values, providerId }),
    })
    if (res.ok) {
      onSuccess?.()
      setOpen(false)
    } else {
      const json = await res.json()
      setError(json.error ?? 'Failed to update credentials')
    }
    setSaving(false)
  }

  return (
    <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">API credentials have expired or are invalid.</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-red-800 text-red-400 hover:bg-red-950"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Cancel' : 'Update credentials'}
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {credentialFields.map((field) => (
            <div key={field.key}>
              <Label className="text-xs text-muted-foreground">{field.label}</Label>
              <Input
                type={field.type === 'password' ? 'password' : 'text'}
                placeholder={field.placeholder}
                value={values[field.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save & resume monitoring'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
