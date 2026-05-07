import { apiClient } from '../client'

export type DashboardStatusLevel = 'good' | 'warning' | 'critical'

export interface DashboardAlert {
  message: string
  level?: DashboardStatusLevel | string
  code?: string
}

export interface DashboardStatus {
  overall_health: string
  score: number
  alerts: DashboardAlert[]
}

export interface DashboardTrend {
  direction: 'up' | 'down' | 'flat' | string
  delta_abs: number
  delta_pct: number | null
}

export interface DashboardKpiValue {
  label?: string
  value: number
  unit?: string
  status?: DashboardStatusLevel | string
  trend?: DashboardTrend
}

export type DashboardKpis = Record<string, DashboardKpiValue>

export interface DashboardPipelineNode {
  counts: Record<string, number>
  rates: Record<string, number>
  cost?: Record<string, number>
}

export interface DashboardPipelines {
  instagram_posts?: DashboardPipelineNode
  social_events?: DashboardPipelineNode
}

export interface DashboardBreakdowns {
  top_publishers_by_events?: Array<Record<string, string | number | null>>
  by_event_source_type?: Array<Record<string, string | number | null>>
}

export interface DashboardTimeseriesDaily {
  date: string
  posts_processed?: number
  posts_failed?: number
  events_created?: number
  events_selected?: number
  [key: string]: string | number | null | undefined
}

export interface DashboardTimeseries {
  daily?: DashboardTimeseriesDaily[]
}

export interface DashboardPeriod {
  start: string
  end: string
}

export interface DashboardResponse {
  schema_version: string
  generated_at: string
  period: DashboardPeriod
  status: DashboardStatus
  kpis: DashboardKpis
  pipelines: DashboardPipelines
  breakdowns: DashboardBreakdowns
  timeseries: DashboardTimeseries
  ui_hints?: Record<string, unknown>
}

export async function getDashboard(): Promise<DashboardResponse> {
  return apiClient.get<DashboardResponse>('/dashboard/')
}
