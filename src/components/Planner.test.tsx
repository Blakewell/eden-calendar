import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Planner } from './Planner'
import type { Account } from './Menu'
import type { Rec, Store } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
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

const sam = {
  email: 'sam@example.com',
  name: 'Sam Rivera',
  firstName: 'Sam',
  avatarUrl: 'https://example.com/sam.png',
}

async function renderPlanner(initial: Rec[] = [], account?: Account) {
  const mem = memoryStore(initial)
  const user = userEvent.setup()
  render(<Planner store={mem.store} account={account} />)
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
  it('greets without a name in local mode and shows an empty, free day', async () => {
    await renderPlanner()
    expect(screen.getByText('Good afternoon')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Saturday' })).toBeInTheDocument()
    expect(screen.getByText('Nothing left to fit in. Enjoy it.')).toBeInTheDocument()
  })

  it('shows how long until bedtime today, and not on other days', async () => {
    const { user } = await renderPlanner()
    // It's 1:15 PM on Saturday; weekend bedtime is 10:30 PM.
    const summary = screen.getByRole('region', { name: 'Time today' })
    expect(summary).toHaveTextContent('9h 15m until bedtime (10:30 PM)')
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByRole('region', { name: 'Time today' })).not.toHaveTextContent('until bedtime')
  })

  it('counts to midnight when no bedtime is set', async () => {
    await renderPlanner([{ ...DEFAULT_SETTINGS, weekendEnd: '' }])
    expect(screen.getByRole('region', { name: 'Time today' })).toHaveTextContent('10h 45m until bedtime (midnight)')
  })

  it('shows only what applies today, with color by kind', async () => {
    const { user } = await renderPlanner([
      routine({ title: 'School', days: [1, 2, 3, 4, 5] }),
      routine({ title: 'Soccer game', days: [6], start: '10:00', end: '11:30' }),
      goal({ title: 'Reading', days: [0, 1, 2, 3, 4, 5, 6] }),
      goal({ title: 'Clarinet', days: [1, 2, 3, 4, 5] }),
      task({ title: 'Lab write-up', date: SAT }),
      task({ title: 'History notes', date: MON }),
      fun({ title: "Maya's house", start: '14:00', end: '17:00' }),
      fun({ title: 'Movie night?' }),
    ])

    // The calendar has the timed things.
    expect(screen.getByText('Soccer game').closest('.card')).toHaveClass('kind-routine')
    expect(screen.getByText("Maya's house").closest('.card')).toHaveClass('kind-fun')
    expect(screen.queryByText('School')).not.toBeInTheDocument()

    // To do has the things to check off.
    await openPage(user, /To do/)
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

  it('carries an unfinished task from earlier to today', async () => {
    const { user } = await renderPlanner([task({ title: 'Math worksheet', date: FRI })])
    await openPage(user, /To do/)
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
    await openPage(user, /To do/)
    const box = screen.getByRole('checkbox', { name: 'Reading done' })

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(all()).toContainEqual(expect.objectContaining({ kind: 'check', goal: reading.id, date: SAT }))

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'false')
    expect(all().some((r) => r.kind === 'check')).toBe(false)
  })

  it('finishes a task on the day it is checked', async () => {
    const { user, all } = await renderPlanner([task({ title: 'Lab', date: FRI })])
    await openPage(user, /To do/)
    await user.click(screen.getByRole('checkbox', { name: 'Lab done' }))
    expect(all()[0]).toMatchObject({ kind: 'task', doneOn: SAT })
  })
})

