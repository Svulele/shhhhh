import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './pwa'
import { buildInfo } from './buildInfo'
import { installMobileUX } from './mobileUX'
import './mobile.css'
import './compact.css'
import './performance.css'

async function start() {
if (new URLSearchParams(location.search).get('debug') === 'perf' && typeof WeakRef !== 'undefined') (await import('./perfDebug')).installPerfDebug()
console.info(`[Shhhhh build] ${buildInfo.shortHash} · ${buildInfo.builtAt}`, buildInfo)
installMobileUX()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

}
void start()
