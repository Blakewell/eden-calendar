import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Planner } from './Planner'
import type { Rec, Store } from '../lib/types'
import { FRI, MON, SAT, fun, goal, routine, task } from '../test/fixtures'

// An in-memory store we can inspect.
function memoryStore(initial: Rec[] = []) {
  let recs = [...initial]
  const store: Store = {
    loadAll: vi.fn(async () => [...recs]),
    put: vi.fn(async (rec: Rec) => {
      recs = [...recs.filter((r) => r.id !== rec.id), rec]
    }),
    remove: vi.fn(async (id: string) => {
      recs = recs.filter((r) => r.id !== id)
    }),
  }
  return { store, all: () => recs }
}

async function renderPlanner(initial: Rec[] = []) {
  const mem = memoryStore(initial)
  const user = userEvent.setup()
  render(<Planner store={mem.store} footer="test" />)
  await screen.findByRole('heading', { level: 1 })
  return { ...mem, user }
}

beforeEach(() => {
  // Saturday, Oct 3 2026 at 1:15 PM.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 13, 15))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Planner day view', () => {
  it('greets Eden and shows an empty, free day', async () => {
    await renderPlanner()
    expect(screen.getByText(/Good afternoon, Eden/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Saturday' })).toBeInTheDocument()
    expect(screen.getByText('Nothing left to fit in. Enjoy it.')).toBeInTheDocument()
  })

  it('shows only what applies today, with color by kind', async () => {
    await renderPlanner([
      routine({ title: 'School', days: [1, 2, 3, 4, 5] }),
      routine({ title: 'Soccer game', days: [6], start: '10:00', end: '11:30' }),
      goal({ title: 'Reading', days: [0, 1, 2, 3, 4, 5, 6] }),
      goal({ title: 'Clarinet', days: [1, 2, 3, 4, 5] }),
      task({ title: 'Lab write-up', date: SAT }),
      task({ title: 'History notes', date: MON }),
      fun({ title: "Maya's house", start: '14:00', end: '17:00' }),
      fun({ title: 'Movie night?' }),
    ])

    expect(screen.getByText('Soccer game').closest('.card')).toHaveClass('kind-routine')
    expect(screen.getByText("Maya's house").closest('.card')).toHaveClass('kind-fun')
    expect(screen.getByText('Reading').closest('.card')).toHaveClass('kind-goal')
    expect(screen.getByText('Lab write-up').closest('.card')).toHaveClass('kind-task')
    expect(screen.getByText('Movie night?')).toBeInTheDocument()

    expect(screen.queryByText('School')).not.toBeInTheDocument()
    expect(screen.queryByText('Clarinet')).not.toBeInTheDocument()
    expect(screen.queryByText('History notes')).not.toBeInTheDocument()
  })

  it('marks the block happening now', async () => {
    await renderPlanner([fun({ title: "Maya's house", start: '13:00', end: '17:00' })])
    expect(screen.getByText("Maya's house").closest('.card')).toHaveClass('now')
    expect(screen.getByText('now')).toBeInTheDocument()
  })

  it('carries an unfinished assignment from earlier to today', async () => {
    await renderPlanner([task({ title: 'Math worksheet', date: FRI })])
    expect(screen.getByText(/from earlier/)).toBeInTheDocument()
  })

  it('adds up time to fit in against free time', async () => {
    await renderPlanner([goal({ minutes: 30 }), task({ minutes: 60 })])
    expect(screen.getByText('1h 30m')).toBeInTheDocument()
    expect(screen.getByText(/to fit in/)).toBeInTheDocument()
    expect(screen.getByText(/Fits, with/)).toBeInTheDocument()
  })

  it('warns gently when there is more to do than free time', async () => {
    await renderPlanner([
      routine({ title: 'All day', days: [6], start: '09:00', end: '22:00' }),
      task({ minutes: 120 }),
    ])
    expect(screen.getByText(/more than your free time/)).toBeInTheDocument()
  })

  it('moves between days', async () => {
    const { user } = await renderPlanner([routine({ title: 'School' })])
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeInTheDocument()
    expect(screen.getByText('School')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Today' }))
    expect(screen.getByRole('heading', { name: 'Saturday' })).toBeInTheDocument()
  })
})

describe('checking things off', () => {
  it('checks a goal off for today only, and can undo it', async () => {
    const reading = goal({ title: 'Reading' })
    const { user, all } = await renderPlanner([reading])
    const box = screen.getByRole('checkbox', { name: 'Reading done' })

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(all()).toContainEqual(expect.objectContaining({ kind: 'check', goal: reading.id, date: SAT }))

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'false')
    expect(all().some((r) => r.kind === 'check')).toBe(false)
  })

  it('finishes an assignment on the day it is checked', async () => {
    const { user, all } = await renderPlanner([task({ title: 'Lab', date: FRI })])
    await user.click(screen.getByRole('checkbox', { name: 'Lab done' }))
    expect(all()[0]).toMatchObject({ kind: 'task', doneOn: SAT })
  })
})

describe('adding and editing', () => {
  it('adds a weekday goal with the stepper and presets', async () => {
    const { user, all } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: /Daily goal/ }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), 'Duolingo')
    await user.click(within(dialog).getByRole('button', { name: '5 minutes less' }))
    await user.click(within(dialog).getByRole('button', { name: 'Weekdays' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(all()).toHaveLength(1))
    expect(all()[0]).toMatchObject({ kind: 'goal', title: 'Duolingo', minutes: 25, days: [1, 2, 3, 4, 5] })
    // Saturday: a weekday goal shouldn't show.
    expect(screen.queryByText('Duolingo')).not.toBeInTheDocument()
  })

  it('adds an assignment planned for today with a due date', async () => {
    const { user, all } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: /Assignment/ }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), 'Essay draft')
    await user.click(within(dialog).getByRole('button', { name: '15 minutes more' }))
    await user.type(within(dialog).getByLabelText(/Due/), MON)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Essay draft')).toBeInTheDocument()
    expect(all()[0]).toMatchObject({ kind: 'task', minutes: 60, date: SAT, due: MON, doneOn: null })
    expect(screen.getByText(/due Mon/)).toBeInTheDocument()
  })

  it('adds a "sometime" fun plan that shows under Maybe today', async () => {
    const { user } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: /Fun/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), "Friend's house")
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Maybe today' })).toBeInTheDocument()
    expect(screen.getByText("Friend's house")).toBeInTheDocument()
  })

  it('edits and removes an existing item', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Reading', minutes: 30 })])
    await user.click(screen.getByText('Reading'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('What')).toHaveValue('Reading')

    await user.click(within(dialog).getByRole('button', { name: '5 minutes more' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(all()[0]).toMatchObject({ minutes: 35 }))

    await user.click(screen.getByText('Reading'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(all()).toEqual([]))
  })

  it('removing a goal also removes its check-offs', async () => {
    const reading = goal({ title: 'Reading' })
    const { user, all } = await renderPlanner([reading])
    await user.click(screen.getByRole('checkbox', { name: 'Reading done' }))
    await user.click(screen.getByText('Reading'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(all()).toEqual([]))
  })

  it('does not save without a title', async () => {
    const { user, store } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: '+ Add' }))
    await user.click(screen.getByRole('button', { name: /Assignment/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(store.put).not.toHaveBeenCalled()
  })
})

describe('My week', () => {
  it('lists repeating routines and goals, and saves awake hours', async () => {
    const { user, all } = await renderPlanner([
      routine({ title: 'School' }),
      goal({ title: 'Clarinet', days: [1, 2, 3, 4, 5], until: '2026-12-18' }),
    ])
    await user.click(screen.getByRole('button', { name: 'My week' }))

    expect(screen.getByText('Weekdays · 7:45 AM – 3:00 PM')).toBeInTheDocument()
    expect(screen.getByText(/Clarinet/)).toBeInTheDocument()
    expect(screen.getByText(/Dec 18/)).toBeInTheDocument()

    const upAt = screen.getAllByLabelText('Up at')
    // Time inputs don't accept typed text reliably in jsdom; set the value directly.
    fireEvent.change(upAt[1], { target: { value: '10:00' } })
    await waitFor(() => expect(all().find((r) => r.kind === 'settings')).toMatchObject({ weekendStart: '10:00' }))
  })
})

describe('errors', () => {
  it('shows a calm message if loading fails', async () => {
    const store: Store = {
      loadAll: vi.fn(async () => {
        throw new Error('Offline')
      }),
      put: vi.fn(),
      remove: vi.fn(),
    }
    render(<Planner store={store} footer="test" />)
    expect(await screen.findByText('Offline')).toBeInTheDocument()
  })
})
