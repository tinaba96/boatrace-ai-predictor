import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import './styles/design-tokens.css'
import './index.css'
import './i18n'
import AppRouter from './AppRouter.jsx'
import { initTrackingIfConsented } from './utils/analytics'

// 同意済みの場合のみGA+AdSenseを初期化
initTrackingIfConsented();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
