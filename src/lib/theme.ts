// Light or dark, chosen in the menu. A per-device preference kept in this
// browser; "auto" follows the phone's setting.
export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'eden-calendar:theme'
// Browser chrome color for each theme; matches --bg in index.css.
const CHROME = { light: '#f6f4ef', dark: '#1c211f' }

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'auto'
  } catch {
    return 'auto'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme
  // index.html has one theme-color tag per system scheme; point both at the chosen one.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = theme === 'auto' ? (meta.getAttribute('media')?.includes('dark') ? 'dark' : 'light') : theme
    meta.content = CHROME[scheme]
  }
}

export function saveTheme(theme: Theme) {
  try {
    if (theme === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Private mode or storage blocked: still apply it for this visit.
  }
  applyTheme(theme)
}
