/**
 * 本地调试 Vercel 指标抓取
 * 用法: npx tsx scripts/test-vercel.ts <vercel_access_token>
 *
 * 获取 token 方式：
 *   1. 个人 token: https://vercel.com/account/tokens
 *   2. 或从本地 Supabase 数据库中解密存储的 token
 */

import { fetchVercelMetrics } from '../src/lib/providers/vercel'

const token = process.argv[2]

if (!token) {
  console.error('用法: npx tsx scripts/test-vercel.ts <vercel_access_token>')
  console.error('')
  console.error('获取 token:')
  console.error('  1. 个人 token: https://vercel.com/account/tokens (创建新 token)')
  console.error('  2. OAuth token: 从本地 supabase 读取解密后的 access_token')
  process.exit(1)
}

void (async () => {
  console.log('正在调用 Vercel API...\n')
  const result = await fetchVercelMetrics(token)
  console.log('\n=== 最终结果 ===')
  console.log(JSON.stringify(result, null, 2))
})()
