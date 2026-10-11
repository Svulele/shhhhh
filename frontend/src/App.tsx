import { clearStudyDeviceData } from './localPrivacy'
import { useState, useEffect, useRef, createContext, useContext } from 'react'
import React from 'react'
import AuthGate, { recordStudyDay, markTourDone } from './AuthGate'
import type { User } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro, { TimerAlarm } from './pages/Pomodoro'
import Settings    from './pages/Settings'
import Flashcards  from './pages/Flashcards'
import StudyPlan   from './pages/Studyplan'
import Notes       from './pages/Notes'
import { registerSW } from './pwa'
import LegalPage, { type Policy } from './components/legal/Legal'
import PrivacyTools from './components/legal/PrivacyTools'
import OnboardingTour from './pages/Onboardingtour'
import './App.css'
import './redesign.css'
import { initialTheme } from './theme'
import Navigation from './components/Navigation'
import TopBar from './components/TopBar'

export type Page  = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings' | 'flashcards' | 'plan' | 'notes'
export type Theme = 'dark' | 'light'

export const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export const UserCtx = createContext<{ user: User | null; recordStudy: () => void }>({ user: null, recordStudy: () => {} })
export const useUser = () => useContext(UserCtx)

// ── AppShell ──────────────────────────────────────────────────
function AppShell({
  user,
  doSignOut,
  initialTourDone,  // FIX: comes from AuthGate after Supabase check
}: {
  user: User | null
  doSignOut: () => void
  initialTourDone: boolean
}) {
  const [page, setPage]         = useState<Page>(() => { const saved=sessionStorage.getItem('shh_active_page'); return ['dashboard','library','chat','pomodoro','settings','flashcards','plan','notes'].includes(saved ?? '') ? saved as Page : 'dashboard' })
  const currentPage = useRef(page)
  useEffect(() => { currentPage.current = page; sessionStorage.setItem('shh_active_page',page) }, [page])
  useEffect(() => { if (import.meta.env.PROD) registerSW().catch(console.warn) }, [])
  const [navOpen, setNavOpen] = useState(false)
  useEffect(() => {
    const viewport=window.visualViewport
    const resize=()=>document.documentElement.style.setProperty('--viewport-height',`${viewport?.height || window.innerHeight}px`)
    resize();viewport?.addEventListener('resize',resize)
    return()=>{viewport?.removeEventListener('resize',resize);document.documentElement.style.removeProperty('--viewport-height')}
  },[])
  const [material, setMaterial] = useState<any>(null)
  const [readerModeActive, setReaderModeActive] = useState(false)
  const [tourRun, setTourRun]   = useState(0)
  const [theme, setTheme]       = useState<Theme>(() =>
    initialTheme()
  )

  // FIX: tour visibility driven purely by initialTourDone from Supabase,
  // not by polling localStorage. No interval needed.
  const [showTour, setShowTour] = useState(!initialTourDone)

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('shh_theme', next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])
  useEffect(() => { const media=window.matchMedia('(prefers-color-scheme: dark)'); const sync=()=>{if(!localStorage.getItem('shh_theme'))setTheme(media.matches?'dark':'light')}; media.addEventListener('change',sync); return()=>media.removeEventListener('change',sync) },[])

  useEffect(() => {
    const handler = (e: Event) => {
      const p = (e as CustomEvent).detail as Page
      if (['dashboard','library','chat','pomodoro','settings','flashcards','plan','notes'].includes(p)) navigate(p)
    }
    window.addEventListener('shh:goto', handler)
    return () => window.removeEventListener('shh:goto', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      setPage('dashboard')
      setReaderModeActive(false)
      setShowTour(true)
      setTourRun(run => run + 1)
    }
    window.addEventListener('shh:restart-tour', handler)
    return () => window.removeEventListener('shh:restart-tour', handler)
  }, [])

  const recordStudy = () => {
    if (user) recordStudyDay(user.id).catch(console.warn)
  }

  const navigate = (p: Page, keepMaterial = false) => {
    if (p === currentPage.current) { setNavOpen(false); return }
    if (!window.dispatchEvent(new Event('shh:before-leave', { cancelable: true }))) return
    if(p==='chat' && !keepMaterial)setMaterial(null)
    setPage(p)
    setNavOpen(false)
    if (p !== 'library') setReaderModeActive(false)
    if (p !== 'dashboard') recordStudy()
  }

  const guardedSignOut = () => {
    if (window.dispatchEvent(new Event('shh:before-leave', { cancelable: true }))) doSignOut()
  }

  // FIX: when tour is dismissed, save to Supabase immediately
  const handleTourDone = async () => {
    setShowTour(false)
    await markTourDone(user?.id)
  }

  const isHome = page === 'dashboard'

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      <UserCtx.Provider value={{ user, recordStudy }}>
        <div className={`app ${isHome || navOpen ? 'sidebar-visible' : ''}`} data-page={page} data-reader={readerModeActive}>
          <main tabIndex={-1} id="main-content" className={isHome ? 'main-home' : 'main'} key={page}>
            <TopBar navigate={navigate} signOut={guardedSignOut} compact={page === 'pomodoro'} />
            <div className="page-enter">
              {page === 'dashboard'  && <Dashboard setPage={navigate} />}
              {page === 'library'    && <Library setMaterial={setMaterial} setPage={p=>navigate(p,true)} onReaderModeChange={setReaderModeActive} />}
              {page === 'chat'       && <Chat material={material} />}
              {page === 'pomodoro'   && <Pomodoro />}
              {page === 'settings'   && <Settings doSignOut={guardedSignOut} />}
              {page === 'flashcards' && <Flashcards />}
              {page === 'plan'       && <StudyPlan setPage={navigate} />}
              {page === 'notes'      && <Notes />}
            </div>
          </main>
          <Navigation page={page} navigate={navigate} signOut={guardedSignOut} open={navOpen} setOpen={setNavOpen} />
          <TimerAlarm />
          {/* FIX: tour only renders when showTour is true — no polling, no flicker */}
          {showTour && (
            <OnboardingTour
              key={tourRun}
              setPage={(p: Page) => navigate(p)}
              userId={user?.id}
              forceShow={tourRun > 0}
              onDone={handleTourDone}
            />
          )}
        </div>
      </UserCtx.Provider>
    </ThemeCtx.Provider>
  )
}

