'use client'

import { Suspense, use, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ConnectProviderPage(props: { params: Promise<{ providerId: string }> }) {
  return (
    <Suspense>
      <ConnectProviderPageInner {...props} />
    </Suspense>
  )
}

function ConnectProviderPageInner({
  params,
}: {
  params: Promise<{ providerId: string }>
}) {
  const { providerId } = use(params)
  const provider = getProvider(providerId)
  const router = useRouter()
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!provider) return (
    <div className="p-8 text-muted-foreground">Unknown provider: {providerId}</div>
  )

  if (provider.authType === 'oauth2') {
    function handleOAuthConnect() {
      const params = new URLSearchParams()
      if (label) params.set('label', label)
      window.location.href = `/api/oauth/authorize/${providerId}?${params.toString()}`
    }

    return (
      <div className="p-8">
        <Link
          href="/connect"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to services
        </Link>

        <div className="max-w-md">
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <ProviderIcon providerId={providerId} size={40} />
              <div>
                <h1 className="text-base font-semibold text-foreground">Connect {provider.name}</h1>
                <p className="text-xs text-muted-foreground">Authorize via {provider.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display name (optional)</Label>
                <Input
                  placeholder={provider.name}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {oauthError === 'oauth_failed' && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  Authorization failed — please try again.
                </p>
              )}

              <Button
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleOAuthConnect}
              >
                Authorize with {provider.name} →
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                You&apos;ll be redirected to {provider.name} to grant read-only access.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('validating')
    setErrorMsg('')

    try {
      const validateRes = await fetch('/api/services/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, credentials }),
      })

      if (validateRes.status === 401) {
        setStatus('error')
        setErrorMsg('Session expired — please refresh and sign in again')
        return
      }

      const validateData = await validateRes.json()
      if (!validateData.valid) {
        setStatus('error')
        setErrorMsg('Invalid credentials — please check your API key')
        return
      }

      setStatus('saving')
      const saveRes = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, credentials, label }),
      })

      if (!saveRes.ok) {
        setStatus('error')
        setErrorMsg('Failed to save — please try again')
        return
      }

      router.push('/dashboard')
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again')
    }
  }

  const isLoading = status === 'validating' || status === 'saving'

  return (
    <div className="p-8">
      <Link
        href="/connect"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to services
      </Link>

      <div className="max-w-md">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <ProviderIcon providerId={providerId} size={40} />
            <div>
              <h1 className="text-base font-semibold text-foreground">Connect {provider.name}</h1>
              <p className="text-xs text-muted-foreground">Enter your API key to connect</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Display name (optional)</Label>
              <Input
                placeholder={provider.name}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            {provider.credentials.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </Label>
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  required={field.required}
                  className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/50 font-mono text-sm"
                />
              </div>
            ))}

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading}
            >
              {status === 'validating' ? 'Verifying...' :
               status === 'saving' ? 'Saving...' : 'Connect'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
