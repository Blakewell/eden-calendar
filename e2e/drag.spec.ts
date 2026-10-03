import { expect, test, type Locator, type Page } from '@playwright/test'

// Saturday, Oct 3 2026 at 1:15 PM, with a timed goal, a fun plan and a routine.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-03T13:15:00-05:00'))
  await page.addInitScript(() => {
    if (localStorage.getItem('eden-calendar:records')) return
    const every = [0, 1, 2, 3, 4, 5, 6]
    localStorage.setItem(
      'eden-calendar:records',
      JSON.stringify([
        { kind: 'routine', id: 'r1', title: 'Soccer', start: '10:00', end: '11:30', days: every, date: null },
        {
          kind: 'goal',
          id: 'g1',
          title: 'Piano',
          minutes: 40,
          start: '16:00',
          moved: {},
          days: every,
          from: null,
          until: null,
        },
        { kind: 'fun', id: 'f1', title: 'Movie', date: '2026-10-03', start: '19:00', end: '21:00' },
      ]),
    )
  })
  await page.goto('/')
})

const block = (page: Page, name: RegExp) => page.getByRole('region', { name: 'Schedule' }).getByRole('button', { name })

async function center(locator: Locator) {
  await locator.scrollIntoViewIfNeeded()
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 20) }
}

test('drag a goal with the mouse; it moves for today only', async ({ page }) => {
  const piano = block(page, /Piano/)
  const { x, y } = await center(piano)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 40, { steps: 4 })
  await page.mouse.move(x, y + 14 * 6 * 3 + 14, { steps: 6 }) // 3 hours 10 minutes later
  await page.mouse.up()

  await expect(piano).toContainText('7:10 PM – 7:50 PM')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Tomorrow it's back at its usual time.
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(block(page, /Piano/)).toContainText('4:00 PM – 4:40 PM')

  // And the move was saved.
  await page.getByRole('button', { name: 'Today' }).click()
  await page.reload()
  await expect(block(page, /Piano/)).toContainText('7:10 PM – 7:50 PM')
})

test('hold and drag with a finger moves fun without scrolling the page', async ({ page }) => {
  const movie = block(page, /Movie/)
  const { x, y } = await center(movie)
  const scrollBefore = await page.evaluate(() => scrollY)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] })

  await touch('touchStart', y)
  await page.waitForTimeout(450) // hold
  for (let i = 1; i <= 6; i++) await touch('touchMove', y - (14 * 6 * i) / 6) // up one hour
  await touch('touchEnd')

  await expect(movie).toContainText('6:00 PM – 8:00 PM')
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore)
})

test('a quick swipe on a block scrolls the page instead of moving it', async ({ page }) => {
  const movie = block(page, /Movie/)
  const { x, y } = await center(movie)
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', ty?: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ty === undefined ? [] : [{ x, y: ty }] })

  await touch('touchStart', y)
  for (let i = 1; i <= 6; i++) await touch('touchMove', y - 20 * i)
  await touch('touchEnd')
  await expect(movie).toContainText('7:00 PM – 9:00 PM')
})

test('routines stay put', async ({ page }) => {
  const soccer = block(page, /Soccer/)
  const { x, y } = await center(soccer)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 100, { steps: 5 })
  await page.mouse.up()
  await expect(soccer).toContainText('10:00 AM – 11:30 AM')
})
