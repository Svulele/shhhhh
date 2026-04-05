import { useState, useEffect, useRef, createContext, useContext } from 'react'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro from './pages/Pomodoro'
import Settings from './pages/Settings'
import './App.css'

export type Page  = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings'
export type Theme = 'dark' | 'light'

export const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export const NAV: { page: Page; icon: React.ReactNode }[] = [
  { page: 'dashboard', icon: <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { page: 'library',   icon: <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
  { page: 'chat',      icon: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { page: 'pomodoro',  icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
  { page: 'settings',  icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
]

// ── Floating nav ──────────────────────────────────────────────
// Home: always fully expanded, no collapse
// Other pages: collapses to active icon on idle, expands smoothly on hover
// Animation uses CSS overflow + width on each pill — no DOM node swapping
function FloatingNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const isHome = page === 'dashboard'
  const [hovered, setHovered] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onEnter = () => {
    if (isHome) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setHovered(true)
  }
  const onLeave = () => {
    if (isHome) return
    timerRef.current = setTimeout(() => setHovered(false), 350)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // expanded when: on home (always) OR hovered on other pages
  const expanded = isHome || hovered

  return (
    <nav
      className="float-nav"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {NAV.map(n => {
        const active  = n.page === page
        const visible = expanded || active
        return (
          <button
            key={n.page}
            className={`float-nav-item${active ? ' active' : ''}`}
            onClick={() => { setPage(n.page); if (!isHome) setHovered(false) }}
            style={{
              // non-active items collapse to zero width when not expanded
              maxWidth: visible ? 52 : 0,
              opacity: visible ? 1 : 0,
              overflow: 'hidden',
              padding: 0,
              transition: 'max-width 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease',
              pointerEvents: visible ? 'auto' : 'none',
            }}
          >
            <div className="fnav-pill">{n.icon}</div>
          </button>
        )
      })}
    </nav>
  )
}

export default function App() {
  const [page, setPage]         = useState<Page>('dashboard')
  const [material, setMaterial] = useState<any>(null)
  const [theme, setTheme]       = useState<Theme>(() =>
    (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
  )

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('shh_theme', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const isHome = page === 'dashboard'

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div className="app">
        <div className={isHome ? 'main-home' : 'main'} key={page}>
          <div className="page-enter">
            {page === 'dashboard' && <Dashboard material={material} setPage={setPage} />}
            {page === 'library'   && <Library setMaterial={setMaterial} setPage={setPage} />}
            {page === 'chat'      && <Chat material={material} />}
            {page === 'pomodoro'  && <Pomodoro />}
            {page === 'settings'  && <Settings />}
          </div>
        </div>

        {/* Single source of truth for nav — never render inside page components */}
        <FloatingNav page={page} setPage={setPage} />
      </div>
    </ThemeCtx.Provider>
  )
}