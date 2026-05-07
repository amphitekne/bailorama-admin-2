import { API_URL } from '../config'
import { getAccessToken, clearAccessToken } from '../auth/tokenStorage'
import { refresh } from './endpoints/auth'
import type { HttpMethod, RequestConfig } from './types'

const baseUrl = API_URL.replace(/\/$/, '')

function buildUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${p}`
}

export async function request<T = unknown>(
  method: HttpMethod,
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const url = buildUrl(path)
  const token = getAccessToken()
  const headers = new Headers(config.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const isFormData = config.body instanceof FormData
  const body =
    config.body === undefined
      ? undefined
      : isFormData
        ? (config.body as BodyInit)
        : typeof config.body === 'string'
          ? config.body
          : JSON.stringify(config.body)
  if (isFormData) {
    headers.delete('Content-Type')
  } else if (body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }
  const init: RequestInit = { ...config, method, headers, body }

  let response = await fetch(url, init)

  if (response.status === 401) {
    try {
      await refresh()
      const newToken = getAccessToken()
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`)
        init.headers = headers
        response = await fetch(url, init)
      }
    } catch {
      clearAccessToken()
      throw new Error('Session expired')
    }
  }

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string }
    throw new Error(err.detail ?? `Request failed: ${response.status}`)
  }

  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
  return undefined as unknown as T
}

export const apiClient = {
  get: <T = unknown>(path: string, config?: RequestConfig) =>
    request<T>('GET', path, config ?? {}),
  post: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>('POST', path, { ...config, body }),
  put: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>('PUT', path, { ...config, body }),
  patch: <T = unknown>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>('PATCH', path, { ...config, body }),
  delete: <T = unknown>(path: string, config?: RequestConfig) =>
    request<T>('DELETE', path, config ?? {}),
}
