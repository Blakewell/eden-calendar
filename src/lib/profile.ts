import type { User } from '@supabase/supabase-js'

// Who's signed in, from their Google profile (Supabase copies it into
// user_metadata at each sign-in).
export type Profile = {
  email: string | undefined
  name: string | null
  firstName: string | null
  avatarUrl: string | null
}

export function profileFrom(user: Pick<User, 'email' | 'user_metadata'>): Profile {
  const meta = user.user_metadata ?? {}
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const name = text(meta.full_name) ?? text(meta.name)
  return {
    email: user.email,
    name,
    firstName: text(meta.given_name) ?? name?.split(/\s+/)[0] ?? null,
    avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
  }
}
