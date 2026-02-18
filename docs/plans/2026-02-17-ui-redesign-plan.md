# StackPulse UI 重设计实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 StackPulse 从默认浅色 shadcn 主题重设计为深色专业工具风格（zinc-950 背景 + emerald 主色），采用左侧固定侧边栏 + 右侧内容区的「命令中心」布局。

**Architecture:** 将 dashboard 和 connect 路由移入新建的 `(app)` 路由组，共享含侧边栏的 layout。全局 CSS 变量切换为深色 Token，新增 StatusDot、Sparkline、AppSidebar、ProviderCard 四个组件，改造现有 ServiceCard 和 Login 页面。

**Tech Stack:** Next.js 16.1.6 App Router, React 19, Tailwind CSS v4, shadcn/ui, Vitest + @testing-library/react, TypeScript strict

**设计文档：** `docs/plans/2026-02-17-ui-redesign-design.md`

---

## 任务顺序总览

1. 全局 CSS Token 切换为深色主题
2. 新建 `(app)` 路由组 + AppSidebar 组件
3. 新增 StatusDot 组件（替换 StatusBadge）
4. 新增 Sparkline 组件（SVG 趋势线）
5. Provider 图标资源
6. 改造 ServiceCard
7. 改造 Connect 选择页（ProviderCard 组件）
8. 改造 Connect 表单页
9. 改造登录页
10. 收尾：删除旧 layout，运行全量测试

---

### Task 1: 全局 CSS Token 切换为深色主题

**Files:**
- Modify: `src/app/globals.css`

将 `:root` 的颜色变量改为深色系。Tailwind v4 用 `@theme inline` 块，变量直接在 `:root` 定义，所有组件自动生效。

**Step 1: 替换 globals.css**

