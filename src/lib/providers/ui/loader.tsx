'use client'

import dynamic from 'next/dynamic'
import type { CustomDetailViewProps } from './types'
import { CUSTOM_DETAIL_VIEW_IDS } from './registry'

// Statically list custom views so bundlers can analyse imports
const VIEWS: Record<string, React.ComponentType<CustomDetailViewProps>> = {
  github: dynamic(() => import('./github')),
}

export function CustomDetailViewLoader({
  providerId,
  ...props
}: { providerId: string } & CustomDetailViewProps) {
  if (!CUSTOM_DETAIL_VIEW_IDS.has(providerId)) return null
  const View = VIEWS[providerId]
  if (!View) return null
  return <View {...props} />
}
