import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// Manually register service worker from the site root so it controls '/' URLs
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="h-full">
      <App />
    </div>
  </StrictMode>,
)