将 `src/app/globals.css` 中的 `:root` 和 `.dark` 块整体替换为：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* ─── Dark-first design system ─── */
:root {
  --radius: 0.625rem;

  /* 背景层级 (zinc-950 / 900 / 800 / 700) */
  --background:    oklch(0.108 0 0);   /* zinc-950 #09090b */
  --foreground:    oklch(0.985 0 0);   /* zinc-50  #fafafa */

  --card:          oklch(0.15 0 0);    /* zinc-900 #18181b */
  --card-foreground: oklch(0.985 0 0);

  --popover:       oklch(0.15 0 0);
  --popover-foreground: oklch(0.985 0 0);

  /* 主色 Emerald */
  --primary:       oklch(0.696 0.17 162.48);  /* emerald-500 #10b981 */
  --primary-foreground: oklch(0.985 0 0);

  /* 次要 */
  --secondary:     oklch(0.21 0 0);    /* zinc-800 #27272a */
  --secondary-foreground: oklch(0.985 0 0);

  --muted:         oklch(0.21 0 0);
  --muted-foreground: oklch(0.635 0 0); /* zinc-400 #a1a1aa */

  --accent:        oklch(0.21 0 0);
  --accent-foreground: oklch(0.985 0 0);

  /* 危险/错误 */
  --destructive:   oklch(0.628 0.258 29.23); /* red-500 #ef4444 */

  /* 边框/输入 */
  --border:        oklch(0.21 0 0);    /* zinc-800 */
  --input:         oklch(0.27 0 0);    /* zinc-700 */
  --ring:          oklch(0.696 0.17 162.48); /* emerald */

  /* 图表色 */
  --chart-1: oklch(0.696 0.17 162.48);  /* emerald */
  --chart-2: oklch(0.769 0.188 70.08);
  --chart-3: oklch(0.646 0.222 41.116);
  --chart-4: oklch(0.6 0.118 184.704);
  --chart-5: oklch(0.488 0.243 264.376);

  /* 侧边栏 */
  --sidebar:          oklch(0.15 0 0);   /* zinc-900 */
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary:  oklch(0.696 0.17 162.48);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent:   oklch(0.21 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border:   oklch(0.21 0 0);
  --sidebar-ring:     oklch(0.696 0.17 162.48);
}

/* .dark 保留空块以兼容 shadcn 组件 */
.dark {
  --background:    oklch(0.108 0 0);
  --foreground:    oklch(0.985 0 0);
  --card:          oklch(0.15 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover:       oklch(0.15 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary:       oklch(0.696 0.17 162.48);
  --primary-foreground: oklch(0.985 0 0);
  --secondary:     oklch(0.21 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted:         oklch(0.21 0 0);
  --muted-foreground: oklch(0.635 0 0);
  --accent:        oklch(0.21 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive:   oklch(0.628 0.258 29.23);
  --border:        oklch(0.21 0 0);
  --input:         oklch(0.27 0 0);
  --ring:          oklch(0.696 0.17 162.48);
  --sidebar:       oklch(0.15 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.696 0.17 162.48);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.21 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.21 0 0);
  --sidebar-ring:  oklch(0.696 0.17 162.48);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 2: 在浏览器中验证视觉效果**

访问 `http://localhost:4567/login`，应该看到深色背景 + 深色卡片（不再是白色）。

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): switch to dark theme with emerald primary color"
```

---

### Task 2: 新建 `(app)` 路由组 + AppSidebar

这是最核心的结构变更。将 `dashboard/` 和 `connect/` 移入 `(app)/` 路由组，共享含侧边栏的 layout。

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app-sidebar.tsx`
- Move: `src/app/dashboard/` → `src/app/(app)/dashboard/`
- Move: `src/app/connect/` → `src/app/(app)/connect/`
- Delete: `src/app/dashboard/layout.tsx`
- Delete: `src/app/connect/layout.tsx`

**Step 1: 创建 AppSidebar 组件**

创建 `src/components/app-sidebar.tsx`：

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, LogOut } from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'
import { Button } from '@/components/ui/button'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

interface SidebarService {
  id: string
  label: string
  providerId: string
  status: Status
}

interface AppSidebarProps {
  services: SidebarService[]
  userEmail: string
}

const STATUS_COLORS: Record<Status, string> = {
  healthy:  'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
  unknown:  'bg-zinc-600',
}

const PROVIDER_INITIALS: Record<string, string> = {
  openrouter: 'OR',
  resend:     'RS',
  sentry:     'SN',
}

export function AppSidebar({ services, userEmail }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-card border-r border-border h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white">
            SP
          </span>
          <span className="font-semibold text-sm text-foreground group-hover:text-emerald-400 transition-colors">
            StackPulse
          </span>
        </Link>
      </div>

      {/* 服务列表 */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {services.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-2">还没有连接服务</p>
        ) : (
          services.map((service) => {
            const isActive = pathname === `/dashboard`
            return (
              <Link
                key={service.id}
                href="/dashboard"
                className={`
                  flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm
                  transition-colors relative group
                  ${isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }
                `}
              >
                {/* 左侧选中指示线 */}
                {isActive && (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-emerald-500 rounded-full" />
                )}
                {/* 状态点 */}
                <span className="relative flex h-2 w-2 shrink-0">
                  {(service.status === 'healthy' || service.status === 'warning') && (
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${STATUS_COLORS[service.status]}`} />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${STATUS_COLORS[service.status]}`} />
                </span>
                {/* Provider 首字母徽章 */}
                <span className="w-5 h-5 rounded bg-secondary flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                  {PROVIDER_INITIALS[service.providerId] ?? service.providerId.slice(0, 2).toUpperCase()}
                </span>
                {/* 名称 */}
                <span className="truncate">{service.label}</span>
              </Link>
            )
          })
        )}
      </nav>

      {/* 底部操作区 */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <Link href="/connect">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground border-border"
          >
            <Plus className="h-3.5 w-3.5" />
            添加服务
          </Button>
        </Link>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
            {userEmail[0]?.toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{userEmail}</span>
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
```

**Step 2: 创建 `(app)` 路由组 layout**

创建 `src/app/(app)/layout.tsx`：

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProvider } from '@/lib/providers'
import { AppSidebar } from '@/components/app-sidebar'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 查询服务列表（用于侧边栏）
  const { data: services } = await supabase
    .from('connected_services')
    .select(`
      id, provider_id, label, enabled,
      metric_snapshots ( status, fetched_at )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const sidebarServices = (services ?? []).map((s) => {
    const snapshots = (s.metric_snapshots ?? []) as Array<{ status: string; fetched_at: string }>
    const sortedSnaps = [...snapshots].sort(
      (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )
    const latestStatus = sortedSnaps[0]?.status as Status | undefined
    const provider = getProvider(s.provider_id)
    return {
      id: s.id,
      label: s.label ?? provider?.name ?? s.provider_id,
      providerId: s.provider_id,
      status: latestStatus ?? 'unknown' as Status,
    }
  })

  return (
    <div className="flex min-h-screen">
      <AppSidebar services={sidebarServices} userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: 移动路由文件**

```bash
# 创建 (app) 路由组目录
mkdir -p src/app/\(app\)/dashboard
mkdir -p src/app/\(app\)/connect/\[providerId\]

# 移动文件
mv src/app/dashboard/page.tsx src/app/\(app\)/dashboard/page.tsx
mv src/app/connect/page.tsx src/app/\(app\)/connect/page.tsx
mv src/app/connect/\[providerId\]/page.tsx src/app/\(app\)/connect/\[providerId\]/page.tsx

# 删除旧 layout（新 (app)/layout.tsx 替代了它们）
rm src/app/dashboard/layout.tsx
rm src/app/connect/layout.tsx

# 删除现在空的旧目录
rmdir src/app/dashboard 2>/dev/null || true
rmdir src/app/connect/\[providerId\] 2>/dev/null || true
rmdir src/app/connect 2>/dev/null || true
```

**Step 4: 验证路由不报错**

```bash
pnpm run build 2>&1 | tail -20
```

期望：无报错，或仅 lint 警告。如有路由找不到文件的错误，检查文件是否正确移动。

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): add (app) route group with AppSidebar"
```

---

### Task 3: StatusDot 组件

替换现有的 `StatusBadge`（圆角徽章）为更简洁的状态点 + 文字组合。

**Files:**
- Create: `src/components/status-dot.tsx`
- 注意：保留 `StatusBadge` 不删除（可能有地方还在用）

**Step 1: 写测试**

创建 `src/components/__tests__/status-dot.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusDot } from '../status-dot'

describe('StatusDot', () => {
  it('renders healthy status with emerald color class', () => {
    const { container } = render(<StatusDot status="healthy" />)
    const dot = container.querySelector('.bg-emerald-500')
    expect(dot).toBeTruthy()
  })

  it('renders warning status with amber color class', () => {
    const { container } = render(<StatusDot status="warning" />)
    const dot = container.querySelector('.bg-amber-500')
    expect(dot).toBeTruthy()
  })

  it('renders critical status with red color class', () => {
    const { container } = render(<StatusDot status="critical" />)
    const dot = container.querySelector('.bg-red-500')
    expect(dot).toBeTruthy()
  })

  it('renders label when showLabel is true', () => {
    render(<StatusDot status="healthy" showLabel />)
    expect(screen.getByText('正常')).toBeTruthy()
  })

  it('renders ping animation for healthy and warning', () => {
    const { container } = render(<StatusDot status="healthy" />)
    const ping = container.querySelector('.animate-ping')
    expect(ping).toBeTruthy()
  })

  it('does not render ping animation for critical', () => {
    const { container } = render(<StatusDot status="critical" />)
    const ping = container.querySelector('.animate-ping')
    expect(ping).toBeNull()
  })
})
```

**Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run src/components/__tests__/status-dot.test.tsx
```

期望：FAIL — `Cannot find module '../status-dot'`

**Step 3: 实现 StatusDot**

创建 `src/components/status-dot.tsx`：

```tsx
type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

const DOT_COLOR: Record<Status, string> = {
  healthy:  'bg-emerald-500',
  warning:  'bg-amber-500',
  critical: 'bg-red-500',
  unknown:  'bg-zinc-600',
}

const LABEL: Record<Status, string> = {
  healthy:  '正常',
  warning:  '警告',
  critical: '异常',
  unknown:  '未知',
}

interface StatusDotProps {
  status: Status
  showLabel?: boolean
  className?: string
}

export function StatusDot({ status, showLabel = false, className = '' }: StatusDotProps) {
  const hasPing = status === 'healthy' || status === 'warning'
  const color = DOT_COLOR[status]

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2 shrink-0">
        {hasPing && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${color}`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
      </span>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{LABEL[status]}</span>
      )}
    </span>
  )
}
```

**Step 4: 运行测试确认通过**

```bash
pnpm exec vitest run src/components/__tests__/status-dot.test.tsx
```

期望：全部 PASS

**Step 5: Commit**

```bash
git add src/components/status-dot.tsx src/components/__tests__/status-dot.test.tsx
git commit -m "feat(component): add StatusDot with pulse animation"
```

---

### Task 4: Sparkline 组件（SVG 趋势线）

轻量 SVG 折线图，不引入额外图表库。

**Files:**
- Create: `src/components/sparkline.tsx`
- Create: `src/components/__tests__/sparkline.test.tsx`

**Step 1: 写测试**

创建 `src/components/__tests__/sparkline.test.tsx`：

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '../sparkline'

describe('Sparkline', () => {
  it('renders an svg element', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4, 5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a polyline when given data', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />)
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('renders nothing meaningful when values is empty', () => {
    const { container } = render(<Sparkline values={[]} />)
    // svg still renders but polyline has no points
    const polyline = container.querySelector('polyline')
    expect(polyline?.getAttribute('points')).toBe('')
  })

  it('renders a single value without crash', () => {
    const { container } = render(<Sparkline values={[5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
```

**Step 2: 运行测试确认失败**

```bash
pnpm exec vitest run src/components/__tests__/sparkline.test.tsx
```

**Step 3: 实现 Sparkline**

创建 `src/components/sparkline.tsx`：

```tsx
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  color = '#10b981',
  className = '',
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} className={className}>
        <polyline points="" fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const padding = 2
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2

  const points = values
    .map((v, i) => {
      const x = padding + (i / Math.max(values.length - 1, 1)) * innerWidth
      const y = padding + innerHeight - ((v - min) / range) * innerHeight
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className={className}>
      <defs>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

**Step 4: 运行测试确认通过**

```bash
pnpm exec vitest run src/components/__tests__/sparkline.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/sparkline.tsx src/components/__tests__/sparkline.test.tsx
git commit -m "feat(component): add Sparkline SVG trend chart"
```

---

### Task 5: Provider 图标资源

在 `public/icons/` 放置各 Provider 的 SVG 图标（简化版，用于卡片和侧边栏）。

**Files:**
- Create: `public/icons/openrouter.svg`
- Create: `public/icons/resend.svg`
- Create: `public/icons/sentry.svg`

**Step 1: 创建 OpenRouter 图标**

`public/icons/openrouter.svg`（使用品牌色圆形 + 字母 fallback）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#111"/>
  <path d="M8 16c0-4.418 3.582-8 8-8s8 3.582 8 8-3.582 8-8 8-8-3.582-8-8z" fill="none" stroke="#10b981" stroke-width="2"/>
  <path d="M13 13l6 3-6 3V13z" fill="#10b981"/>
</svg>
```

**Step 2: 创建 Resend 图标**

`public/icons/resend.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#111"/>
  <path d="M8 21V11l14 5-14 5z" fill="#fafafa"/>
</svg>
```

**Step 3: 创建 Sentry 图标**

`public/icons/sentry.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#111"/>
  <path d="M16 8L8 22h5l3-5.2 3 5.2h5L16 8z" fill="#8b5cf6"/>
  <path d="M11 22h10" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round"/>
</svg>
```

**Step 4: 创建 ProviderIcon 辅助组件**

创建 `src/components/provider-icon.tsx`：

```tsx
import Image from 'next/image'

interface ProviderIconProps {
  providerId: string
  size?: number
  className?: string
}

const PROVIDER_FALLBACK_COLOR: Record<string, string> = {
  openrouter: 'bg-emerald-900 text-emerald-400',
  resend:     'bg-zinc-800 text-zinc-300',
  sentry:     'bg-violet-900 text-violet-400',
}

const PROVIDER_INITIALS: Record<string, string> = {
  openrouter: 'OR',
  resend:     'Re',
  sentry:     'Sn',
}

export function ProviderIcon({ providerId, size = 32, className = '' }: ProviderIconProps) {
  const iconPath = `/icons/${providerId}.svg`
  const fallbackColor = PROVIDER_FALLBACK_COLOR[providerId] ?? 'bg-zinc-800 text-zinc-400'
  const initials = PROVIDER_INITIALS[providerId] ?? providerId.slice(0, 2).toUpperCase()

  return (
    <div
      className={`rounded-md overflow-hidden flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={iconPath}
        alt={providerId}
        width={size}
        height={size}
        className="rounded-md"
        onError={(e) => {
          // Fallback: hide img, show initials
          e.currentTarget.style.display = 'none'
        }}
        unoptimized
      />
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add public/icons/ src/components/provider-icon.tsx
git commit -m "feat(assets): add provider SVG icons and ProviderIcon component"
```

---

### Task 6: 改造 ServiceCard

重新设计服务监控卡片，加入图标、大数字、Sparkline、状态点。

**Files:**
- Modify: `src/components/service-card.tsx`

**Step 1: 改写 ServiceCard**

完整替换 `src/components/service-card.tsx`：

```tsx
import { ProviderIcon } from './provider-icon'
import { StatusDot } from './status-dot'
import { Sparkline } from './sparkline'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: Status
  fetched_at: string
}

interface CollectorDisplay {
  id: string
  name: string
  type: string
  snapshot: Snapshot | null
  history?: number[]
}

interface ServiceCardProps {
  id: string
  providerName: string
  providerId: string
  label: string
  category: string
  collectors: CollectorDisplay[]
  authExpired: boolean
}

function MetricDisplay({ collector }: { collector: CollectorDisplay }) {
  const { snapshot, type, name, history = [] } = collector

  if (!snapshot) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{name}</p>
        <p className="text-sm text-muted-foreground">等待采集...</p>
      </div>
    )
  }

  if (type === 'currency') {
    const val = snapshot.value ?? 0
    const isWarning = snapshot.status === 'warning'
    const isCritical = snapshot.status === 'critical'
    return (
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{name}</p>
          <p className={`text-3xl font-bold font-mono ${
            isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-foreground'
          }`}>
            ${val.toFixed(2)}
          </p>
        </div>
        {history.length > 1 && (
          <Sparkline
            values={history}
            width={72}
            height={28}
            color={isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'}
            className="opacity-80"
          />
        )}
      </div>
    )
  }

  if (type === 'count') {
    return (
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{name}</p>
          <p className="text-3xl font-bold font-mono text-foreground">
            {snapshot.value?.toLocaleString() ?? '—'}
            {snapshot.unit && (
              <span className="text-sm font-normal text-muted-foreground ml-1">{snapshot.unit}</span>
            )}
          </p>
        </div>
        {history.length > 1 && (
          <Sparkline values={history} width={72} height={28} />
        )}
      </div>
    )
  }

  if (type === 'status') {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">{name}</p>
        <StatusDot status={snapshot.status} showLabel />
      </div>
    )
  }

  if (type === 'percentage') {
    const pct = snapshot.value ?? 0
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">{name}</span>
          <span className="font-mono">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  return null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export function ServiceCard({ providerId, providerName, label, collectors, authExpired }: ServiceCardProps) {
  const overallStatus: Status = authExpired
    ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'critical') ? 'critical'
    : collectors.some((c) => c.snapshot?.status === 'warning') ? 'warning'
    : collectors.every((c) => c.snapshot?.status === 'healthy') ? 'healthy'
    : 'unknown'

  const lastUpdated = collectors
    .map((c) => c.snapshot?.fetched_at)
    .filter(Boolean)
    .sort()
    .pop()

  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-border/80 transition-all hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)] group">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <ProviderIcon providerId={providerId} size={36} />
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none mb-1">
              {label || providerName}
            </h3>
            <p className="text-xs text-muted-foreground">{providerName}</p>
          </div>
        </div>
        <StatusDot status={overallStatus} showLabel />
      </div>

      {/* 指标 */}
      <div className="space-y-3">
        {authExpired && (
          <p className="text-xs text-red-400">凭证已过期，请重新连接</p>
        )}
        {collectors.map((collector) => (
          <MetricDisplay key={collector.id} collector={collector} />
        ))}
      </div>

      {/* 底部时间戳 */}
      {lastUpdated && (
        <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border/50">
          更新于 {timeAgo(lastUpdated)}
        </p>
      )}
    </div>
  )
}
```

**Step 2: 更新 dashboard page 传递 providerId**

打开 `src/app/(app)/dashboard/page.tsx`，在 `servicesWithMeta` 的 map 里确保传递 `providerId`：

找到 `return {` 块，确保包含：
```tsx
return {
  id: service.id,
  providerId: service.provider_id,   // ← 确保这行存在
  label: service.label ?? provider?.name ?? service.provider_id,
  providerName: provider?.name ?? service.provider_id,
  category: provider?.category ?? 'other',
  authExpired: service.auth_expired,
  collectors: (provider?.collectors ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.metricType,
    snapshot: latestByCollector.get(c.id) ?? null,
  })),
}
```

**Step 3: 检查 ServiceCard 调用点**

确认 `ServiceCard` 被调用时传了 `providerId` prop（dashboard/page.tsx 的 `<ServiceCard key={service.id} {...service} />`）。

**Step 4: 运行开发服务器验证**

访问 `http://localhost:4567/dashboard`，应看到带图标的深色卡片。

