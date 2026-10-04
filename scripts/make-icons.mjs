// Renders public/favicon.svg into the home-screen PNGs: node scripts/make-icons.mjs
// The 512 icon is maskable, so its clock is shrunk a little to stay inside Android's safe circle.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const svg = readFileSync('public/favicon.svg', 'utf8')
const maskable = svg.replace(
  '<g id="clock">',
  '<g id="clock" transform="translate(90 90) scale(.86) translate(-90 -90)">',
)
const icons = [
  ['public/apple-touch-icon.png', 180, svg],
  ['public/icon-192.png', 192, svg],
  ['public/icon-512.png', 512, maskable],
]

const browser = await chromium.launch()
const page = await browser.newPage()
for (const [path, size, source] of icons) {
  await page.setViewportSize({ width: size, height: size })
  const sized = source.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<body style="margin:0">${sized}</body>`)
  await page.locator('svg').screenshot({ path, omitBackground: true })
}
await browser.close()
