import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'
import PrivacyApp from './PrivacyApp'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <PrivacyApp />
  </StrictMode>,
)
