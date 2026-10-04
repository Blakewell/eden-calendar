import { expect, test, type Page } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, like the unit tests.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Saturday' })).toBeVisible()
})

// Calendar, To do and Goals are tabs along the bottom.
const tab = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click()

const calendar = (page: Page) => page.getByRole('region', { name: 'Schedule' })

test('add a goal at a time, see it on the calendar, then change and remove it', async ({ page }) => {
  await tab(page, 'Goals')
  await expect(page.getByText(/Nothing yet/)).toBeVisible()

  await page.getByRole('button', { name: 'Add goal' }).click()
  const editor = page.getByRole('dialog')
  await editor.getByLabel('What').fill('Piano')
  await editor.getByLabel('Starts').fill('16:00')
  // Lengths move in 5-minute steps: 30 down to 15.
  for (let i = 0; i < 3; i++) await editor.getByRole('button', { name: '5 minutes less' }).click()
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('15 min · 4:00 PM · Every day')).toBeVisible()

  await tab(page, 'Calendar')
  const piano = calendar(page).getByRole('button', { name: /Piano/ })
  await expect(piano).toContainText('4:00 PM – 4:15 PM')

  await piano.click()
  await editor.getByLabel('What').fill('Piano scales')
  await editor.getByLabel('Starts').fill('17:05')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(calendar(page).getByRole('button', { name: /Piano scales/ })).toContainText('5:05 PM – 5:20 PM')

  await calendar(page)
    .getByRole('button', { name: /Piano scales/ })
    .click()
  await editor.getByRole('button', { name: 'Remove' }).click()
  await expect(calendar(page).getByText('Piano scales')).toHaveCount(0)
})

test('goals survive a reload (saved on this device)', async ({ page }) => {
  await tab(page, 'Goals')
  await page.getByRole('button', { name: 'Add goal' }).click()
  await page.getByRole('dialog').getByLabel('What').fill('Reading')
  await page.getByRole('dialog').getByRole('button', { name: 'Anytime' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click()

  await page.reload()
  await tab(page, 'To do')
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

test('appearance: pick dark or light in the menu, and it sticks after a reload', async ({ page }) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const LIGHT = 'rgb(246, 244, 239)'
  const DARK = 'rgb(28, 33, 31)'
  const choose = async (name: string) => {
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('radiogroup', { name: 'Appearance' }).getByRole('radio', { name }).click()
    await page.keyboard.press('Escape')
  }

  await choose('Dark')
  expect(await background()).toBe(DARK)
  await choose('Light')
  expect(await background()).toBe(LIGHT)
  await page.reload()
  expect(await background()).toBe(LIGHT)

  // Auto follows the phone, which differs per test project.
  await choose('Auto')
  const scheme = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)
  expect(await background()).toBe(scheme ? DARK : LIGHT)
})

test('the tab bar stays at the bottom of the phone screen and switches views', async ({ page }) => {
  const bar = page.getByRole('navigation', { name: 'Sections' })
  const box = (await bar.boundingBox())!
  expect(Math.round(box.y + box.height)).toBe(812)
  for (const b of await bar.getByRole('button').all())
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(40)

  await tab(page, 'To do')
  await expect(page.getByText('Nothing to check off today.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Schedule' })).toHaveCount(0)
  await tab(page, 'Calendar')
  await expect(page.getByRole('region', { name: 'Schedule' })).toBeVisible()
})
