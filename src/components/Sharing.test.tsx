import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Planner, type SharingUI } from './Planner'
import type { Rec, Store } from '../lib/types'
import type { Share } from '../lib/sharing'
import { goal, routine, task } from '../test/fixtures'

const me = { email: 'me@example.com', name: 'Me Person', firstName: 'Me', avatarUrl: null, onSignOut: vi.fn() }

const share = (over: Partial<Share> = {}): Share => ({
  id: 's1',
  ownerId: 'sam-id',
  ownerEmail: 'sam@example.com',
  ownerName: 'Sam Rivera',
  inviteeEmail: 'me@example.com',
  status: 'pending',
  ...over,
})

function sharingUI(over: Partial<SharingUI> = {}): SharingUI {
  return {
    sent: [],
    received: [],
    error: '',
    invite: vi.fn(async () => true),
    respond: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    myEmail: me.email,
    viewing: null,
    onViewDay: vi.fn(),
    ...over,
  }
}

function store(recs: Rec[] = []): Store {
  return { loadAll: vi.fn(async () => recs), put: vi.fn(async () => {}), remove: vi.fn(async () => {}) }
}

async function renderWith(sharing: SharingUI, recs: Rec[] = []) {
  const s = store(recs)
  const user = userEvent.setup()
  render(<Planner store={s} account={me} sharing={sharing} />)
  await screen.findByRole('heading', { level: 1 })
  return { user, store: s }
}

async function openShare(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Menu/ }))
  await user.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: /Share my day/ }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 13, 15))
})
afterEach(() => vi.useRealTimers())

describe('invite notifications', () => {
  it('shows a new invite as an alert, with a dot on the menu', async () => {
    const sharing = sharingUI({ received: [share()] })
    const { user } = await renderWith(sharing)

    expect(screen.getByRole('alert')).toHaveTextContent('Sam wants to share their day with you.')
    expect(screen.getByRole('button', { name: 'Menu, 1 new invite' })).toBeInTheDocument()

    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Accept' }))
    expect(sharing.respond).toHaveBeenCalledWith('s1', true)
  })

  it('can decline an invite', async () => {
    const sharing = sharingUI({ received: [share()] })
    const { user } = await renderWith(sharing)
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'No thanks' }))
    expect(sharing.respond).toHaveBeenCalledWith('s1', false)
  })

  it('shows nothing when there are no new invites', async () => {
    await renderWith(sharingUI({ received: [share({ status: 'accepted' })] }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })
})

describe('Share my day page', () => {
  it('invites someone by email', async () => {
    const sharing = sharingUI()
    const { user } = await renderWith(sharing)
    await openShare(user)

    await user.type(screen.getByLabelText('Their email'), 'friend@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))
    expect(sharing.invite).toHaveBeenCalledWith('friend@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('Invite sent')
    expect(screen.getByLabelText('Their email')).toHaveValue('')
  })

  it('catches inviting yourself or someone already invited, without sending', async () => {
    const sharing = sharingUI({ sent: [share({ ownerId: 'me', inviteeEmail: 'friend@example.com' })] })
    const { user } = await renderWith(sharing)
    await openShare(user)

    await user.type(screen.getByLabelText('Their email'), 'ME@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))
    expect(screen.getByRole('status')).toHaveTextContent("That's you!")

    await user.clear(screen.getByLabelText('Their email'))
    await user.type(screen.getByLabelText('Their email'), 'friend@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))
    expect(screen.getByRole('status')).toHaveTextContent("You've already invited them.")
    expect(sharing.invite).not.toHaveBeenCalled()
  })

  it('lists who can see your day and lets you stop sharing', async () => {
    const sharing = sharingUI({
      sent: [
        share({ id: 'a', ownerId: 'me', inviteeEmail: 'friend@example.com', status: 'accepted' }),
        share({ id: 'b', ownerId: 'me', inviteeEmail: 'other@example.com', status: 'pending' }),
      ],
    })
    const { user } = await renderWith(sharing)
    await openShare(user)

    const list = screen.getByRole('heading', { name: 'Who can see your day' }).closest('section')!
    expect(within(list).getByText('friend@example.com').closest('li')).toHaveTextContent('Can see your day')
    expect(within(list).getByText('other@example.com').closest('li')).toHaveTextContent('Invite sent')

    await user.click(within(list).getByRole('button', { name: 'Stop sharing' }))
    expect(sharing.remove).toHaveBeenCalledWith('a')
    await user.click(within(list).getByRole('button', { name: 'Cancel' }))
    expect(sharing.remove).toHaveBeenCalledWith('b')
  })

  it('lists days shared with you, to view or remove', async () => {
    const sam = share({ status: 'accepted' })
    const sharing = sharingUI({ received: [sam] })
    const { user } = await renderWith(sharing)
    await openShare(user)

    await user.click(screen.getByRole('button', { name: 'View' }))
    expect(sharing.onViewDay).toHaveBeenCalledWith(sam)
    await user.click(screen.getByRole('button', { name: "Remove Sam's day" }))
    expect(sharing.remove).toHaveBeenCalledWith('s1')
  })

  it('the menu lists shared days to jump to', async () => {
    const sam = share({ status: 'accepted' })
    const sharing = sharingUI({ received: [sam] })
    const { user } = await renderWith(sharing)
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: /Sam's day/ }))
    expect(sharing.onViewDay).toHaveBeenCalledWith(sam)
  })
})

describe("viewing someone else's day", () => {
  const recs = [
    routine({ title: 'Soccer', days: [6], start: '10:00', end: '11:30' }),
    goal({ title: 'Piano', start: '16:00' }),
    goal({ title: 'Reading' }),
    task({ title: 'Essay' }),
  ]

  it('shows their day, view only', async () => {
    const sam = share({ status: 'accepted' })
    const sharing = sharingUI({ received: [sam], viewing: sam })
    const { user, store } = await renderWith(sharing, recs)

    expect(screen.getByText("Sam's day", { selector: '.greeting' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("Sam's day · view only")
    expect(screen.getByText('Soccer')).toBeInTheDocument()

    // Nothing to add, schedule, check off or edit.
    expect(screen.queryByRole('button', { name: /\+ Add/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Schedule/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Reading done' }))
    await user.click(screen.getByText('Piano', { selector: '.blocks .title' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store.put).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('goes back to your own day', async () => {
    const sam = share({ status: 'accepted' })
    const sharing = sharingUI({ received: [sam], viewing: sam })
    const { user } = await renderWith(sharing, recs)
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Back to my day' }))
    expect(sharing.onViewDay).toHaveBeenCalledWith(null)
  })

  it('their goals and week are view only too, and the menu has no Share my day', async () => {
    const sam = share({ status: 'accepted' })
    const { user } = await renderWith(sharingUI({ received: [sam], viewing: sam }), recs)

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('dialog', { name: 'Menu' }))
    expect(menu.queryByRole('button', { name: /Share my day/ })).not.toBeInTheDocument()
    await user.click(menu.getByRole('button', { name: /Daily goals/ }))
    expect(screen.queryByRole('button', { name: '+ Add goal' })).not.toBeInTheDocument()
    await user.click(screen.getByText('Reading'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Menu' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: /My week/ }))
    for (const input of screen.getAllByLabelText('Up at')) expect(input).toBeDisabled()
  })
})
