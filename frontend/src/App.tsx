import { useState, useEffect, createContext, useContext } from 'react'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro from './pages/Pomodoro'
import Settings from './pages/Settings'
import './App.css'

export type Page = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings'
export type Theme = 'dark' | 'light'

// ─── Theme context ───────────────────────────────────────────
export const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark', toggle: () => {}
})
export const useTheme = () => useContext(ThemeCtx)

// ─── Nav icons ────────────────────────────────────────────────
const NAV: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'dashboard', label: 'Home', icon:
    <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { page: 'library', label: 'Library', icon:
    <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
  { page: 'chat', label: 'AI', icon:
    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { page: 'pomodoro', label: 'Focus', icon:
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
  { page: 'settings', label: 'Me', icon:
    <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
]

// ─── Sidebar (non-home pages) ─────────────────────────────────
function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">Sh</div>
      {NAV.map(n => (
        <button key={n.page} className={`sidebar-btn${page === n.page ? ' active' : ''}`}
          onClick={() => setPage(n.page)} title={n.label}>
          {n.icon}
        </button>
      ))}
      <div className="sidebar-spacer" />
    </nav>
  )
}

// ─── Floating nav (home page) ─────────────────────────────────
function FloatingNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav className="float-nav">
      {NAV.map(n => (
        <button key={n.page} className={`float-nav-item${page === n.page ? ' active' : ''}`}
          onClick={() => setPage(n.page)}>
          <div className="fnav-pill">{n.icon}</div>
          <span>{n.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ─── App root ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage]       = useState<Page>('dashboard')
  const [material, setMaterial] = useState<any>(null)
  const [theme, setTheme]     = useState<Theme>(() => {
    return (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
  })

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('shh_theme', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const isHome = page === 'dashboard'

  const navigate = (p: Page) => setPage(p)

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <div className="app">
        {!isHome && <Sidebar page={page} setPage={navigate} />}

        <div className={isHome ? 'main-home' : 'main'} key={page}>
          <div className="page-enter">
            {page === 'dashboard' && <Dashboard material={material} setPage={navigate} />}
            {page === 'library'   && <Library setMaterial={setMaterial} setPage={navigate} />}
            {page === 'chat'      && <Chat material={material} />}
            {page === 'pomodoro'  && <Pomodoro />}
            {page === 'settings'  && <Settings />}
          </div>
        </div>

        {isHome && <FloatingNav page={page} setPage={navigate} />}
      </div>
    </ThemeCtx.Provider>
  )
}