// ── Error boundary ────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(e: Error) { return { error: e } }
  render() {
    if (this.state.error) return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24, background:'var(--bg)' }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:24, color:'var(--text-1)' }}>Something went wrong</div>
        <div style={{ fontSize:13, color:'var(--text-3)', textAlign:'center', maxWidth:320, lineHeight:1.6 }}>{(this.state.error as Error).message}</div>
        <button onClick={()=>window.location.reload()} style={{ padding:'10px 28px', borderRadius:999, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', color:'var(--accent)', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:500 }}>Reload app</button>
      </div>
    )
    return this.props.children
  }
}

// ── Root ──────────────────────────────────────────────────────
export default function App() {
  const skipAuth = localStorage.getItem('shh_skip_auth') === '1'

  useEffect(() => {
    const t = initialTheme()
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('shh:goto', { detail: 'chat' }))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const policy = window.location.pathname.slice(1).replace(/\/$/, '')
  if (['privacy','terms','cookies','refunds'].includes(policy)) return <><PrivacyTools /><LegalPage policy={policy as Policy} /></>

  if (skipAuth) {
    return (
      <ErrorBoundary>
        <PrivacyTools />
        {/* No auth = tour always skipped for local users */}
        <AppShell user={null} doSignOut={() => { void clearStudyDeviceData().then(()=>window.location.reload()) }} initialTourDone={true} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <PrivacyTools />
      <AuthGate>
        {/* FIX: AuthGate now passes tourDone as third argument */}
        {(user, doSignOut, tourDone) => (
          <AppShell user={user} doSignOut={doSignOut} initialTourDone={tourDone} />
        )}
      </AuthGate>
    </ErrorBoundary>
  )
}
