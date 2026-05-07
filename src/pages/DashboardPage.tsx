import { useEffect, useState } from 'react'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { getDashboard } from '../api/endpoints/dashboard'
import type {
  DashboardKpiValue,
  DashboardResponse,
  DashboardStatusLevel,
  DashboardTimeseriesDaily,
} from '../api/endpoints/dashboard'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

// ─── Helpers ────────────────────────────────────────────────────────────────

function toLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-'
  return `${value.toFixed(1)}%`
}

function utc(value: string | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

function badgeVariant(s: DashboardStatusLevel | string | undefined) {
  if (s === 'good') return 'good' as const
  if (s === 'warning') return 'warning' as const
  if (s === 'critical') return 'critical' as const
  return 'default' as const
}

function alertVariant(s: DashboardStatusLevel | string | undefined) {
  if (s === 'good') return 'good' as const
  if (s === 'warning') return 'warning' as const
  if (s === 'critical') return 'critical' as const
  return 'info' as const
}

function kpiBorderClass(s: DashboardStatusLevel | string | undefined): string {
  if (s === 'good') return 'border-l-emerald-500'
  if (s === 'warning') return 'border-l-amber-500'
  if (s === 'critical') return 'border-l-red-500'
  return 'border-l-primary'
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text/30">
      {children}
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-raised rounded-xl border border-text/10 p-5 ${className}`}>{children}</div>
  )
}

function Divider() {
  return <div className="h-px bg-text/8" />
}

function KpiCard({ label, kpi }: { label: string; kpi: DashboardKpiValue }) {
  const displayValue = kpi.unit ? `${kpi.value} ${kpi.unit}` : kpi.value
  const trend = kpi.trend

  const TrendIcon =
    trend?.direction === 'up'
      ? TrendingUp
      : trend?.direction === 'down'
        ? TrendingDown
        : Minus

  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-500'
      : trend?.direction === 'down'
        ? 'text-red-400'
        : 'text-text/30'

  return (
    <div
      className={`bg-raised rounded-xl border border-text/10 border-l-4 p-4 ${kpiBorderClass(kpi.status)}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text/40">
        {kpi.label ?? toLabel(label)}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-text">{displayValue}</p>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon className="size-3 shrink-0" />
          <span>
            {trend.delta_abs} ({pct(trend.delta_pct)})
          </span>
        </div>
      )}
      {kpi.status && (
        <div className="mt-2">
          <Badge variant={badgeVariant(kpi.status)}>{kpi.status}</Badge>
        </div>
      )}
    </div>
  )
}

