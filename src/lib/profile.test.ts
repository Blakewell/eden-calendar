import { describe, expect, it } from 'vitest'
import { profileFrom } from './profile'

describe('profileFrom', () => {
  it('reads name, first name and photo from a Google profile', () => {
    expect(
      profileFrom({
        email: 'someone@example.com',
        user_metadata: { full_name: 'Sam Rivera', avatar_url: 'https://example.com/a.png' },
      }),
    ).toEqual({
      email: 'someone@example.com',
      name: 'Sam Rivera',
      firstName: 'Sam',
      avatarUrl: 'https://example.com/a.png',
    })
  })

  it('prefers given_name and falls back to name and picture', () => {
    expect(
      profileFrom({
        email: 'x@example.com',
        user_metadata: { given_name: 'Jo', name: 'Jo Ann Lee', picture: 'p.png' },
      }),
    ).toMatchObject({ name: 'Jo Ann Lee', firstName: 'Jo', avatarUrl: 'p.png' })
  })

  it('copes with no profile at all', () => {
    expect(profileFrom({ email: 'x@example.com', user_metadata: {} })).toMatchObject({
      name: null,
      firstName: null,
      avatarUrl: null,
    })
  })
})
