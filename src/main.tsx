import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { isBusy } from './audio/session'
import { consumeDriveRedirect } from './songs/drive'
import './styles.css'

// Coming back from Google sign-in: store the token and open the Songs tab (before first render).
consumeDriveRedirect()

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
  // Locking the phone mid-song also hides the app: only update when nothing is playing.
  if (document.hidden && updateReady && !isBusy()) {
    updateReady = false
    void updateSW(true)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
