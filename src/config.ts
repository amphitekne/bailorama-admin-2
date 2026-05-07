// In dev: use /api so requests route through Vite's proxy (avoids CORS).
// In prod: use the full configured URL directly.
export const API_URL = import.meta.env.DEV
  ? '/api'
  : ((import.meta.env.BAILORAMA_API_URL as string | undefined) ?? '/api')
