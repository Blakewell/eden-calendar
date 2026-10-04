import { expect, test } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, with an anytime goal and an assignment.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.addInitScript(() => {
    if (localStorage.getItem('eden-calendar:records')) return
    const every = [0, 1, 2, 3, 4, 5, 6]
    localStorage.setItem(
      'eden-calendar:records',
      JSON.stringify([
        {
          kind: 'goal',
          id: 'g1',
          title: 'Reading',
          minutes: 30,
          start: null,
          moved: {},
          days: every,
          from: null,
          until: null,
        },
        { kind: 'task', id: 't1', title: 'Essay', minutes: 60, date: '2026-10-03', due: null, doneOn: null, at: null },
      ]),
    )
  })
  await page.goto('/')
})

test('one tap schedules a goal into the next free gap, and it stays after a reload', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: /^To do/ })
    .click()
  // It's 1:15 PM on Saturday; weekend bedtime is 10:30 PM.
  await expect(page.getByRole('region', { name: 'Time today' })).toContainText('9h 15m until bedtime (10:30 PM)')
  await page.getByRole('button', { name: 'Schedule Reading' }).click()
  // It switches to the calendar to show where it went.
  await expect(page.getByRole('status')).toContainText('Reading is on at 1:15 PM')
  const calendar = page.getByRole('region', { name: 'Schedule' })
  await expect(calendar.getByRole('button', { name: /Reading/ })).toContainText('1:15 PM – 1:45 PM')

  await page.reload()
  await expect(calendar.getByRole('button', { name: /Reading/ })).toContainText('1:15 PM – 1:45 PM')
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: /^To do/ })
    .click()
  await expect(page.getByRole('button', { name: 'Schedule Reading' })).toHaveCount(0)
})

test('tap an empty spot and pick the assignment to put there', async ({ page }) => {
  const grid = page.locator('.grid')
  await grid.scrollIntoViewIfNeeded()
  const box = (await grid.boundingBox())!
  // Saturday starts at 9 AM; 4:00 PM is 7 hours down.
  await grid.click({ position: { x: box.width / 2, y: 7 * 6 * 14 + 4 } })

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Fit something in at 4:00 PM' })).toBeVisible()
  await dialog.getByRole('button', { name: /Essay/ }).click()

  await expect(page.getByRole('region', { name: 'Schedule' }).getByRole('button', { name: /Essay/ })).toContainText(
    '4:00 PM – 5:00 PM',
  )
})
