import { expect, test, type Page } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, like the unit tests.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Saturday' })).toBeVisible()
})

async function openPage(page: Page, name: RegExp) {
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name }).click()
}

const calendar = (page: Page) => page.getByRole('region', { name: 'Schedule' })

test('add a goal at a time, see it on the calendar, then change and remove it', async ({ page }) => {
  await openPage(page, /Daily goals/)
  await expect(page.getByText(/Nothing yet/)).toBeVisible()

  await page.getByRole('button', { name: '+ Add goal' }).click()
  const editor = page.getByRole('dialog')
  await editor.getByLabel('What').fill('Piano')
  await editor.getByLabel('Starts').fill('16:00')
  await editor.getByRole('button', { name: '10 minutes more' }).click()
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('40 min · 4:00 PM · Every day')).toBeVisible()

  await openPage(page, /Today/)
  const piano = calendar(page).getByRole('button', { name: /Piano/ })
  await expect(piano).toContainText('4:00 PM – 4:40 PM')

  // A 40-minute goal is four 10-minute chunks tall.
  const box = (await piano.boundingBox())!
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(4 * 14 - 4)

  await piano.click()
  await editor.getByLabel('What').fill('Piano scales')
  await editor.getByLabel('Starts').fill('17:10')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(calendar(page).getByRole('button', { name: /Piano scales/ })).toContainText('5:10 PM – 5:50 PM')

  await calendar(page)
    .getByRole('button', { name: /Piano scales/ })
    .click()
  await editor.getByRole('button', { name: 'Remove' }).click()
  await expect(calendar(page).getByText('Piano scales')).toHaveCount(0)
})

test('goals survive a reload (saved on this device)', async ({ page }) => {
  await openPage(page, /Daily goals/)
  await page.getByRole('button', { name: '+ Add goal' }).click()
  await page.getByRole('dialog').getByLabel('What').fill('Reading')
  await page.getByRole('dialog').getByRole('button', { name: 'Anytime' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()

  await page.reload()
  await expect(page.getByText('Reading')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Time today' })).toContainText('30 min to fit in')
})

test('tapping an empty spot on the calendar adds something at that 10-minute chunk', async ({ page }) => {
  const grid = page.locator('.grid')
  const box = (await grid.boundingBox())!
  // Saturday starts at 9 AM; 2:20 PM is 5 hours and 2 chunks down.
  await grid.click({ position: { x: box.width / 2, y: (5 * 6 + 2) * 14 + 4 } })
  const editor = page.getByRole('dialog')
  await editor.getByRole('button', { name: /Routine/ }).click()
  await expect(editor.getByLabel('Starts')).toHaveValue('14:20')
})

test('menu has no sign out in local mode, and fits the phone screen', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu.getByText('Saved on this device')).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Sign out' })).toHaveCount(0)

  for (const item of await menu.getByRole('button').all()) {
    expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(40)
  }
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()

  // No sideways scrolling at 375px.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})
