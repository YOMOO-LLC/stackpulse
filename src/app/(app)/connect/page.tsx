import Link from 'next/link'
import { getAllProviders } from '@/lib/providers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI',
  monitoring: '监控',
  email: '邮件',
  hosting: '托管',
  payment: '支付',
  other: '其他',
}

export default function ConnectPage() {
  const providers = getAllProviders()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">选择要连接的服务</h1>
        <p className="text-muted-foreground mt-1">连接你的 API 服务，开始监控</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <Link key={provider.id} href={`/connect/${provider.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{provider.name}</CardTitle>
                  <Badge variant="outline">{CATEGORY_LABELS[provider.category] ?? provider.category}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {provider.authType === 'oauth2' ? 'OAuth 授权' :
                   provider.authType === 'hybrid' ? 'OAuth / API Key' :
                   'API Key 接入'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  监控 {provider.collectors.length} 项指标
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
