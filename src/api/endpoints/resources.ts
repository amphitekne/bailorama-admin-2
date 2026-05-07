import { apiClient } from '../client'

type Row = Record<string, unknown>
type Id = string | number

export interface ListParams {
  resource: string
  limit?: number
  offset?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
  filters?: Record<string, string>
}

export interface ListResponse {
  items: Row[]
  total: number
}

export async function listResources(params: ListParams): Promise<ListResponse> {
  const { resource, limit = 25, offset = 0, orderBy = 'id', orderDir = 'asc', filters = {} } = params
  const q = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order_by: orderBy,
    order_dir: orderDir,
    ...filters,
  })
  const res = await apiClient.get<ListResponse>(`/crud/${resource}/search?${q}`)
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    total: typeof res?.total === 'number' ? res.total : 0,
  }
}

export async function getResource(resource: string, id: Id): Promise<Row> {
  return apiClient.get<Row>(`/crud/${resource}/${id}`)
}

export async function createResource(resource: string, data: Row): Promise<Row> {
  return apiClient.post<Row>(`/crud/${resource}/`, data)
}

export async function updateResource(resource: string, id: Id, data: Row): Promise<Row> {
  return apiClient.patch<Row>(`/crud/${resource}/${id}`, data)
}

export async function deleteResource(resource: string, id: Id): Promise<void> {
  await apiClient.delete(`/crud/${resource}/${id}`)
}

export async function deleteManyResources(resource: string, ids: Id[]): Promise<void> {
  if (ids.length === 0) return
  await apiClient.delete(`/crud/${resource}/batch`, { body: { ids } })
}
