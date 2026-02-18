'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProvider } from '@/lib/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

  if (!provider) return <p className="p-8">未知服务: {providerId}</p>

  if (provider.authType === 'oauth2') {
    return (
      <div className="max-w-md mx-auto p-8">
        <p className="text-muted-foreground">OAuth 流程暂未实现（Phase 2）</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>返回</Button>
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

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>连接 {provider.name}</CardTitle>
          <CardDescription>
            输入你的 API Key 完成连接
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>备注名称（可选）</Label>
              <Input
                placeholder={provider.name}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            {provider.credentials.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label>{field.label}</Label>
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={credentials[field.key] ?? ''}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  required={field.required}
                />
              </div>
            ))}
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            <Button type="submit" className="w-full" disabled={status === 'validating' || status === 'saving'}>
              {status === 'validating' ? '验证中...' :
               status === 'saving' ? '保存中...' :
               '连接'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
