export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface ApiErrorDetail {
  msg?: string
  type?: string
  loc?: unknown
}

export type ApiErrorBody = {
  detail?: string | ApiErrorDetail[]
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestConfig extends Omit<RequestInit, 'method' | 'body'> {
  body?: unknown
}

export interface CrudColumnSchema {
  name: string
  python_type: string
  sqlalchemy_type: string
  nullable: boolean
  primary_key: boolean
  has_default: boolean
  filter_operators: string[]
  sortable: boolean
  enum: boolean
  accepted_values: unknown[] | null
  enum_class: string | null
}

export interface CrudModelSchema {
  model: string
  table: string
  filter_naming_convention: string
  default_operator: string
  columns: CrudColumnSchema[]
}

export type CrudSchemaResponse = CrudModelSchema[]
