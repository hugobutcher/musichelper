import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './styles.css'

// A new version of the app downloads in the background. Apply it the next time the app is
// hidden (you switch away or lock the phone), never while you are practising.
let updateReady = false
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateReady = true
  },
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden && updateReady) {
    updateReady = false
    void updateSW(true)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
