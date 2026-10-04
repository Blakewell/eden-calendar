import { expect, test, type Page } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, with tasks on other days and fun coming up.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.addInitScript(() => {
    if (localStorage.getItem('eden-calendar:records')) return
    const task = (id: string, title: string, date: string, due: string | null) => ({
      kind: 'task',
      id,
      title,
      minutes: 30,
      date,
      due,
      doneOn: null,
      at: null,
    })
    localStorage.setItem(
      'eden-calendar:records',
      JSON.stringify([
        task('t1', 'Essay draft', '2026-10-05', '2026-10-07'),
        task('t2', 'Lab write-up', '2026-10-02', '2026-10-02'),
        { kind: 'fun', id: 'f1', title: 'Movie night', date: '2026-10-09', start: null, end: null },
        { kind: 'fun', id: 'f2', title: 'Ski trip', date: '2026-10-24', start: null, end: null },
      ]),
    )
  })
  await page.goto('/')
})

const tab = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click()

test('Plans lists tasks on any day and fun for two weeks, and adds from a section', async ({ page }) => {
  await tab(page, 'Plans')
  await expect(page.getByRole('heading', { level: 1, name: 'Plans' })).toBeVisible()

  const tasks = page.getByRole('region', { name: 'Tasks' })
  // Overdue first, then by day.
  await expect(tasks.locator('.card .title')).toHaveText(['Lab write-up', 'Essay draft'])
  await expect(tasks.getByText('overdue')).toBeVisible()

  const fun = page.getByRole('region', { name: 'Fun' })
  await expect(fun.getByText('Movie night')).toBeVisible()
  await expect(fun.getByText('Ski trip')).toHaveCount(0) // more than two weeks out

  await page.getByRole('button', { name: 'Add task' }).click()
  const editor = page.getByRole('dialog')
  await editor.getByLabel('What').fill('Clean room')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(tasks.getByText('Clean room')).toBeVisible()

  // No sideways scrolling at 375px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('awake hours are in the menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page
    .getByRole('dialog', { name: 'Menu' })
    .getByRole('button', { name: /Awake hours/ })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Awake hours' })).toBeVisible()
  await expect(page.getByLabel('Bed at').first()).toHaveValue('21:30')
})
