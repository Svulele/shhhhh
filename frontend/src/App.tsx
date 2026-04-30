import { useState, useEffect, useRef, createContext, useContext } from 'react'
import React from 'react'
import AuthGate, { recordStudyDay } from './AuthGate'
import type { User } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro from './pages/Pomodoro'
import Settings    from './pages/Settings'
import Flashcards  from './pages/Flashcards'
import StudyPlan   from './pages/StudyPlan'
import { registerSW } from './pwa'
import { submitFeedback } from './supabase'
import OnboardingTour from './pages/OnboardingTour'
import './App.css'

export type Page  = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings' | 'flashcards' | 'plan'
export type Theme = 'dark' | 'light'

export const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

// User context — pages use this to record study activity
export const UserCtx = createContext<{ user: User | null; recordStudy: () => void }>({ user: null, recordStudy: () => {} })
export const useUser = () => useContext(UserCtx)

export const NAV: { page: Page; icon: React.ReactNode }[] = [
  { page: 'dashboard',  icon: <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { page: 'plan',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg> },
  { page: 'library',    icon: <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
  { page: 'chat',       icon: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { page: 'flashcards', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/></svg> },
  { page: 'pomodoro',   icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
  { page: 'settings',   icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
]

function FloatingNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const isHome = page === 'dashboard'
  const [hov, setHov] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const enter = () => { if (isHome) return; if (timer.current) clearTimeout(timer.current); setHov(true) }
  const leave = () => { if (isHome) return; timer.current = setTimeout(() => setHov(false), 350) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const expanded = isHome || hov

  return (
    <nav className="float-nav" onMouseEnter={enter} onMouseLeave={leave}>
      {NAV.map(n => {
        const active  = n.page === page
        const visible = expanded || active
        return (
          <button key={n.page}
            data-tour={n.page}
            className={`float-nav-item${active ? ' active' : ''}`}
            onClick={() => { setPage(n.page); if (!isHome) setHov(false) }}
            style={{
              maxWidth: visible ? 52 : 0,
              opacity: visible ? 1 : 0,
              overflow: 'hidden', padding: 0,
              transition: 'max-width 0.32s cubic-bezier(0.34,1.2,0.64,1), opacity 0.22s ease',
              pointerEvents: visible ? 'auto' : 'none',
            }}>
            <div className="fnav-pill">{n.icon}</div>
          </button>
        )
      })}
    </nav>
  )
}

function AppShell({ user, doSignOut }: { user: User | null; doSignOut: () => void }) {
  const [page, setPage]         = useState<Page>('dashboard')
  const [material, setMaterial] = useState<any>(null)
  const [showTour, setShowTour] = useState(false)
  const [theme, setTheme]       = useState<Theme>(() =>
    (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
  )

  // Show tour after onboarding — poll for onboarded flag
  useEffect(() => {
    const check = () => {
      try {
        const p = JSON.parse(localStorage.getItem('shh_profile') ?? '{}')
        if (p?.onboarded && !localStorage.getItem('shh_tour_done')) {
          setShowTour(true)
        }
      } catch {}
    }
    check()
    const iv = setInterval(check, 500)
    return () => clearInterval(iv)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('shh_theme', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Listen for Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail as Page
      if (page) navigate(page)
    }
    window.addEventListener('shh:goto', handler)
    return () => window.removeEventListener('shh:goto', handler)
  }, [])

  // Record study activity whenever user navigates to an active page
  const recordStudy = () => {
    if (user) recordStudyDay(user.id).catch(console.warn)
  }

  const navigate = (p: Page) => {
    setPage(p)
    if (p !== 'dashboard') recordStudy()
  }

  const isHome = page === 'dashboard'

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <UserCtx.Provider value={{ user, recordStudy }}>
        <div className="app">
          <div className={isHome ? 'main-home' : 'main'} key={page}>
            <div className="page-enter">
              {page === 'dashboard'  && <Dashboard material={material} setPage={navigate} />}
              {page === 'library'    && <Library setMaterial={setMaterial} setPage={navigate} />}
              {page === 'chat'       && <Chat material={material} />}
              {page === 'pomodoro'   && <Pomodoro />}
              {page === 'settings'   && <Settings doSignOut={doSignOut} />}
              {page === 'flashcards' && <Flashcards />}
              {page === 'plan'       && <StudyPlan setPage={navigate} />}
            </div>
          </div>
          <FloatingNav page={page} setPage={navigate} />
          <FeedbackButton />
          {showTour && (
            <OnboardingTour
              setPage={(p) => { navigate(p); }}
              onDone={() => setShowTour(false)}
            />
          )}
        </div>
      </UserCtx.Provider>
    </ThemeCtx.Provider>
  )
}

// ── Floating feedback button ──────────────────────────────────
function FeedbackButton() {
  const [open, setOpen]   = useState(false)
  const [text, setText]   = useState('')
  const [sent, setSent]   = useState(false)
  const [busy, setBusy]   = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setBusy(true)
    // Send to a simple endpoint — or just log to console for now
    // In production wire this to your backend or a service like Formspree
    try {
      const profile = (() => { try { return JSON.parse(localStorage.getItem('shh_profile')??'{}') } catch { return {} } })()
      await submitFeedback(text.trim(), profile.name)
    } catch {}
    setSent(true); setBusy(false)
    setTimeout(() => { setSent(false); setText(''); setOpen(false) }, 2000)
  }

  return (
    <>
      {/* Trigger pill */}
      <button onClick={() => setOpen(true)}
        style={{
          position:'fixed', bottom:92, right:16, zIndex:990,
          display:'flex', alignItems:'center', gap:6,
          padding:'7px 14px', borderRadius:999,
          background:'var(--bg-card)', border:'0.5px solid var(--border)',
          color:'var(--text-3)', fontSize:11, cursor:'pointer',
          fontFamily:'var(--font-body)', backdropFilter:'blur(16px)',
          boxShadow:'0 4px 16px rgba(0,0,0,.12)',
          transition:'all .2s',
        }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Feedback
      </button>

      {/* Modal */}
      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:'0 16px 110px', pointerEvents:'none' }}>
          <div style={{
            width:320, background:'var(--bg-card)', border:'0.5px solid var(--border)',
            borderRadius:20, padding:'20px 20px 16px', pointerEvents:'auto',
            boxShadow:'0 16px 48px rgba(0,0,0,.2)', backdropFilter:'blur(24px)',
            animation:'pageUp .25s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>Send feedback</div>
              <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', display:'flex', padding:2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {sent ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--green)', fontSize:14 }}>
                ✓ Thanks! Your feedback helps a lot.
              </div>
            ) : (
              <>
                <textarea value={text} onChange={e=>setText(e.target.value)} rows={4}
                  placeholder="What's working? What's broken? What would you love to see?"
                  style={{ fontSize:13, resize:'none', marginBottom:10, borderRadius:10 }}/>
                <button onClick={submit} disabled={!text.trim()||busy}
                  style={{ width:'100%', padding:'9px', borderRadius:10, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:13, fontWeight:500, cursor:(!text.trim()||busy)?'default':'pointer', fontFamily:'var(--font-body)', opacity:(!text.trim()||busy)?.5:1, transition:'all .2s' }}>
                  {busy ? 'Sending…' : 'Send feedback'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Error boundary ────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24, background:'var(--bg)' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:24, color:'var(--text-1)' }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', maxWidth:320, lineHeight:1.6 }}>
          {(this.state.error as Error).message}
        </div>
        <button onClick={()=>window.location.reload()}
          style={{ padding:'10px 28px', borderRadius:999, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:500 }}>
          Reload app
        </button>
      </div>
    )
    return this.props.children
  }
}

export default function App() {
  const skipAuth = localStorage.getItem('shh_skip_auth') === '1'

  useEffect(() => {
    const t = (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
    document.documentElement.setAttribute('data-theme', t)
    registerSW().catch(console.warn)
  }, [])

  // Cmd/Ctrl+K → jump to chat from anywhere
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Dispatch a custom event that AppShell listens to
        window.dispatchEvent(new CustomEvent('shh:goto', { detail: 'chat' }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (skipAuth) {
    return (
      <ErrorBoundary>
        <AppShell user={null} doSignOut={() => { localStorage.removeItem('shh_skip_auth'); window.location.reload() }} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AuthGate>
        {(user, doSignOut) => <AppShell user={user} doSignOut={doSignOut} />}
      </AuthGate>
    </ErrorBoundary>
  )
}