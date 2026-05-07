import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_BAILORAMA_API_URL ?? 'http://localhost:8180/api'

  // Extract origin from the full API URL to use as proxy target.
  // Requests to /api/* are forwarded to <origin>/api/* — no rewrite needed.
  let proxyTarget: string
  try {
    proxyTarget = new URL(apiUrl).origin
  } catch {
    proxyTarget = 'http://localhost:8180'
  }

  return {
    plugins: [react()],
    base: '/admin/',
    server: {
      host: true,
      port: 5174,
      allowedHosts: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
