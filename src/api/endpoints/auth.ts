import { API_URL } from '../../config'
import { setAccessToken, clearAccessToken } from '../../auth/tokenStorage'
import type { TokenResponse } from '../types'

export interface LoginCredentials {
  username: string
  password: string
}

export async function login(credentials: LoginCredentials): Promise<TokenResponse> {
  const body = new URLSearchParams({
    username: credentials.username ?? '',
    password: credentials.password ?? '',
  }).toString()

  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      detail?: string | { msg?: string }[]
    }
    const detail = error.detail
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e) => e.msg).filter(Boolean).join(', ') || 'Invalid username or password'
          : 'Invalid username or password'
    throw new Error(message)
  }

  const data = (await response.json()) as TokenResponse
  setAccessToken(data.access_token)
  return data
}

export async function refresh(): Promise<TokenResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    clearAccessToken()
    throw new Error('Session expired')
  }

  const data = (await response.json()) as TokenResponse
  setAccessToken(data.access_token)
  return data
}
