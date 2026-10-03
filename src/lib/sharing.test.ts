import { describe, expect, it } from 'vitest'
import { inviteProblem, ownerLabel, splitShares, type Share } from './sharing'

const share = (over: Partial<Share> = {}): Share => ({
  id: 's1',
  ownerId: 'me',
  ownerEmail: 'me@example.com',
  ownerName: 'Me Person',
  inviteeEmail: 'friend@example.com',
  status: 'pending',
  ...over,
})

describe('sharing', () => {
  it('splits invites into ones I sent and ones sent to me', () => {
    const mine = share()
    const theirs = share({ id: 's2', ownerId: 'sam', inviteeEmail: 'me@example.com' })
    expect(splitShares([mine, theirs], 'me')).toEqual({ sent: [mine], received: [theirs] })
  })

  it('names the sharer by first name, or email when there is no name', () => {
    expect(ownerLabel(share({ ownerName: 'Sam Rivera' }))).toBe('Sam')
    expect(ownerLabel(share({ ownerName: null }))).toBe('me@example.com')
  })

  it('checks an invite before sending it', () => {
    const sent = [share({ inviteeEmail: 'friend@example.com' })]
    expect(inviteProblem('new@example.com', 'me@example.com', sent)).toBeNull()
    expect(inviteProblem('not an email', 'me@example.com', sent)).toMatch(/doesn't look like/)
    expect(inviteProblem(' Me@Example.com ', 'me@example.com', sent)).toBe("That's you!")
    expect(inviteProblem('FRIEND@example.com', 'me@example.com', sent)).toBe("You've already invited them.")
  })
})
