'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Server, Bell, Plug, Clock, Settings2, LogOut,
} from 'lucide-react'
import { signOut } from '@/app/(auth)/login/actions'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

interface AppSidebarProps {
  userEmail: string
  alertCount?: number
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard',         icon: LayoutDashboard },
  { label: 'Services',  href: '/dashboard',         icon: Server          },
  { label: 'Alerts',    href: '/dashboard/history', icon: Bell,  badge: true },
  { label: 'Connect',   href: '/connect',           icon: Plug            },
  { label: 'History',   href: '/dashboard/history', icon: Clock           },
  { label: 'Settings',  href: '/dashboard/channels',icon: Settings2       },
]

export function AppSidebar({ userEmail, alertCount = 0 }: AppSidebarProps) {
  const pathname = usePathname()

  function isActive(label: string) {
    if (label === 'Dashboard') return pathname === '/dashboard'
    if (label === 'Services')  return pathname.startsWith('/dashboard/') && pathname !== '/dashboard/history' && pathname !== '/dashboard/channels'
    if (label === 'Alerts')    return pathname === '/dashboard/history'
    if (label === 'History')   return false
    if (label === 'Connect')   return pathname.startsWith('/connect')
    if (label === 'Settings')  return pathname === '/dashboard/channels'
    return false
  }

  const initial = userEmail[0]?.toUpperCase() ?? 'U'

  return (
    <aside
      className="w-56 shrink-0 flex flex-col h-screen sticky top-0"
      style={{ background: '#08080C', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="px-5 py-5">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            SP
          </span>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
            StackPulse
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon, badge }) => {
          const active = isActive(label)
          const showBadge = badge && alertCount > 0
          return (
            <Link
              key={label}
              href={href}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color:      active ? 'var(--primary)' : 'var(--muted-foreground)',
                background: active ? 'var(--sp-success-muted)' : 'transparent',
              }}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </span>
              {showBadge && (
                <span
                  className="flex items-center justify-center text-[10px] font-bold min-w-[18px] h-[18px] rounded-full px-1"
                  style={{ background: 'var(--sp-error)', color: '#fff' }}
                >
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div
        className="px-4 py-4 flex items-center gap-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--sp-success-muted)', color: 'var(--primary)' }}
        >
          {initial}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs truncate" style={{ color: 'var(--foreground)' }}>
            {userEmail}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--sp-text-tertiary)' }}>
            Free Plan
          </span>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="transition-colors"
            style={{ color: 'var(--sp-text-tertiary)' }}
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </aside>
  )
}
