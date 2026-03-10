import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'
import './styles/landing.css'
import LandingApp from './LandingApp'
import { AuthProvider } from './lib/auth'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <LandingApp />
    </AuthProvider>
  </StrictMode>,
)
