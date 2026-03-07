import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'
import App from './App'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AuthProvider>
      <RequireAuth>
        <App />
      </RequireAuth>
    </AuthProvider>
  </StrictMode>,
)
