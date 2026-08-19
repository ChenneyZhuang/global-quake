import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/service-worker.js?v=${encodeURIComponent(__APP_VERSION__)}`).catch(() => {
      // The app still works normally when service workers are unavailable.
    })
  })
}
