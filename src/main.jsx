import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import './lib/posthog.js'

// A deploy renames every hashed chunk, so a tab left open across a deploy asks
// for a dynamic-import chunk the new build already deleted. Vite fires
// `vite:preloadError` when that import 404s; reload once (guarded so a genuinely
// broken build cannot loop) to pull the current chunk manifest.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('vite-preload-reloaded')) return;
  sessionStorage.setItem('vite-preload-reloaded', '1');
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
