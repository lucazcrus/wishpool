import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { EmailOtpType, Provider, Session, User } from '@supabase/supabase-js'
import type { Profile } from './types'
import { supabase, supabaseConfigError } from './supabase'
import { profileFromAuthUser } from './auth-profile'
import { getAppUrl } from './app-url'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  configError: string | null
  signOut: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>
  signInWithOAuth: (provider: Provider) => Promise<void>
  syncProfile: (profile: Profile) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapAuthError(error: unknown) {
  if (!(error instanceof Error)) {
    return new Error('Não foi possível autenticar.')
  }

  const message = error.message.trim()

  if (message === 'Error sending confirmation email') {
    return new Error(
      'Não foi possível enviar o email de confirmação. Revise a configuração de SMTP/remetente no Supabase e na Resend.',
    )
  }

  return error
}

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

function normalizeAuthType(type: string | null): EmailOtpType | null {
  if (!type) return null

  const allowedTypes: EmailOtpType[] = [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ]

  return allowedTypes.includes(type as EmailOtpType) ? (type as EmailOtpType) : null
}

function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href)
  const keysToRemove = ['code', 'token_hash', 'type', 'next', 'error', 'error_code', 'error_description']
  let changed = false

  for (const key of keysToRemove) {
    if (!url.searchParams.has(key)) continue
    url.searchParams.delete(key)
    changed = true
  }

  const hash = url.hash.replace(/^#/, '')
  if (hash) {
    const hashParams = new URLSearchParams(hash)
    const hashKeysToRemove = ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'type']

    for (const key of hashKeysToRemove) {
      if (!hashParams.has(key)) continue
      hashParams.delete(key)
      changed = true
    }

    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : ''
  }

  if (changed) {
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
  }
}

async function handleAuthRedirect() {
  if (!supabase) return

  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = normalizeAuthType(url.searchParams.get('type'))

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw mapAuthError(error)
    clearAuthParamsFromUrl()
    return
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) throw mapAuthError(error)
    clearAuthParamsFromUrl()
  }
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

    ;(async () => {
      try {
        await handleAuthRedirect()
      } catch (authRedirectError) {
        console.error('Failed to process auth redirect', authRedirectError)
      }

      const { data, error } = await supabase.auth.getSession()
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
    })()

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
    if (error) throw mapAuthError(error)
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw mapAuthError(error)
  }, [])

  const signUpWithPassword = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
      const redirectTo = getAppUrl()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            name: fullName,
          },
          emailRedirectTo: redirectTo,
        },
      })
      if (error) throw mapAuthError(error)

      const requiresEmailConfirmation = !data.session
      return { requiresEmailConfirmation }
    },
    [],
  )

  const signInWithOAuth = useCallback(async (provider: Provider) => {
    if (!supabase) throw new Error(supabaseConfigError || 'Supabase client not configured')
    const response = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getAppUrl(),
      },
    })

    if (response.error) {
      throw mapAuthError(response.error)
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
      if (authError) throw mapAuthError(authError)

      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: session.user.id,
          email: profile.email,
          full_name: profile.name,
        },
        { onConflict: 'id' },
      )
      if (profileError) throw mapAuthError(profileError)

      const { error: preferencesError } = await supabase.from('user_preferences').upsert(
        {
          user_id: session.user.id,
          price_alert: profile.preferences.priceAlert,
        },
        { onConflict: 'user_id' },
      )
      if (preferencesError) throw mapAuthError(preferencesError)
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
