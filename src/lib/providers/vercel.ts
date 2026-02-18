import type { ServiceProvider } from './types'

export const vercelProvider: ServiceProvider = {
  id: 'vercel',
  name: 'Vercel',
  category: 'hosting',
  icon: '/icons/vercel.svg',
  authType: 'token',
  credentials: [
    { key: 'token', label: 'API Token', type: 'password', required: true, placeholder: 'vercel_...' },
  ],
  collectors: [
    { id: 'bandwidth_used', name: 'Bandwidth Used', metricType: 'count', unit: 'GB', refreshInterval: 300 },
    { id: 'deployment_status', name: 'Deployment Status', metricType: 'status', unit: '', refreshInterval: 300 },
  ],
  alerts: [
    { id: 'high-bandwidth', name: 'High Bandwidth', collectorId: 'bandwidth_used', condition: 'gt', defaultThreshold: 80, message: 'Bandwidth > 80 GB' },
    { id: 'deploy-failed', name: 'Deployment Failed', collectorId: 'deployment_status', condition: 'status_is', defaultThreshold: 'ERROR', message: 'Deployment failed' },
  ],
}

export interface VercelMetricResult {
  bandwidthUsed: number | null
  deploymentStatus: string | null
  status: 'healthy' | 'warning' | 'critical' | 'unknown'
  error?: string
}

export async function fetchVercelMetrics(token: string): Promise<VercelMetricResult> {
  const headers = { Authorization: `Bearer ${token}` }
  try {
    const [bwRes, deployRes] = await Promise.all([
      fetch('https://api.vercel.com/v2/usage', { headers }),
      fetch('https://api.vercel.com/v6/deployments?limit=1', { headers }),
    ])
    if (!bwRes.ok || !deployRes.ok) return { bandwidthUsed: null, deploymentStatus: null, status: 'unknown', error: 'API error' }
    const bwJson = await bwRes.json()
    const deployJson = await deployRes.json()
    const bandwidthUsed = bwJson.bandwidthUsage?.gigabytes ?? 0
    const deploymentStatus = deployJson.deployments?.[0]?.state ?? 'UNKNOWN'
    let status: VercelMetricResult['status'] = 'healthy'
    if (deploymentStatus === 'ERROR') status = 'critical'
    else if (deploymentStatus === 'BUILDING' || bandwidthUsed > 80) status = 'warning'
    return { bandwidthUsed, deploymentStatus, status }
  } catch {
    return { bandwidthUsed: null, deploymentStatus: null, status: 'unknown', error: 'Network error' }
  }
}