describe('adding and editing', () => {
  it('adds a weekday goal with the stepper and presets', async () => {
    const { user, all } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /Daily goal/ }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), 'Duolingo')
    // Lengths move in 5-minute steps: 30 down to 15.
    for (let i = 0; i < 3; i++) await user.click(within(dialog).getByRole('button', { name: '5 minutes less' }))
    await user.click(within(dialog).getByRole('button', { name: 'Weekdays' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(all()).toHaveLength(1))
    expect(all()[0]).toMatchObject({ kind: 'goal', title: 'Duolingo', minutes: 15, days: [1, 2, 3, 4, 5] })
    // Saturday: a weekday goal shouldn't show.
    expect(screen.queryByText('Duolingo')).not.toBeInTheDocument()
  })

  it('adds a task planned for today with a due date', async () => {
    const { user, all } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /^Task/ }))

    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), 'Essay draft')
    await user.click(within(dialog).getByRole('button', { name: '5 minutes more' }))
    await user.type(within(dialog).getByLabelText(/Due/), MON)
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await openPage(user, /To do/)
    expect(await screen.findByText('Essay draft')).toBeInTheDocument()
    expect(all()[0]).toMatchObject({ kind: 'task', minutes: 45, date: SAT, due: MON, doneOn: null })
    expect(screen.getByText(/due Mon/)).toBeInTheDocument()
  })

  it('adds a "sometime" fun plan that shows under Maybe today', async () => {
    const { user } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /Fun/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), "Friend's house")
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await openPage(user, /To do/)

    expect(await screen.findByRole('heading', { name: 'Maybe today' })).toBeInTheDocument()
    expect(screen.getByText("Friend's house")).toBeInTheDocument()
  })

  it('edits and removes an existing item', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Reading', minutes: 30 })])
    await openPage(user, /To do/)
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
    await openPage(user, /To do/)
    await user.click(screen.getByRole('checkbox', { name: 'Reading done' }))
    await user.click(screen.getByText('Reading'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(all()).toEqual([]))
  })

  it('does not save without a title', async () => {
    const { user, store } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /^Task/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(store.put).not.toHaveBeenCalled()
  })
})

// Calendar, To do and Plans are tabs; Awake hours and Share my day are in the menu.
async function openPage(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const tab = /Today|Calendar/.test(name.source)
    ? 'Calendar'
    : /To do/.test(name.source)
      ? 'To do'
      : /Plans/.test(name.source)
        ? 'Plans'
        : null
  if (tab) {
    const tabs = within(screen.getByRole('navigation', { name: 'Sections' }))
    return user.click(tabs.getByRole('button', { name: new RegExp(`^${tab}`) }))
  }
  await user.click(screen.getByRole('button', { name: /^Menu/ }))
  await user.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name }))
}

describe('the day calendar', () => {
  it('places a goal with a start time on the calendar, and counts only anytime goals as left to fit in', async () => {
    await renderPlanner([
      goal({ title: 'Piano', start: '16:00', minutes: 40 }),
      goal({ title: 'Reading', minutes: 30 }),
    ])
    const calendar = screen.getByRole('region', { name: 'Schedule' })
    expect(within(calendar).getByText('Piano').closest('.card')).toHaveClass('kind-goal')
    expect(within(calendar).queryByText('Reading')).not.toBeInTheDocument()
    const summary = screen.getByRole('region', { name: 'Time today' })
    expect(summary).toHaveTextContent('30 min to fit in') // Reading only
  })

  it('shows a timed goal as done on the calendar once it is checked off', async () => {
    const { user } = await renderPlanner([goal({ title: 'Piano', start: '16:00' })])
    await openPage(user, /To do/)
    await user.click(screen.getByRole('checkbox', { name: 'Piano done' }))
    await openPage(user, /Calendar/)
    const calendar = screen.getByRole('region', { name: 'Schedule' })
    expect(within(calendar).getByText('Piano').closest('.card')).toHaveClass('done')
  })

  it('adds a goal at a set time from the editor', async () => {
    const { user, all } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(screen.getByRole('button', { name: /Daily goal/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('What'), 'Piano')
    // New goals start "at a time", defaulting to the next 10 minutes (it's 1:15 PM).
    expect(within(dialog).getByLabelText('Starts')).toHaveValue('13:20')
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '16:30' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(all()[0]).toMatchObject({ kind: 'goal', start: '16:30' }))
    expect(within(screen.getByRole('region', { name: 'Schedule' })).getByText('Piano')).toBeInTheDocument()
  })

  it('can make a goal "anytime" so it leaves the calendar', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Piano', start: '16:00' })])
    await user.click(within(screen.getByRole('region', { name: 'Schedule' })).getByText('Piano'))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Anytime' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(all()[0]).toMatchObject({ start: null }))
  })

  it('tapping an empty 10-minute chunk starts adding something at that time', async () => {
    const { user } = await renderPlanner()
    // Saturday's calendar starts at 9 AM; each 10-minute chunk is 14px tall.
    const grid = document.querySelector('.grid')!
    fireEvent.click(grid, { clientY: 14 * 6 * 4 + 14 * 3 + 5 }) // 4 hours and 3 chunks down: 1:30 PM
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Fun/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'At a time' }))
    expect(within(screen.getByRole('dialog')).getByLabelText('From')).toHaveValue('13:30')
  })
})

