import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/profile.css'
import ProfileApp from './ProfileApp'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <RequireAuth>
        <ProfileApp />
      </RequireAuth>
    </AuthProvider>
  </StrictMode>,
)
