export type ThemeChoice = 'light' | 'dark'
export function initialTheme(): ThemeChoice {
  const saved = localStorage.getItem('shh_theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
