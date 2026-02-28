'use client'

import { Suspense, use, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, KeyRound } from 'lucide-react'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ProjectOption {
  value: string
  label: string
}

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
  const [status, setStatus] = useState<'idle' | 'validating' | 'selecting' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([])

  if (!provider) return (
    <div className="p-8 text-muted-foreground">Unknown provider: {providerId}</div>
  )

  const selector = provider.projectSelector

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

  async function saveService() {
    setStatus('saving')
    try {
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

      // If provider has project selector, fetch options
      if (selector) {
        const projRes = await fetch('/api/services/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, credentials }),
        })
        const projData = await projRes.json()
        const options: ProjectOption[] = projData.options ?? []

        if (options.length > 1) {
          setProjectOptions(options)
          setStatus('selecting')
          return
        }

        // If 0 or 1 project, auto-select and proceed
        if (options.length === 1) {
          setCredentials((prev) => ({
            ...prev,
            [selector!.key]: options[0].value,
            project_name: options[0].label,
          }))
        }
      }

      await saveService()
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again')
    }
  }

  async function handleProjectSelect(e: React.FormEvent) {
    e.preventDefault()
    if (!credentials[selector!.key]) {
      setErrorMsg('Please select a project')
      return
    }
    setErrorMsg('')
    await saveService()
  }

  const isLoading = ['validating', 'saving'].includes(status)

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
              <p className="text-xs text-muted-foreground">
                {status === 'selecting' ? 'Select a project to monitor' : 'Enter your API key to connect'}
              </p>
            </div>
          </div>

          {status === 'selecting' ? (
            <form onSubmit={handleProjectSelect} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {selector!.label}
                  <span className="text-red-400 ml-0.5">*</span>
                </Label>
                <select
                  value={credentials[selector!.key] ?? ''}
                  onChange={(e) => {
                    const selected = projectOptions.find((o) => o.value === e.target.value)
                    setCredentials((prev) => ({
                      ...prev,
                      [selector!.key]: e.target.value,
                      project_name: selected?.label ?? '',
                    }))
                  }}
                  required
                  className="flex h-9 w-full rounded-md px-3 py-1 text-sm bg-secondary border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>
                    Choose a project...
                  </option>
                  {projectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-muted-foreground">
                {projectOptions.length} project{projectOptions.length !== 1 ? 's' : ''} found in your account.
              </p>

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setStatus('idle')
                    setProjectOptions([])
                    setCredentials((prev) => {
                      const next = { ...prev }
                      delete next[selector!.key]
                      return next
                    })
                  }}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Connect'}
                </Button>
              </div>
            </form>
          ) : (
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

              {provider.keyGuide && (
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      How do I get a key?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <div className="flex items-center gap-3">
                        <ProviderIcon providerId={providerId} size={32} />
                        <div>
                          <DialogTitle className="text-foreground">Get your {provider.name} key</DialogTitle>
                          <DialogDescription>Follow these steps to generate an API key</DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground py-2">
                      {provider.keyGuide.steps.map((step, i) => (
                        <li key={i} className="leading-relaxed">{step}</li>
                      ))}
                    </ol>
                    <DialogFooter>
                      <Button
                        asChild
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <a href={provider.keyGuide.url} target="_blank" rel="noopener noreferrer">
                          Open {provider.name} Dashboard
                          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                        </a>
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}

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
          )}
        </div>
      </div>
    </div>
  )
}