describe('scheduling goals and tasks', () => {
  const calendar = () => within(screen.getByRole('region', { name: 'Schedule' }))

  it('one tap puts an anytime goal in the next free gap today, for today only', async () => {
    const { user, all } = await renderPlanner([
      fun({ title: 'Lunch', start: '13:00', end: '14:00' }),
      goal({ title: 'Reading', minutes: 30 }),
    ])
    expect(screen.getByRole('region', { name: 'Time today' })).toHaveTextContent('30 min to fit in')

    await openPage(user, /To do/)
    await user.click(screen.getByRole('button', { name: 'Schedule Reading' }))
    // It switches to the calendar to show where it went.
    expect(screen.getByRole('button', { name: /^Calendar/ })).toHaveAttribute('aria-current', 'page')
    // It's 1:15 PM and lunch runs until 2, so the next free gap starts at 2.
    expect(screen.getByRole('status')).toHaveTextContent('Reading is on at 2:00 PM')
    expect(calendar().getByText('Reading').closest('.card')).toHaveClass('kind-goal')
    expect(screen.getByRole('region', { name: 'Time today' })).toHaveTextContent('Nothing left to fit in')
    await openPage(user, /To do/)
    expect(screen.queryByRole('button', { name: 'Schedule Reading' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(all().find((r) => r.kind === 'goal')).toMatchObject({ start: null, moved: { [SAT]: '14:00' } }),
    )

    // Tomorrow it's back in the checklist.
    await user.click(screen.getByRole('button', { name: 'Next day' }))
    expect(screen.getByRole('button', { name: 'Schedule Reading' })).toBeInTheDocument()
  })

  it('one tap schedules a task too, and checking it off shows it done on the calendar', async () => {
    const { user, all } = await renderPlanner([task({ title: 'Lab write-up', minutes: 50 })])
    await openPage(user, /To do/)
    await user.click(screen.getByRole('button', { name: 'Schedule Lab write-up' }))
    // It's 1:15 PM, already on a 5-minute mark.
    await waitFor(() => expect(all()[0]).toMatchObject({ at: { date: SAT, start: '13:15' } }))
    expect(calendar().getByText('Lab write-up')).toBeInTheDocument()

    await openPage(user, /To do/)
    await user.click(screen.getByRole('checkbox', { name: 'Lab write-up done' }))
    await openPage(user, /Calendar/)
    expect(calendar().getByText('Lab write-up').closest('.card')).toHaveClass('done')
  })

  it('says so gently when nothing fits', async () => {
    const { user, store } = await renderPlanner([
      routine({ title: 'Tournament', days: [6], start: '09:00', end: '22:20' }),
      goal({ title: 'Reading', minutes: 30 }),
    ])
    await openPage(user, /To do/)
    await user.click(screen.getByRole('button', { name: 'Schedule Reading' }))
    expect(screen.getByRole('status')).toHaveTextContent('No free gap long enough for Reading left today')
    // Nothing moved, so it stays on To do.
    expect(screen.getByRole('button', { name: /^To do/ })).toHaveAttribute('aria-current', 'page')
    expect(store.put).not.toHaveBeenCalled()
  })

  it('tapping an empty spot offers the day’s unscheduled goals and tasks first', async () => {
    const { user, all } = await renderPlanner([
      goal({ title: 'Reading', minutes: 30 }),
      goal({ title: 'Piano', start: '16:00' }), // already has a time
      task({ title: 'Essay', minutes: 60 }),
    ])
    fireEvent.click(document.querySelector('.grid')!, { clientY: 14 * 6 * 6 + 5 }) // 3:00 PM
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('heading', { name: 'Fit something in at 3:00 PM' })).toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: /Piano/ })).not.toBeInTheDocument()
    expect(dialog.getByRole('heading', { name: 'Or add something new' })).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: /Essay/ }))
    await waitFor(() =>
      expect(all().find((r) => r.kind === 'task')).toMatchObject({ at: { date: SAT, start: '15:00' } }),
    )
    expect(calendar().getByText('Essay')).toBeInTheDocument()
  })

  it('does not offer unfinished goals and tasks for a spot that has already passed', async () => {
    await renderPlanner([goal({ title: 'Reading' }), task({ title: 'Essay' })])
    fireEvent.click(document.querySelector('.grid')!, { clientY: 14 * 6 * 2 + 5 }) // 11:00 AM; it's 1:15 PM
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.queryByRole('button', { name: /Reading|Essay/ })).not.toBeInTheDocument()
    expect(dialog.getByRole('button', { name: /^Routine/ })).toBeInTheDocument() // can still add something new
  })

  it('has no Schedule buttons on a day that has gone', async () => {
    const { user } = await renderPlanner([goal({ title: 'Reading' }), task({ title: 'Essay', date: FRI })])
    await openPage(user, /To do/)
    expect(screen.getByRole('button', { name: 'Schedule Reading' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByText('Reading')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Schedule/ })).not.toBeInTheDocument()
  })

  it('takes a scheduled goal back off the calendar for the day', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Reading', moved: { [SAT]: '15:00' } })])
    await user.click(calendar().getByText('Reading'))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Take it off the calendar for this day' }),
    )
    await waitFor(() => expect(all()[0]).toMatchObject({ moved: {} }))
    await openPage(user, /To do/)
    expect(screen.getByRole('button', { name: 'Schedule Reading' })).toBeInTheDocument()
  })

  it('puts a moved timed goal back at its usual time', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Piano', start: '16:00', moved: { [SAT]: '19:00' } })])
    await user.click(calendar().getByText('Piano'))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Back to its usual time (4:00 PM)' }),
    )
    await waitFor(() => expect(all()[0]).toMatchObject({ start: '16:00', moved: {} }))
  })
})