**Step 5: Commit**

```bash
git add src/components/service-card.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(component): redesign ServiceCard with icon, sparkline, and dark theme"
```

---

### Task 7: 改造 Dashboard 页面

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: 替换 dashboard page**

完整替换 `src/app/(app)/dashboard/page.tsx`：

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/components/service-card'
import { StatusDot } from '@/components/status-dot'
import { getProvider } from '@/lib/providers'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: services } = await supabase
    .from('connected_services')
    .select(`
      id, provider_id, label, enabled, auth_expired, created_at,
      metric_snapshots (
        collector_id, value, value_text, unit, status, fetched_at
      )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const servicesWithMeta = (services ?? []).map((service) => {
    const provider = getProvider(service.provider_id)
    const snapshots = (service.metric_snapshots ?? []) as Array<{
      collector_id: string; value: number | null; value_text: string | null;
      unit: string | null; status: string; fetched_at: string
    }>

    const latestByCollector = new Map<string, typeof snapshots[number]>()
    for (const snap of [...snapshots].sort((a, b) =>
      new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
    )) {
      if (!latestByCollector.has(snap.collector_id)) {
        latestByCollector.set(snap.collector_id, snap)
      }
    }

    return {
      id: service.id,
      providerId: service.provider_id,
      label: service.label ?? provider?.name ?? service.provider_id,
      providerName: provider?.name ?? service.provider_id,
      category: provider?.category ?? 'other',
      authExpired: service.auth_expired,
      collectors: (provider?.collectors ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        type: c.metricType,
        snapshot: (latestByCollector.get(c.id) ?? null) as {
          collector_id: string; value: number | null; value_text: string | null;
          unit: string | null; status: Status; fetched_at: string
        } | null,
      })),
    }
  })

  const totalCount = servicesWithMeta.length
  const healthyCount = servicesWithMeta.filter((s) =>
    s.collectors.every((c) => !c.snapshot || c.snapshot.status === 'healthy')
  ).length
  const hasIssues = healthyCount < totalCount

  return (
    <div className="p-8">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground">服务监控</h1>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <StatusDot status={hasIssues ? 'warning' : 'healthy'} />
              <span className="text-sm text-muted-foreground">
                {hasIssues
                  ? `${totalCount - healthyCount} 个服务需要关注`
                  : `全部 ${totalCount} 个服务运行正常`
                }
              </span>
            </div>
          )}
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/connect">+ 添加服务</Link>
        </Button>
      </div>

      {/* 空状态 */}
      {servicesWithMeta.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-6">
            <span className="text-2xl">📡</span>
          </div>
          <h2 className="text-base font-semibold text-foreground mb-2">还没有连接任何服务</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            连接你的 API 服务，实时掌握余额、状态和错误量
          </p>
          <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/connect">连接第一个服务</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servicesWithMeta.map((service) => (
            <ServiceCard key={service.id} {...service} />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat(page): redesign dashboard with status summary and dark cards"
```

---

### Task 8: 改造 Connect 选择页

**Files:**
- Modify: `src/app/(app)/connect/page.tsx`

**Step 1: 替换 Connect 选择页**

```tsx
import Link from 'next/link'
import { getAllProviders } from '@/lib/providers'
import { ProviderIcon } from '@/components/provider-icon'

const CATEGORY_LABELS: Record<string, string> = {
  ai: 'AI', monitoring: '监控', email: '邮件',
  hosting: '托管', payment: '支付', other: '其他',
}

export default function ConnectPage() {
  const providers = getAllProviders()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">连接服务</h1>
        <p className="text-sm text-muted-foreground mt-1">选择要接入的 API 服务</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((provider) => (
          <Link key={provider.id} href={`/connect/${provider.id}`}>
            <div className="bg-card border border-border rounded-xl p-5 hover:border-emerald-500/30 hover:bg-card/80 transition-all cursor-pointer group">
              <div className="flex items-center gap-3 mb-3">
                <ProviderIcon providerId={provider.id} size={36} />
                <div>
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                    {provider.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[provider.category] ?? provider.category}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {provider.authType === 'oauth2' ? 'OAuth 授权' :
                   provider.authType === 'hybrid' ? 'OAuth / API Key' : 'API Key 接入'}
                </span>
                <span className="text-xs text-muted-foreground">
                  监控 {provider.collectors.length} 项指标
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/connect/page.tsx
git commit -m "feat(page): redesign connect provider selection with dark cards"
```

---

### Task 9: 改造 Connect 表单页

**Files:**
- Modify: `src/app/(app)/connect/[providerId]/page.tsx`

**Step 1: 替换表单页**

```tsx
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
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/connect/\[providerId\]/page.tsx
git commit -m "feat(page): redesign connect form with dark theme and breadcrumb"
```

---

### Task 10: 改造登录页

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**Step 1: 替换登录页**

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  const isError = message && (
    message.includes('错误') || message.includes('failed') ||
    message.includes('Invalid') || message.includes('invalid')
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <span className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-xs font-bold text-white">
            SP
          </span>
          <span className="text-lg font-semibold text-foreground">StackPulse</span>
        </div>

        {/* 卡片 */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
          <h2 className="text-base font-semibold text-foreground mb-1">
            {mode === 'login' ? '登录账号' : '创建账号'}
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {mode === 'login' ? '欢迎回来' : '开始监控你的 API 服务'}
          </p>

          <form action={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">邮箱</Label>
              <Input
                id="email" name="email" type="email" required
                autoComplete="email"
                placeholder="you@example.com"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">密码</Label>
              <Input
                id="password" name="password" type="password" required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="bg-secondary border-border text-foreground placeholder:text-muted-foreground/40"
              />
            </div>

            {message && (
              <p className={`text-xs px-3 py-2 rounded-md ${
                isError
                  ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                  : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
              }`}>
                {message}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={pending}
            >
              {pending ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </Button>
          </form>

          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}
            className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat(page): redesign login page with dark theme and emerald logo"
```

---

### Task 11: 收尾与全量测试

**Files:**
- Check: 所有现有测试仍然通过

**Step 1: 运行全量单元测试**

```bash
pnpm exec vitest run
```

期望：所有测试通过（包括新增的 status-dot 和 sparkline 测试）。
若有失败，逐个修复后再继续。

**Step 2: 在浏览器中走完整流程**

```bash
# 确认开发服务器运行中
curl -s -o /dev/null -w "%{http_code}" http://localhost:4567/
```

手动测试清单：
- [ ] `/login` — 深色卡片，绿色 SP 图标
- [ ] 登录后 → `/dashboard` — 侧边栏 + 服务卡片
- [ ] 侧边栏 → 点击「+ 添加服务」→ `/connect` — Provider 卡片
- [ ] 点击 OpenRouter → `/connect/openrouter` — 面包屑 + 深色表单
- [ ] 填写 API Key → 连接 → 跳转 dashboard → 数据立即显示

**Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete UI redesign - dark theme command center layout"
```

---

## 测试文件汇总

| 文件 | 覆盖内容 |
|------|----------|
| `src/components/__tests__/status-dot.test.tsx` | 状态点颜色、动画、标签 |
| `src/components/__tests__/sparkline.test.tsx` | SVG 渲染、数据为空边界 |
| `src/lib/providers/` 现有测试 | Provider 注册、验证（不受 UI 改动影响）|
| `src/lib/crypto.test.ts` | 加密解密（不受 UI 改动影响）|

---

*计划保存时间：2026-02-17*
*对应设计文档：`docs/plans/2026-02-17-ui-redesign-design.md`*
