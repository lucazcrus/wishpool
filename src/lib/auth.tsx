import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Provider, Session, User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { supabase, supabaseConfigError } from './supabase'
import { profileFromAuthUser } from './auth-profile'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  configError: string | null
  signOut: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<void>
  signInWithOAuth: (provider: Provider) => Promise<void>
  syncProfile: (profile: Profile) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function ensureProfileRow(user: User) {
  if (!supabase) return
  const profile = profileFromAuthUser(user)

  await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: profile.email,
      full_name: profile.name,
    },
    { onConflict: 'id' },
  )

  await supabase.from('user_preferences').upsert(
    {
      user_id: user.id,
      price_alert: false,
    },
    { onConflict: 'user_id' },
  )
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(!supabaseConfigError)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) {
        console.error('Failed to load session', error)
      }
      if (!mounted) return
      setSession(data.session)
      setIsLoading(false)

      if (data.session?.user) {
        try {
          await ensureProfileRow(data.session.user)
        } catch (profileError) {
          console.error('Failed to ensure profile row', profileError)
        }
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)

      if (nextSession?.user) {
        ensureProfileRow(nextSession.user).catch((profileError) => {
          console.error('Failed to ensure profile row', profileError)
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
          },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      })
      if (error) throw error
    },
    [],
  )

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
    const response = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })

    if (response.error) {
      throw response.error
    }
  }, [])

  const syncProfile = useCallback(
    async (profile: Profile) => {
      if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
      if (!session?.user) return

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          name: profile.name,
        },
      })
      if (authError) throw authError

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: session.user.id,
          email: profile.email,
          full_name: profile.name,
        },
        { onConflict: 'id' },
      )
      if (profileError) throw profileError

      const { error: preferencesError } = await supabase.from('user_preferences').upsert(
        {
          user_id: session.user.id,
          price_alert: profile.preferences.priceAlert,
        },
        { onConflict: 'user_id' },
      )
      if (preferencesError) throw preferencesError
    },
    [session?.user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      configError: supabaseConfigError,
      signOut,
      signInWithPassword,
      signUpWithPassword,
      signInWithOAuth,
      syncProfile,
    }),
    [
      isLoading,
      session,
      signInWithOAuth,
      signInWithPassword,
      signOut,
      signUpWithPassword,
      syncProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

export function useRequiredUser() {
  const { user } = useAuth()
  if (!user) {
    throw new Error('No authenticated user')
  }
  return user
}
