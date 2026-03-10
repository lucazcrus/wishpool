import type { PropsWithChildren } from 'react'
import { useAuth } from '@/lib/auth'
import { SupabaseConfigErrorScreen } from './SupabaseConfigErrorScreen'

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, isLoading, configError } = useAuth()

  if (configError) {
    return <SupabaseConfigErrorScreen message={configError} />
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center p-4">
        <p className="text-sm text-[#555]">Carregando sessão...</p>
      </div>
    )
  }

  if (!user) {
    window.location.replace('/landing.html')
    return null
  }

  return <>{children}</>
}
