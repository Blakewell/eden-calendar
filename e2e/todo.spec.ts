import { expect, test, type Page } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, with two anytime goals and two tasks.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.addInitScript(() => {
    if (localStorage.getItem('eden-calendar:records')) return
    const goal = (id: string, title: string) => ({
      kind: 'goal',
      id,
      title,
      minutes: 30,
      start: null,
      moved: {},
      days: [0, 1, 2, 3, 4, 5, 6],
      from: null,
      until: null,
    })
    const task = (id: string, title: string) => ({
      kind: 'task',
      id,
      title,
      minutes: 30,
      date: '2026-10-03',
      due: null,
      doneOn: null,
      at: null,
    })
    localStorage.setItem(
      'eden-calendar:records',
      JSON.stringify([goal('g1', 'Reading'), goal('g2', 'Duolingo'), task('t1', 'Essay'), task('t2', 'Clean room')]),
    )
  })
  await page.goto('/')
})

const tab = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click()

test('the calendar shows what is still to fit in, and one tap schedules it', async ({ page }) => {
  const toFit = page.getByRole('region', { name: 'Still to fit in' })
  await expect(toFit.getByRole('button')).toHaveCount(4)
  for (const chip of await toFit.getByRole('button').all()) {
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(40)
  }

  await toFit.getByRole('button', { name: 'Schedule Essay' }).click()
  await expect(page.getByRole('status')).toContainText('Essay is on at 1:15 PM')
  await expect(toFit.getByRole('button')).toHaveCount(3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('finished goals and tasks fold away under Done, and can be unchecked', async ({ page }) => {
  await tab(page, 'To do')
  const goals = page.getByRole('region', { name: 'Daily goals' })
  await expect(goals.getByText('2 left')).toBeVisible()

  await page.getByRole('checkbox', { name: 'Reading done' }).click()
  await expect(goals.getByText('1 left')).toBeVisible()
  const reading = page.getByRole('checkbox', { name: 'Reading done' })
  await expect(reading).toBeHidden() // folded away
  await goals.getByText('Done (1)').click()
  await expect(reading).toBeVisible()
  await reading.click()
  await expect(goals.getByText('2 left')).toBeVisible()

  for (const name of ['Reading', 'Duolingo', 'Essay', 'Clean room']) {
    await page.getByRole('checkbox', { name: `${name} done` }).click()
  }
  await expect(page.getByText('All done for today. Nice work.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^To do/ })).toHaveAccessibleName('To do')
})
