import type { Collector } from '../types'

export interface Snapshot {
  collector_id: string
  value: number | null
  value_text: string | null
  unit: string | null
  status: string
  fetched_at: string
}

export interface CustomDetailViewProps {
  serviceId: string
  snapshots: Snapshot[]
  collectors: Collector[]
}