describe('dragging on the calendar', () => {
  // Each 10-minute chunk is 14px tall, so 5 minutes is 7px.
  function drag(card: Element, dy: number, pointerType = 'mouse') {
    fireEvent.pointerDown(card, { pointerId: 1, button: 0, clientY: 100, pointerType })
    fireEvent.pointerMove(card, { pointerId: 1, clientY: 100 + dy / 2, pointerType })
    fireEvent.pointerMove(card, { pointerId: 1, clientY: 100 + dy, pointerType })
    fireEvent.pointerUp(card, { pointerId: 1, clientY: 100 + dy, pointerType })
    fireEvent.click(card)
  }
  const block = (title: string) =>
    within(screen.getByRole('region', { name: 'Schedule' }))
      .getByText(title)
      .closest('.card')!

  it('moves a goal to a new time for that day only, snapping to 5 minutes', async () => {
    const { all } = await renderPlanner([goal({ title: 'Piano', start: '16:00', minutes: 40 })])
    drag(block('Piano'), 14 * 6 * 2 + 14 * 2 + 3) // 2 hours, 2 chunks (and a few px)

    await waitFor(() => expect(all()[0]).toMatchObject({ start: '16:00', moved: { [SAT]: '18:20' } }))
    expect(block('Piano')).toHaveTextContent('6:20 PM – 7:00 PM')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument() // dragging doesn't open the editor
  })

  it('snaps a drag to 5 minutes', async () => {
    const { all } = await renderPlanner([goal({ title: 'Piano', start: '16:00', minutes: 15 })])
    drag(block('Piano'), 14 * 6 + 7 + 2) // 1 hour 5 minutes (and a few px)
    await waitFor(() => expect(all()[0]).toMatchObject({ moved: { [SAT]: '17:05' } }))
    expect(block('Piano')).toHaveTextContent('5:05 PM – 5:20 PM')
  })

  it('keeps an unfinished goal out of time that has passed, stopping at now', async () => {
    const { all } = await renderPlanner([goal({ title: 'Piano', start: '16:00', minutes: 15 })])
    drag(block('Piano'), -14 * 6 * 4) // 4 hours earlier would be noon; it's 1:15 PM
    await waitFor(() => expect(all()[0]).toMatchObject({ moved: { [SAT]: '13:15' } }))
  })

  it('a finished goal can still be moved earlier, to show when it happened', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Piano', start: '16:00', minutes: 15 })])
    await openPage(user, /To do/)
    await user.click(screen.getByRole('checkbox', { name: 'Piano done' }))
    await openPage(user, /Calendar/)
    drag(block('Piano'), -14 * 6 * 4)
    await waitFor(() => expect(all().find((r) => r.kind === 'goal')).toMatchObject({ moved: { [SAT]: '12:00' } }))
  })

  it('does not move unfinished goals on a day that has gone', async () => {
    const { user, store } = await renderPlanner([goal({ title: 'Piano', start: '16:00' })])
    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    drag(block('Piano'), 14 * 6)
    expect(store.put).not.toHaveBeenCalled()
  })

  it('moves a fun plan, keeping its length', async () => {
    const { all } = await renderPlanner([fun({ title: "Maya's house", start: '14:00', end: '15:30' })])
    drag(block("Maya's house"), -14 * 6)
    await waitFor(() => expect(all()[0]).toMatchObject({ start: '13:00', end: '14:30' }))
  })

  it('does not move routines', async () => {
    const { store } = await renderPlanner([routine({ title: 'Soccer', days: [6], start: '10:00', end: '11:30' })])
    drag(block('Soccer'), 14 * 6)
    expect(store.put).not.toHaveBeenCalled()
  })

  it('on a touch screen, a quick swipe scrolls instead of dragging', async () => {
    const { store } = await renderPlanner([goal({ title: 'Piano', start: '16:00' })])
    drag(block('Piano'), 14 * 6, 'touch') // no hold first
    expect(store.put).not.toHaveBeenCalled()
  })

  it('a plain tap still opens the editor', async () => {
    const { user } = await renderPlanner([goal({ title: 'Piano', start: '16:00' })])
    await user.click(block('Piano'))
    expect(within(screen.getByRole('dialog')).getByLabelText('What')).toHaveValue('Piano')
  })
})

