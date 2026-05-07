import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, SlidersHorizontal, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useModelByTable, useSchema } from '../../context/SchemaContext'
import { listResources, deleteResource, deleteManyResources } from '../../api/endpoints/resources'
import type { CrudColumnSchema } from '../../api/types'
import { Alert } from '../../components/ui/Alert'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox } from '../../components/ui/Checkbox'
import { Spinner } from '../../components/ui/Spinner'
import { FilterPanel } from './FilterPanel'

// ─── Utils ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>
type Filters = Record<string, string>

const PAGE_SIZE = 25

function toLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function modelLabel(model: string) {
  return model.replace(/ORM$/i, '').replace(/([A-Z])/g, ' $1').trim()
}

function CellValue({ value, col }: { value: unknown; col: CrudColumnSchema }) {
  if (value === null || value === undefined) {
    return <span className="text-text/25">—</span>
  }
  if (col.enum) {
    return <Badge variant="default">{String(value)}</Badge>
  }
  if (col.python_type === 'bool') {
    return value ? (
      <span className="font-medium text-emerald-500">Yes</span>
    ) : (
      <span className="text-text/30">No</span>
    )
  }
  if (col.python_type === 'datetime') {
    const d = new Date(String(value))
    if (!isNaN(d.getTime())) return <span className="tabular-nums">{d.toLocaleString()}</span>
  }
  if (col.python_type === 'date') {
    const d = new Date(String(value))
    if (!isNaN(d.getTime())) return <span className="tabular-nums">{d.toLocaleDateString()}</span>
  }
  const str = String(value)
  if (str.length > 60) {
    return (
      <span className="block max-w-xs truncate" title={str}>
        {str}
      </span>
    )
  }
  return <span>{str}</span>
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function ResourceListPage() {
  const { table = '' } = useParams<{ table: string }>()
  const navigate = useNavigate()
  const schemaState = useSchema()
  const model = useModelByTable(table)

  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [sorting, setSorting] = useState<SortingState>([])
  const [filters, setFilters] = useState<Filters>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showFilters, setShowFilters] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeFiltersCount = Object.keys(filters).length

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sort = sorting[0]
      const res = await listResources({
        resource: table,
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
        orderBy: sort?.id ?? 'id',
        orderDir: sort?.desc ? 'desc' : 'asc',
        filters,
      })
      setRows(res.items)
      setTotal(res.total)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [table, pageIndex, sorting, filters])

  useEffect(() => {
    if (model) void fetchRows()
  }, [model, fetchRows])

  // Reset page when filter/sort changes
  useEffect(() => {
    setPageIndex(0)
  }, [filters, sorting, table])

  useEffect(() => {
    setRowSelection({})
    setPageIndex(0)
    setFilters({})
    setSorting([])
  }, [table])

  const columnHelper = createColumnHelper<Row>()

  const columns = useMemo(() => {
    if (!model) return []

    return [
      columnHelper.display({
        id: '_select',
        header: ({ table: t }) => (
          <Checkbox
            checked={t.getIsAllPageRowsSelected()}
            indeterminate={t.getIsSomePageRowsSelected()}
            onChange={t.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
      }),
      ...model.columns.map((col) =>
        columnHelper.accessor(col.name, {
          header: toLabel(col.name),
          cell: (info) => <CellValue value={info.getValue()} col={col} />,
          enableSorting: col.sortable,
          size: col.primary_key ? 60 : 160,
        })
      ),
      columnHelper.display({
        id: '_actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Link
              to={`/resources/${table}/${String(row.original['id'] ?? '')}`}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-text/50 transition-colors hover:bg-overlay hover:text-text"
            >
              Edit
            </Link>
            <button
              onClick={() => void handleDeleteOne(row.original['id'])}
              className="rounded-md p-1.5 text-text/30 transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ),
        size: 100,
      }),
    ]
  }, [model, table]) // eslint-disable-line react-hooks/exhaustive-deps

  const table2 = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil(total / PAGE_SIZE),
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => String(row['id'] ?? Math.random()),
  })

  async function handleDeleteOne(id: unknown) {
    if (!confirm(`Delete record ${String(id)}?`)) return
    try {
      await deleteResource(table, id as string | number)
      void fetchRows()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function handleBulkDelete() {
    const ids = Object.keys(rowSelection)
    if (!confirm(`Delete ${ids.length} record(s)?`)) return
    setDeleting(true)
    try {
      await deleteManyResources(table, ids)
      setRowSelection({})
      void fetchRows()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Bulk delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────

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

  const selectedIds = Object.keys(rowSelection)
  const pageCount = Math.ceil(total / PAGE_SIZE)
  const from = pageIndex * PAGE_SIZE + 1
  const to = Math.min((pageIndex + 1) * PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-text">{modelLabel(model.model)}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              activeFiltersCount > 0
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'border-text/15 text-text/50 hover:bg-raised hover:text-text'
            }`}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <Link to={`/resources/${table}/create`}>
            <Button size="sm">
              <Plus className="size-3.5" />
              New
            </Button>
          </Link>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5">
          <span className="text-sm font-medium text-text">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            loading={deleting}
            onClick={() => void handleBulkDelete()}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <button
            className="ml-auto text-sm text-text/40 hover:text-text"
            onClick={() => setRowSelection({})}
          >
            Clear
          </button>
        </div>
      )}

      {error && <Alert variant="critical">{error}</Alert>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-text/10">
        <table className="w-full text-sm">
          <thead>
            {table2.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-text/10 bg-raised">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className={`px-3 py-2.5 text-left ${canSort ? 'cursor-pointer select-none hover:bg-overlay' : ''}`}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-text/40">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {canSort && (
                          <span className="text-text/25">
                            {sorted === 'asc' ? (
                              <ChevronUp className="size-3" />
                            ) : sorted === 'desc' ? (
                              <ChevronDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex items-center justify-center gap-2 text-text/30">
                    <Spinner size="sm" />
                    <span className="text-sm">Loading…</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center text-sm text-text/30">
                  No records found.
                </td>
              </tr>
            ) : (
              table2.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-text/5 transition-colors hover:bg-raised"
                  onClick={() => void navigate(`/resources/${table}/${String(row.original['id'] ?? '')}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-3 py-2.5 text-text/70"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-text/30">
            {from}–{to} of {total} records
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPageIndex((p) => p - 1)}
              disabled={pageIndex === 0}
              className="rounded-lg p-2 text-text/40 transition-colors hover:bg-raised hover:text-text disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-12 text-center text-xs font-medium text-text/50">
              {pageIndex + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={pageIndex >= pageCount - 1}
              className="rounded-lg p-2 text-text/40 transition-colors hover:bg-raised hover:text-text disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter drawer */}
      {showFilters && (
        <FilterPanel
          model={model}
          active={filters}
          onApply={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  )
}
