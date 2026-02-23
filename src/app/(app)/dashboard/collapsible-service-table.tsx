"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ProviderIcon } from '@/components/provider-icon'
import { timeAgo, pickKeyMetrics, type ProviderGroup, type CollectorRow } from './helpers'

type Status = 'healthy' | 'warning' | 'critical' | 'unknown'

const STATUS_DOT: Record<Status, { label: string; color: string; dot: string }> = {
  healthy:  { label: 'Healthy', color: '#10B981', dot: '#10B981' },
  warning:  { label: 'Warning', color: '#F59E0B', dot: '#F59E0B' },
  critical: { label: 'Failed',  color: '#EF4444', dot: '#EF4444' },
  unknown:  { label: 'Unknown', color: '#555570', dot: '#555570' },
}

function StatusDot({ status }: { status: Status }) {
  const s = STATUS_DOT[status]
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="rounded-full flex-shrink-0"
        style={{ width: 6, height: 6, background: s.dot }}
      />
      <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
    </span>
  )
}

function InlineMetrics({ collectors }: { collectors: CollectorRow[] }) {
  const metrics = pickKeyMetrics(collectors, 3)
  if (metrics.length === 0) return <span className="text-xs" style={{ color: '#555570' }}>—</span>
  return (
    <span className="flex items-center gap-4">
      {metrics.map((c) => {
        const val = c.snapshot!.value_text
          ?? (c.snapshot!.value !== null
            ? `${Number(c.snapshot!.value).toLocaleString()}${c.snapshot!.unit ? ' ' + c.snapshot!.unit : ''}`
            : '—')
        const short = c.name.split(' ').pop()?.toLowerCase() ?? c.id
        return (
          <span key={c.id} className="flex items-center gap-1">
            <span className="text-xs font-semibold" style={{ color: '#F0F0F5' }}>{val}</span>
            <span className="text-[11px]" style={{ color: '#555570' }}>{short}</span>
          </span>
        )
      })}
    </span>
  )
}

interface Props {
  groups: ProviderGroup[]
}

export function CollapsibleServiceTable({ groups }: Props) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  function toggleGroup(providerId: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(providerId)) {
        next.delete(providerId)
      } else {
        next.add(providerId)
      }
      return next
    })
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#111118', border: '1px solid #1E1E2A' }}
    >
      {/* Table Header */}
      <div
        className="flex items-center px-4 py-2.5"
        style={{ background: '#0D0D14', borderBottom: '1px solid #1E1E2A' }}
      >
        <span className="text-[11px] font-semibold" style={{ color: '#555570', width: 280 }}>Service</span>
        <span className="text-[11px] font-semibold" style={{ color: '#555570', width: 100 }}>Status</span>
        <span className="text-[11px] font-semibold flex-1" style={{ color: '#555570' }}>Key Metrics</span>
        <span className="text-[11px] font-semibold" style={{ color: '#555570', textAlign: 'right', minWidth: 80 }}>Last Synced</span>
      </div>

      {/* Rows */}
      {groups.map((group, gi) => {
        const isLast = gi === groups.length - 1
        const borderBottom = isLast ? undefined : '1px solid #1E1E2A'

        if (!group.isGroup) {
          const svc = group.services[0]
          return (
            <Link
              key={svc.id}
              href={`/dashboard/${svc.id}`}
              className="flex items-center px-4 py-3 transition-colors hover:bg-white/[0.02]"
              style={{ borderBottom }}
            >
              <div className="flex items-center gap-2.5" style={{ width: 280, minWidth: 0 }}>
                <ProviderIcon providerId={svc.providerId} size={22} />
                <span className="text-[13px] font-semibold truncate" style={{ color: '#F0F0F5' }}>
                  {svc.label}
                </span>
              </div>
              <div style={{ width: 100 }}>
                <StatusDot status={svc.status as Status} />
              </div>
              <div className="flex-1 min-w-0">
                <InlineMetrics collectors={svc.collectors} />
              </div>
              <div style={{ minWidth: 80, textAlign: 'right' }}>
                {svc.lastUpdated ? (
                  <span className="text-[11px]" style={{ color: '#555570' }}>
                    {timeAgo(svc.lastUpdated)}
                  </span>
                ) : null}
              </div>
            </Link>
          )
        }

        // Group row + sub-rows
        const isCollapsed = collapsedGroups.has(group.providerId)
        const groupLastUpdated = group.services
          .map((s) => s.lastUpdated)
          .filter(Boolean)
          .sort()
          .pop()
        const firstSvc = group.services[0]

        return (
          <div key={group.providerId} style={{ borderBottom }}>
            {/* Group header — clickable button to collapse/expand */}
            <button
              type="button"
              onClick={() => toggleGroup(group.providerId)}
              className="w-full flex items-center px-4 py-3 transition-colors hover:bg-white/[0.02] cursor-pointer"
              style={{ background: '#0F0F17', borderBottom: '1px solid #1E1E2A' }}
            >
              <div className="flex items-center gap-2.5" style={{ width: 280, minWidth: 0 }}>
                {isCollapsed
                  ? <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#8888A0' }} />
                  : <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#8888A0' }} />
                }
                <ProviderIcon providerId={group.providerId} size={22} />
                <span className="text-[13px] font-semibold" style={{ color: '#F0F0F5' }}>
                  {group.providerName}
                </span>
                <span
                  className="rounded-full text-[10px] font-medium px-2 py-0.5"
                  style={{ background: '#1A1A24', color: '#8888A0' }}
                >
                  {group.services.length} projects
                </span>
              </div>
              <div style={{ width: 100 }}>
                <StatusDot status={group.groupStatus as Status} />
              </div>
              <div className="flex-1 min-w-0">
                <InlineMetrics collectors={firstSvc.collectors} />
              </div>
              <div style={{ minWidth: 80, textAlign: 'right' }}>
                {groupLastUpdated ? (
                  <span className="text-[11px]" style={{ color: '#555570' }}>
                    {timeAgo(groupLastUpdated)}
                  </span>
                ) : null}
              </div>
            </button>

            {/* Sub-rows — hidden when collapsed */}
            {!isCollapsed && group.services.map((svc, si) => {
              const isSubLast = si === group.services.length - 1
              return (
                <Link
                  key={svc.id}
                  href={`/dashboard/${svc.id}`}
                  className="flex items-center transition-colors hover:bg-white/[0.02]"
                  style={{
                    paddingLeft: 42,
                    paddingRight: 16,
                    paddingTop: 10,
                    paddingBottom: 10,
                    borderBottom: isSubLast ? undefined : '1px solid #1E1E2A',
                  }}
                >
                  <div className="flex flex-col gap-0.5" style={{ width: 238, minWidth: 0 }}>
                    <span className="text-xs font-medium truncate" style={{ color: '#F0F0F5' }}>
                      {svc.label}
                    </span>
                  </div>
                  <div style={{ width: 100 }}>
                    <StatusDot status={svc.status as Status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <InlineMetrics collectors={svc.collectors} />
                  </div>
                  <div style={{ minWidth: 80, textAlign: 'right' }}>
                    {svc.lastUpdated ? (
                      <span className="text-[11px]" style={{ color: '#555570' }}>
                        {timeAgo(svc.lastUpdated)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
