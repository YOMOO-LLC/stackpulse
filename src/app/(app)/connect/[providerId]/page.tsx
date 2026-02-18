'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getProvider } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ConnectProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>
}) {
  const { providerId } = use(params)
  const provider = getProvider(providerId)
  const router = useRouter()

  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState<'idle' | 'validating' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (!provider) return (
    <div className="p-8 text-muted-foreground">未知服务: {providerId}</div>
  )

  if (provider.authType === 'oauth2') {
    return (
      <div className="p-8 max-w-md">
        <p className="text-muted-foreground text-sm">OAuth 流程暂未实现（Phase 2）</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => router.back()}>返回</Button>
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
        setErrorMsg('登录已过期，请刷新页面重新登录')
        return
      }

      const validateData = await validateRes.json()
      if (!validateData.valid) {
        setStatus('error')
        setErrorMsg('凭证验证失败，请检查 API Key 是否正确')
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
        setErrorMsg('保存失败，请重试')
        return
      }

      router.push('/dashboard')
    } catch {
      setStatus('error')
      setErrorMsg('网络错误，请重试')
    }
  }

  const isLoading = status === 'validating' || status === 'saving'

  return (
    <div className="p-8">
      {/* 面包屑 */}
      <Link
        href="/connect"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        返回选择服务
      </Link>

      {/* 表单卡片 */}
      <div className="max-w-md">
        <div className="bg-card border border-border rounded-xl p-6">
          {/* Provider 头部 */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
            <ProviderIcon providerId={providerId} size={40} />
            <div>
              <h1 className="text-base font-semibold text-foreground">连接 {provider.name}</h1>
              <p className="text-xs text-muted-foreground">输入 API Key 完成连接</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">备注名称（可选）</Label>
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
              {status === 'validating' ? '验证中...' :
               status === 'saving' ? '保存中...' : '连接'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
