import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'

export function profileFromAuthUser(user: User): Profile {
  const fallbackName = user.email?.split('@')[0] || 'Usuário'
  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : ''

  return {
    name: metadataName || fallbackName,
    email: user.email || '',
    preferences: {},
  }
}
