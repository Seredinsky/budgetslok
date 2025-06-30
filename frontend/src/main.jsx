import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register service worker for PWA
registerSW({
  onNeedRefresh() {
    // TODO: notify user of new version
  },
  onOfflineReady() {
    // TODO: notify user that app is ready for offline use
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="h-full">
      <App />
    </div>
  </StrictMode>,
)
