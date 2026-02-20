import type { ComponentType } from 'react'
import type { CustomDetailViewProps } from './types'

export const CUSTOM_DETAIL_VIEW_IDS = new Set<string>([
  'github',
])

export type CustomDetailViewRegistry = Record<string, ComponentType<CustomDetailViewProps>>
