import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import pkg from './package.json' with { type: 'json' }

const appVersion = `${pkg.version}-${Date.now()}`

export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    host: '0.0.0.0',
    port: 8081,
    allowedHosts: ['quakenow.duckdns.org', 'chenneyyu.duckdns.org', '121.45.182.108']
  }
})
