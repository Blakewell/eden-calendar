import { expect, test } from '@playwright/test'

// The home-screen icon: every icon the page and manifest point at loads, at the size it claims.
test('home-screen icons load at their stated sizes', async ({ page, request }) => {
  await page.goto('/')
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  const icons: { src: string; sizes: string }[] = [
    { src: appleIcon!, sizes: '180x180' },
    ...manifest.icons,
    { src: 'favicon.svg', sizes: '' },
  ]
  for (const { src, sizes } of icons) {
    const res = await request.get(new URL(src, page.url()).href)
    expect(res.ok(), src).toBe(true)
    if (!sizes) continue
    const body = await res.body()
    // PNG width and height live at bytes 16-23 of the IHDR chunk.
    expect(`${body.readUInt32BE(16)}x${body.readUInt32BE(20)}`, src).toBe(sizes)
  }
})
