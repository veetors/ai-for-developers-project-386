import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'node:http'
import path from 'node:path'

const apiProxyConfig = {
  target: process.env.API_PROXY_TARGET ?? 'http://localhost:4010',
  changeOrigin: true,
  // Disable keep-alive on the upstream socket so the proxy handles
  // `Connection: close` from the backend with a single-pass read; avoids
  // 'Data after Connection: close' parser errors when many short requests
  // hit the same upstream within one proxy session.
  agent: new http.Agent({ keepAlive: false }),
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': apiProxyConfig,
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
    proxy: {
      '/api': apiProxyConfig,
    },
  },
  build: {
    sourcemap: true,
  },
})