function KeyValueList({ data }: { data: Record<string, number> }) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4">
          <span className="text-sm text-text/50">{toLabel(key)}</span>
          <span className="text-sm font-semibold tabular-nums text-text">{value}</span>
        </div>
      ))}
    </div>
  )
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[]
  rows: Array<Record<string, string | number | null>>
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-text/30">No data available.</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-text/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-overlay">
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-text/30"
              >
                {toLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-text/5 transition-colors hover:bg-overlay/50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2.5 text-text/70">
                  {String(row[col] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DailyTable({ rows }: { rows: DashboardTimeseriesDaily[] }) {
  const cols = ['date', 'posts_processed', 'posts_failed', 'events_created', 'events_selected']
  const data = rows.map((r) => ({
    date: r.date,
    posts_processed: r.posts_processed ?? 0,
    posts_failed: r.posts_failed ?? 0,
    events_created: r.events_created ?? 0,
    events_selected: r.events_selected ?? 0,
  }))
  return <DataTable columns={cols} rows={data} />
}

// ─── Main Content ────────────────────────────────────────────────────────────

function DashboardContent({ data }: { data: DashboardResponse }) {
  const healthScore = Math.max(0, Math.min(100, data.status?.score ?? 0))
  const alerts = data.status?.alerts ?? []
  const kpis = Object.entries(data.kpis ?? {})
  const igPipeline = data.pipelines?.instagram_posts
  const evPipeline = data.pipelines?.social_events
  const topPublishers = data.breakdowns?.top_publishers_by_events ?? []
  const sourceTypes = data.breakdowns?.by_event_source_type ?? []
  const pubCols = Array.from(new Set(topPublishers.flatMap(Object.keys)))
  const srcCols = Array.from(new Set(sourceTypes.flatMap(Object.keys)))
  const daily = data.timeseries?.daily ?? []

  const barColor =
    healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {/* Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text/25">
          Schema {data.schema_version} · Generated {utc(data.generated_at)}
        </p>
        <p className="text-xs text-text/25">
          {utc(data.period?.start)} → {utc(data.period?.end)}
        </p>
      </div>

      {/* Health */}
      <section>
        <SectionTitle>Overall Health</SectionTitle>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text">System Status</p>
              <p className="mt-0.5 text-xs text-text/40">Score: {healthScore} / 100</p>
            </div>
            <Badge variant={badgeVariant(data.status?.overall_health)}>
              {toLabel(data.status?.overall_health ?? 'unknown')}
            </Badge>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-text/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
          {alerts.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              {alerts.map((a, i) => (
                <Alert key={`${a.code ?? 'a'}-${i}`} variant={alertVariant(a.level)}>
                  {a.message}
                </Alert>
              ))}
            </div>
          )}
        </Card>
      </section>

      {/* KPIs */}
      {kpis.length > 0 && (
        <section>
          <SectionTitle>KPIs</SectionTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {kpis.map(([key, kpi]) => (
              <KpiCard key={key} label={key} kpi={kpi} />
            ))}
          </div>
        </section>
      )}

      {/* Pipelines */}
      <section>
        <SectionTitle>Pipelines</SectionTitle>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <p className="mb-4 text-sm font-semibold text-text">Instagram Posts</p>
            {igPipeline ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
                    Counts
                  </p>
                  <KeyValueList data={igPipeline.counts ?? {}} />
                </div>
                <Divider />
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
                    Rates
                  </p>
                  <KeyValueList data={igPipeline.rates ?? {}} />
                </div>
                {igPipeline.cost && Object.keys(igPipeline.cost).length > 0 && (
                  <>
                    <Divider />
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
                        Cost
                      </p>
                      <KeyValueList data={igPipeline.cost} />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-text/30">No data available.</p>
            )}
          </Card>

          <Card>
            <p className="mb-4 text-sm font-semibold text-text">Social Events</p>
            {evPipeline ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
                    Counts
                  </p>
                  <KeyValueList data={evPipeline.counts ?? {}} />
                </div>
                <Divider />
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text/30">
                    Rates
                  </p>
                  <KeyValueList data={evPipeline.rates ?? {}} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-text/30">No data available.</p>
            )}
          </Card>
        </div>
      </section>

      {/* Breakdowns */}
      {(topPublishers.length > 0 || sourceTypes.length > 0) && (
        <section>
          <SectionTitle>Breakdowns</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <p className="mb-4 text-sm font-semibold text-text">Top Publishers by Events</p>
              <DataTable
                columns={pubCols}
                rows={topPublishers as Array<Record<string, string | number | null>>}
              />
            </Card>
            <Card>
              <p className="mb-4 text-sm font-semibold text-text">By Event Source Type</p>
              <DataTable
                columns={srcCols}
                rows={sourceTypes as Array<Record<string, string | number | null>>}
              />
            </Card>
          </div>
        </section>
      )}

      {/* Timeseries */}
      <section>
        <SectionTitle>Daily Timeseries</SectionTitle>
        <Card>
          <DailyTable rows={daily} />
        </Card>
      </section>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type DashState =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardResponse }
  | { status: 'error'; error: string }

export function DashboardPage() {
  const [state, setState] = useState<DashState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getDashboard()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : 'Failed to load dashboard',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-text/30">Loading dashboard…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="max-w-lg">
        <Alert variant="critical">{state.error}</Alert>
      </div>
    )
  }

  return <DashboardContent data={state.data} />
}
