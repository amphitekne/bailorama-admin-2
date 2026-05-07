import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useModelByTable, useSchema } from '../../context/SchemaContext'
import { getResource, createResource, updateResource } from '../../api/endpoints/resources'
import type { CrudColumnSchema } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'

type Row = Record<string, unknown>

function modelLabel(model: string) {
  return model.replace(/ORM$/i, '').replace(/([A-Z])/g, ' $1').trim()
}

// ─── Field renderer ───────────────────────────────────────────────────────────

function FormField({
  col,
  value,
  onChange,
  disabled,
  mode,
}: {
  col: CrudColumnSchema
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
  mode: 'create' | 'edit'
}) {
  const isDisabled = disabled || (mode === 'edit' && col.primary_key)
  const isRequired = !col.nullable && !col.has_default && !col.primary_key
  const strVal = value === null || value === undefined ? '' : String(value)

  // Enum → Select
  if (col.enum && Array.isArray(col.accepted_values) && col.accepted_values.length > 0) {
    return (
      <Select
        label={col.name}
        value={strVal}
        onChange={(e) => onChange(e.target.value || null)}
        options={col.accepted_values.map((v) => ({ value: String(v), label: String(v) }))}
        placeholder={col.nullable ? '(none)' : undefined}
        disabled={isDisabled}
      />
    )
  }

  // Boolean → native checkbox row
  if (col.python_type === 'bool') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-text">{col.name}</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isDisabled}
            className="size-4 rounded border-text/30 accent-primary"
          />
          <span className="text-sm text-text/60">{Boolean(value) ? 'True' : 'False'}</span>
        </label>
      </div>
    )
  }

  // Datetime / date
  if (col.python_type === 'datetime' || col.python_type === 'date') {
    const type = col.python_type === 'datetime' ? 'datetime-local' : 'date'
    // Normalize ISO datetime for datetime-local input (strip seconds+Z)
    let inputVal = strVal
    if (col.python_type === 'datetime' && strVal) {
      inputVal = strVal.replace('Z', '').replace(' ', 'T').slice(0, 16)
    }
    return (
      <Input
        label={col.name}
        type={type}
        value={inputVal}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={isDisabled}
        required={isRequired}
      />
    )
  }

  // Int / Float → number
  if (col.python_type === 'int' || col.python_type === 'float') {
    return (
      <Input
        label={col.name}
        type="number"
        step={col.python_type === 'float' ? 'any' : '1'}
        value={strVal}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        disabled={isDisabled}
        required={isRequired}
      />
    )
  }

  // List → textarea (JSON)
  if (col.python_type === 'list') {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text">
          {col.name}
          <span className="ml-2 text-[10px] font-normal text-text/30">JSON array</span>
        </label>
        <textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={isDisabled}
          rows={3}
          placeholder='["value1", "value2"]'
          className="w-full rounded-lg border border-text/15 bg-raised px-3.5 py-2.5 font-mono text-sm text-text
            placeholder:text-text/25 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20
            disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    )
  }

  // Default → text
  return (
    <Input
      label={col.name}
      type="text"
      value={strVal}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={isDisabled}
      required={isRequired}
    />
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ResourceFormPage() {
  const { table = '', id } = useParams<{ table: string; id?: string }>()
  const navigate = useNavigate()
  const schemaState = useSchema()
  const model = useModelByTable(table)
  const isEdit = Boolean(id)

  const [formData, setFormData] = useState<Row>({})
  const [fetching, setFetching] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch existing record on edit
  useEffect(() => {
    if (!isEdit || !id) return
    setFetching(true)
    getResource(table, id)
      .then((data) => setFormData(data))
      .catch((e: unknown) => setFetchError(e instanceof Error ? e.message : 'Failed to load record'))
      .finally(() => setFetching(false))
  }, [table, id, isEdit])

  // Reset on table change
  useEffect(() => {
    setFormData({})
    setError(null)
    setFetchError(null)
  }, [table])

  function setField(name: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit && id) {
        await updateResource(table, id, formData)
      } else {
        await createResource(table, formData)
      }
      void navigate(`/resources/${table}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (schemaState.status === 'loading') {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (schemaState.status === 'error') {
    return <Alert variant="critical">{schemaState.error}</Alert>
  }

  if (!model) {
    return <Alert variant="critical">Resource "{table}" not found in schema.</Alert>
  }

  if (fetching) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner size="lg" />
          <p className="text-sm text-text/30">Loading record…</p>
        </div>
      </div>
    )
  }

  if (fetchError) {
    return <Alert variant="critical">{fetchError}</Alert>
  }

  const label = modelLabel(model.model)
  const visibleColumns = isEdit
    ? model.columns
    : model.columns.filter((c) => !(c.primary_key && c.has_default))

  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <Link
        to={`/resources/${table}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text/40 transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Back to {label}
      </Link>

      {/* Form card */}
      <div className="rounded-xl border border-text/10 bg-raised p-6">
        <h1 className="mb-6 text-base font-semibold text-text">
          {isEdit ? `Edit ${label} #${id}` : `New ${label}`}
        </h1>

        {error && (
          <div className="mb-5">
            <Alert variant="critical">{error}</Alert>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {/* Fields in two-column grid for wider screens */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visibleColumns.map((col) => (
              <div
                key={col.name}
                className={
                  col.python_type === 'list' ||
                  (col.python_type === 'str' && col.name.toLowerCase().includes('description'))
                    ? 'sm:col-span-2'
                    : ''
                }
              >
                <FormField
                  col={col}
                  value={formData[col.name]}
                  onChange={(v) => setField(col.name, v)}
                  mode={isEdit ? 'edit' : 'create'}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-3 border-t border-text/10 pt-4">
            <Link to={`/resources/${table}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              {isEdit ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
