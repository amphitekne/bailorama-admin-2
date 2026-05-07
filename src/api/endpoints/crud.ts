import { apiClient } from '../client'
import type { CrudSchemaResponse } from '../types'

export async function getCrudSchema(): Promise<CrudSchemaResponse> {
  return apiClient.get<CrudSchemaResponse>('/crud/schema')
}