describe('menu', () => {
  it('has tabs for Calendar, To do and Plans, and Awake hours in the menu', async () => {
    const { user } = await renderPlanner([goal({ title: 'Reading' }), task({ title: 'Essay' })])
    const tabs = within(screen.getByRole('navigation', { name: 'Sections' }))
    // Opens on the calendar; To do shows what's left.
    expect(tabs.getByRole('button', { name: /^Calendar/ })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('button', { name: /^To do/ })).toHaveTextContent('To do2')

    await openPage(user, /To do/)
    expect(screen.getByRole('heading', { name: 'Daily goals' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Schedule' })).not.toBeInTheDocument()
    // The date and summary stay at the top of both.
    expect(screen.getByRole('heading', { level: 1, name: 'Saturday' })).toBeInTheDocument()

    await openPage(user, /Plans/)
    expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeInTheDocument()

    await openPage(user, /Awake hours/)
    expect(screen.getByRole('heading', { level: 1, name: 'Awake hours' })).toBeInTheDocument()
    expect(tabs.getAllByRole('button').filter((b) => b.getAttribute('aria-current'))).toEqual([])

    await openPage(user, /Calendar/)
    expect(screen.getByRole('region', { name: 'Schedule' })).toBeInTheDocument()
  })

  it('the menu has Awake hours, and no Today, Daily goals or My week', async () => {
    const { user } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const menu = within(screen.getByRole('dialog', { name: 'Menu' }))
    expect(menu.queryByRole('button', { name: /Today/ })).not.toBeInTheDocument()
    expect(menu.queryByRole('button', { name: /Daily goals/ })).not.toBeInTheDocument()
    expect(menu.queryByRole('button', { name: /My week/ })).not.toBeInTheDocument()
    expect(menu.getByRole('button', { name: /Awake hours/ })).toBeInTheDocument()
  })

  it('To do says so when there is nothing to check off', async () => {
    const { user } = await renderPlanner()
    await openPage(user, /To do/)
    expect(screen.getByText('Nothing to check off today.')).toBeInTheDocument()
  })

  it('shows who is signed in and signs out', async () => {
    const onSignOut = vi.fn()
    const { user } = await renderPlanner([], { ...sam, avatarUrl: null, onSignOut })
    expect(screen.getByText('Good afternoon, Sam')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByText('Sam Rivera')).toBeInTheDocument()
    expect(screen.getByText('Signed in as sam@example.com')).toBeInTheDocument()
    expect(screen.getByText('S')).toHaveClass('avatar') // no photo: their initial
    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('switches between light and dark, and back to following the phone', async () => {
    const { user } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const appearance = screen.getByRole('radiogroup', { name: 'Appearance' })
    expect(within(appearance).getByRole('radio', { name: 'Auto' })).toBeChecked()

    await user.click(within(appearance).getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(within(appearance).getByRole('radio', { name: 'Dark' })).toBeChecked()
    // The menu stays open so it's easy to compare.
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument()

    await user.click(within(appearance).getByRole('radio', { name: 'Light' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(within(appearance).getByRole('radio', { name: 'Auto' }))
    expect(document.documentElement).not.toHaveAttribute('data-theme')
  })

  it('shows their Google photo', async () => {
    const { user } = await renderPlanner([], { ...sam, onSignOut: vi.fn() })
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    const photo = document.querySelector('img.avatar')!
    expect(photo).toHaveAttribute('src', sam.avatarUrl)
    expect(photo).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  it('has no sign out in local mode', async () => {
    const { user } = await renderPlanner()
    await user.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByText('Saved on this device')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })
})

describe('Plans page', () => {
  const section = (name: string) => within(screen.getByRole('region', { name }))

  it('has a section for each kind, in the legend order, each with its own add button', async () => {
    const { user } = await renderPlanner()
    await openPage(user, /Plans/)
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim())
    expect(headings).toEqual(['Routines', 'Daily goals', 'Tasks', 'Fun'])

    for (const [label, kind] of [
      ['Add routine', 'Routine'],
      ['Add daily goal', 'Daily goal'],
      ['Add task', 'Task'],
      ['Add fun', 'Fun'],
    ]) {
      await user.click(screen.getByRole('button', { name: label }))
      expect(within(screen.getByRole('dialog')).getByText(kind)).toBeInTheDocument()
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    }
  })

  it('lists weekly routines, then one-offs coming up', async () => {
    const { user } = await renderPlanner([
      routine({ title: 'School' }),
      routine({ title: 'Band concert', date: '2026-11-20', days: [], start: '18:00', end: '20:00' }),
      routine({ title: 'Old recital', date: FRI, days: [] }),
    ])
    await openPage(user, /Plans/)
    const routines = section('Routines')
    expect(routines.getByText('7:45 AM – 3:00 PM · Weekdays')).toBeInTheDocument()
    expect(routines.getByText('Band concert')).toBeInTheDocument()
    expect(routines.queryByText('Old recital')).not.toBeInTheDocument()
  })

  it('groups goals: going now, with starting later and finished folded away', async () => {
    const { user } = await renderPlanner([
      goal({ title: 'Reading' }),
      goal({ title: 'Summer math', from: MON }),
      goal({ title: 'Clarinet', days: [1, 2, 3, 4, 5], until: FRI }),
    ])
    await openPage(user, /Plans/)
    const goals = section('Daily goals')
    expect(goals.getByText('Reading').closest('details')).toBeNull()
    expect(goals.getByText('Starting later (1)')).toBeInTheDocument()
    expect(goals.getByText('Finished (1)')).toBeInTheDocument()
    expect(goals.getByText('Clarinet').closest('details')).not.toHaveAttribute('open')
    expect(goals.getByText('30 min · Anytime · Weekdays · until Fri, Oct 2')).toBeInTheDocument()
  })

  it('lists open tasks on any day, overdue first, with recently done ones folded away', async () => {
    const { user } = await renderPlanner([
      task({ title: 'Essay draft', date: MON, due: '2026-10-07' }),
      task({ title: 'Lab write-up', date: FRI, due: FRI }),
      task({ title: 'Clean room', date: SAT }),
      task({ title: 'Book report', date: FRI, doneOn: FRI }),
      task({ title: 'Old project', date: '2026-09-01', doneOn: '2026-09-02' }),
    ])
    await openPage(user, /Plans/)
    const tasks = section('Tasks')
    const open = tasks
      .getAllByRole('button')
      .filter((b) => b.classList.contains('card') && !b.closest('details'))
      .map((b) => b.querySelector('.title')?.textContent)
    expect(open).toEqual(['Lab write-up', 'Clean room', 'Essay draft'])
    expect(tasks.getByText(/overdue/)).toHaveClass('overdue')
    expect(tasks.getByText(/Mon, Oct 5/)).toBeInTheDocument()
    expect(tasks.getByText(/from Fri, Oct 2/)).toBeInTheDocument()
    expect(tasks.getByText('Done lately (1)')).toBeInTheDocument()
    expect(tasks.getByText('30 min · done Fri, Oct 2')).toBeInTheDocument()
    expect(tasks.queryByText('Old project')).not.toBeInTheDocument()
  })

  it('shows fun for the next two weeks only', async () => {
    const { user } = await renderPlanner([
      fun({ title: "Maya's house", date: SAT, start: '14:00', end: '17:00' }),
      fun({ title: 'Movie night', date: '2026-10-09', start: null, end: null }),
      fun({ title: 'Ski trip', date: '2026-10-17' }),
      fun({ title: 'Last week', date: FRI }),
    ])
    await openPage(user, /Plans/)
    const plans = section('Fun')
    expect(plans.getByText('Today · 2:00 PM – 5:00 PM')).toBeInTheDocument()
    expect(plans.getByText(/sometime/)).toBeInTheDocument()
    expect(plans.queryByText('Ski trip')).not.toBeInTheDocument()
    expect(plans.queryByText('Last week')).not.toBeInTheDocument()
  })

  it('adds a goal from its section, skipping the "what kind" step', async () => {
    const { user, all } = await renderPlanner()
    await openPage(user, /Plans/)
    expect(section('Daily goals').getByText(/Nothing yet/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add daily goal' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Daily goal')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('What'), 'Sketching')
    await user.click(within(dialog).getByRole('button', { name: '5 minutes more' }))
    await user.click(within(dialog).getByRole('button', { name: 'Anytime' }))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(all()[0]).toMatchObject({
        kind: 'goal',
        title: 'Sketching',
        minutes: 35,
        start: null,
        days: [0, 1, 2, 3, 4, 5, 6],
      }),
    )
    expect(section('Daily goals').getByText('Sketching')).toBeInTheDocument()
  })

  it('renames, retimes and removes a goal', async () => {
    const { user, all } = await renderPlanner([goal({ title: 'Reading', start: '19:00' })])
    await openPage(user, /Plans/)

    await user.click(screen.getByText('Reading'))
    let dialog = screen.getByRole('dialog')
    await user.clear(within(dialog).getByLabelText('What'))
    await user.type(within(dialog).getByLabelText('What'), 'Reading (novel)')
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '20:10' } })
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(all()[0]).toMatchObject({ title: 'Reading (novel)', start: '20:10' }))

    await user.click(screen.getByText('Reading (novel)'))
    dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(all()).toEqual([]))
    expect(section('Daily goals').getByText(/Nothing yet/)).toBeInTheDocument()
  })
})

describe('Awake hours', () => {
  it('saves awake hours, and an empty bedtime', async () => {
    const { user, all } = await renderPlanner()
    await openPage(user, /Awake hours/)

    // Time inputs don't accept typed text reliably in jsdom; set the value directly.
    fireEvent.change(screen.getAllByLabelText('Up at')[1], { target: { value: '10:00' } })
    await waitFor(() => expect(all().find((r) => r.kind === 'settings')).toMatchObject({ weekendStart: '10:00' }))
    fireEvent.change(screen.getAllByLabelText('Bed at')[1], { target: { value: '' } })
    await waitFor(() => expect(all().find((r) => r.kind === 'settings')).toMatchObject({ weekendEnd: '' }))
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
    render(<Planner store={store} />)
    expect(await screen.findByText('Offline')).toBeInTheDocument()
  })
})
