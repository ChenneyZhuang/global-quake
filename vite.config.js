import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
