import type { SupabaseClient } from '@supabase/supabase-js'
import type { Store } from './types'
import { sharedStore } from './store'

// Sharing a day: one person invites another by email to see their day (view
// only, one-way). See supabase/migrations/*_shares.sql for the access rules.
export type ShareStatus = 'pending' | 'accepted' | 'declined'

export type Share = {
  id: string
  ownerId: string
  ownerEmail: string
  ownerName: string | null
  inviteeEmail: string
  status: ShareStatus
}

export interface Sharing {
  list(): Promise<Share[]>
  invite(email: string): Promise<void>
  respond(id: string, accept: boolean): Promise<void>
  remove(id: string): Promise<void>
  storeFor(ownerId: string): Store // their day, read-only
}

// Invites I sent, and invites sent to me.
export function splitShares(shares: Share[], myId: string): { sent: Share[]; received: Share[] } {
  return {
    sent: shares.filter((s) => s.ownerId === myId),
    received: shares.filter((s) => s.ownerId !== myId),
  }
}

// How to refer to the person who shared: their first name, else their email.
export const ownerLabel = (s: Share) => s.ownerName?.split(/\s+/)[0] ?? s.ownerEmail

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export function inviteProblem(email: string, myEmail: string | undefined, sent: Share[]): string | null {
  const e = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "That doesn't look like an email address."
  if (myEmail && e === normalizeEmail(myEmail)) return "That's you!"
  if (sent.some((s) => s.inviteeEmail === e)) return "You've already invited them."
  return null
}

type Row = {
  id: string
  owner_id: string
  owner_email: string
  owner_name: string | null
  invitee_email: string
  status: ShareStatus
}

export function supabaseSharing(db: SupabaseClient): Sharing {
  return {
    async list() {
      const { data, error } = await db
        .from('shares')
        .select('id, owner_id, owner_email, owner_name, invitee_email, status')
        .order('created_at')
      if (error) throw error
      return (data as Row[]).map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        ownerEmail: r.owner_email,
        ownerName: r.owner_name,
        inviteeEmail: r.invitee_email,
        status: r.status,
      }))
    },
    async invite(email) {
      // The database fills in who it's from; it never says whether the address can sign in.
      const { error } = await db.from('shares').insert({ invitee_email: normalizeEmail(email) })
      if (error?.code === '23505') throw new Error("You've already invited them.")
      if (error) throw error
    },
    async respond(id, accept) {
      const { error } = await db.rpc('respond_to_share', { share_id: id, accept })
      if (error) throw error
    },
    async remove(id) {
      const { error } = await db.from('shares').delete().eq('id', id)
      if (error) throw error
    },
    storeFor: (ownerId) => sharedStore(db, ownerId),
  }
}
