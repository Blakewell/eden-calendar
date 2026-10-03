import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, readTheme, saveTheme } from './theme'

function addThemeColorTags() {
  document.head.innerHTML = `
    <meta name="theme-color" content="#f6f4ef" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1c211f" media="(prefers-color-scheme: dark)" />`
}
const colors = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map((m) => m.content)

afterEach(() => applyTheme('auto'))

describe('theme', () => {
  it('defaults to following the phone', () => {
    expect(readTheme()).toBe('auto')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('saves a chosen theme on this device and applies it', () => {
    addThemeColorTags()
    saveTheme('dark')
    expect(readTheme()).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(colors()).toEqual(['#1c211f', '#1c211f'])
  })

  it('going back to auto clears the choice and restores the browser colors', () => {
    addThemeColorTags()
    saveTheme('light')
    saveTheme('auto')
    expect(readTheme()).toBe('auto')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(colors()).toEqual(['#f6f4ef', '#1c211f'])
  })

  it('ignores anything unexpected in storage', () => {
    localStorage.setItem('eden-calendar:theme', 'purple')
    expect(readTheme()).toBe('auto')
  })
})
