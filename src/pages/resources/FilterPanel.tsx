import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { CrudColumnSchema, CrudModelSchema } from '../../api/types'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

type Filters = Record<string, string>

interface FilterPanelProps {
  model: CrudModelSchema
  active: Filters
  onApply: (filters: Filters) => void
  onClose: () => void
}

// ─── Per-column filter control ────────────────────────────────────────────────

function ColumnFilter({
  col,
  values,
  onChange,
}: {
  col: CrudColumnSchema
  values: Filters
  onChange: (key: string, value: string) => void
}) {
  const { name, python_type, enum: isEnum, accepted_values, filter_operators: ops } = col

  if (isEnum && Array.isArray(accepted_values) && accepted_values.length > 0 && ops.includes('eq')) {
    return (
      <FilterField label={name}>
        <select
          value={values[name] ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
          className="h-9 w-full rounded-lg border border-text/15 bg-raised px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Any</option>
          {accepted_values.map((v) => (
            <option key={String(v)} value={String(v)}>
              {String(v)}
            </option>
          ))}
        </select>
      </FilterField>
    )
  }

  if (python_type === 'bool' && ops.includes('eq')) {
    return (
      <FilterField label={name}>
        <select
          value={values[name] ?? ''}
          onChange={(e) => onChange(name, e.target.value)}
          className="h-9 w-full rounded-lg border border-text/15 bg-raised px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Any</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </FilterField>
    )
  }

  if (['int', 'float', 'Decimal', 'date', 'datetime'].includes(python_type)) {
    const hasGte = ops.includes('gte') || ops.includes('gt')
    const hasLte = ops.includes('lte') || ops.includes('lt')
    if (!hasGte && !hasLte) return null
    const inputType = python_type === 'date' || python_type === 'datetime' ? 'date' : 'number'
    return (
      <FilterField label={name}>
        <div className="flex gap-2">
          {hasGte && (
            <input
              type={inputType}
              placeholder="From"
              value={values[`${name}__gte`] ?? ''}
              onChange={(e) => onChange(`${name}__gte`, e.target.value)}
              className="h-9 w-full rounded-lg border border-text/15 bg-raised px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
          {hasLte && (
            <input
              type={inputType}
              placeholder="To"
              value={values[`${name}__lte`] ?? ''}
              onChange={(e) => onChange(`${name}__lte`, e.target.value)}
              className="h-9 w-full rounded-lg border border-text/15 bg-raised px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>
      </FilterField>
    )
  }

  if (ops.includes('icontains') || ops.includes('contains') || ops.includes('eq')) {
    const op = ops.includes('icontains') ? 'icontains' : ops.includes('contains') ? 'contains' : ''
    const key = op ? `${name}__${op}` : name
    return (
      <FilterField label={name}>
        <input
          type="text"
          placeholder={op ? 'contains…' : 'equals…'}
          value={values[key] ?? ''}
          onChange={(e) => onChange(key, e.target.value)}
          className="h-9 w-full rounded-lg border border-text/15 bg-raised px-3 text-sm text-text placeholder:text-text/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </FilterField>
    )
  }

  return null
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text/50">{label}</span>
      {children}
    </div>
  )
}

// ─── Panel ───────────────────────────────────────────────────────────────────

export function FilterPanel({ model, active, onApply, onClose }: FilterPanelProps) {
  const [local, setLocal] = useState<Filters>(active)

  useEffect(() => {
    setLocal(active)
  }, [active])

  function set(key: string, value: string) {
    setLocal((prev) => {
      if (!value) {
        const next = { ...prev }
        delete next[key]
        return next
      }
      return { ...prev, [key]: value }
    })
  }

  function handleApply() {
    onApply(local)
    onClose()
  }

  function handleReset() {
    setLocal({})
  }

  const filterableColumns = model.columns.filter(
    (col) => (col.filter_operators?.length ?? 0) > 0
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-text/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-overlay shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-text/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-text">Filters</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text/40 transition-colors hover:bg-raised hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Global search */}
        <div className="border-b border-text/10 px-5 py-4">
          <Input
            label="Global search"
            placeholder="Search across all fields…"
            value={local['q'] ?? ''}
            onChange={(e) => set('q', e.target.value)}
          />
        </div>

        {/* Column filters */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4">
            {filterableColumns.map((col) => (
              <ColumnFilter key={col.name} col={col} values={local} onChange={set} />
            ))}
            {filterableColumns.length === 0 && (
              <p className="text-sm text-text/30">No filterable columns.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-text/10 px-5 py-4">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset all
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply filters
          </Button>
        </div>
      </div>
    </>
  )
}
