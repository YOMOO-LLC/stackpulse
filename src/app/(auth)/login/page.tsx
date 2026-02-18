'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signInWithEmail, signUpWithEmail } from './actions'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setMessage('')
    try {
      const result = mode === 'login'
        ? await signInWithEmail(formData)
        : await signUpWithEmail(formData)

      if (result && 'error' in result) setMessage(result.error ?? '')
      else if (result && 'message' in result) setMessage(result.message ?? '')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">StackPulse</CardTitle>
          <CardDescription>
            {mode === 'login' ? '登录你的账号' : '创建新账号'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" name="password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>
            {message && (
              <p className={`text-sm ${message.includes('错误') || message.includes('failed') || message.includes('Invalid') ? 'text-destructive' : 'text-muted-foreground'}`}>
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>
          <Button
            variant="ghost"
            className="w-full mt-2"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}
          >
            {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
