import { useState, useEffect, useRef, createContext, useContext } from 'react'
import React from 'react'
import AuthGate, { recordStudyDay, markTourDone } from './AuthGate'
import type { User } from '@supabase/supabase-js'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro from './pages/Pomodoro'
import Settings    from './pages/Settings'
import Flashcards  from './pages/Flashcards'
import StudyPlan   from './pages/Studyplan'
import Notes       from './pages/Notes'
import { registerSW } from './pwa'
import { submitFeedback } from './supabase'
import OnboardingTour from './pages/Onboardingtour'
import { timerStore } from './timerStore'
import type { TimerState } from './timerStore'
import './App.css'

export type Page  = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings' | 'flashcards' | 'plan' | 'notes'
export type Theme = 'dark' | 'light'

export const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeCtx)

export const UserCtx = createContext<{ user: User | null; recordStudy: () => void }>({ user: null, recordStudy: () => {} })
export const useUser = () => useContext(UserCtx)

export const NAV: { page: Page; icon: React.ReactNode }[] = [
  { page: 'dashboard',  icon: <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { page: 'plan',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/></svg> },
  { page: 'library',    icon: <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
  { page: 'chat',       icon: <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { page: 'flashcards', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/></svg> },
  { page: 'notes',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  { page: 'pomodoro',   icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
  { page: 'settings',   icon: <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
]

const NAV_LABELS: Record<string, string> = {
  dashboard: 'Home', library: 'Library', chat: 'Chat',
  flashcards: 'Cards', pomodoro: 'Focus', plan: 'Plan',
  notes: 'Notes', settings: 'Me',
}

function FloatingNav({ page, setPage, keepOpen = false }: { page: Page; setPage: (p: Page) => void; keepOpen?: boolean }) {
  const isHome  = page === 'dashboard'
  const [open, setOpen] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
    if (!isHome && !keepOpen) timer.current = setTimeout(() => setOpen(false), 1800)
  }, [isHome, keepOpen, page])

  const enter = () => { if (timer.current) clearTimeout(timer.current); setOpen(true) }
  const leave = () => {
    if (isHome || keepOpen) return
    timer.current = setTimeout(() => setOpen(false), 650)
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className={`float-nav-wrap ${isHome || keepOpen ? 'home' : ''} ${open ? 'open' : 'asleep'}`} onMouseEnter={enter} onMouseLeave={leave}>
      {!isHome && !keepOpen && (
        <button className="float-nav-peek" onClick={enter} aria-label="Show navigation">
          <span />
        </button>
      )}
      <nav className="float-nav" aria-label="Main navigation">
        {NAV.map(n => {
          const active = n.page === page
          return (
            <button
              key={n.page}
              data-tour={n.page}
              className={`float-nav-item ${active ? 'active' : ''}`}
              onClick={() => {
                setPage(n.page)
                if (!isHome && !keepOpen) {
                  if (timer.current) clearTimeout(timer.current)
                  timer.current = setTimeout(() => setOpen(false), 650)
                }
              }}
              aria-label={NAV_LABELS[n.page]}
              title={NAV_LABELS[n.page]}
            >
              <div className="fnav-pill">
                {n.icon}
                <span className="fnav-label">{NAV_LABELS[n.page]}</span>
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

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
  const [page, setPage]         = useState<Page>('dashboard')
  const [material, setMaterial] = useState<any>(null)
  const [readerModeActive, setReaderModeActive] = useState(false)
  const [tourRun, setTourRun]   = useState(0)
  const [theme, setTheme]       = useState<Theme>(() =>
    (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
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

  useEffect(() => {
    const handler = (e: Event) => {
      const p = (e as CustomEvent).detail as Page
      if (p) navigate(p)
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

  const navigate = (p: Page) => {
    setPage(p)
    if (p !== 'library') setReaderModeActive(false)
    if (p !== 'dashboard') recordStudy()
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
        <div className="app">
          <div className={isHome ? 'main-home' : 'main'} key={page}>
            <div className="page-enter">
              {page === 'dashboard'  && <Dashboard setPage={navigate} />}
              {page === 'library'    && <Library setMaterial={setMaterial} setPage={navigate} onReaderModeChange={setReaderModeActive} />}
              {page === 'chat'       && <Chat material={material} />}
              {page === 'pomodoro'   && <Pomodoro />}
              {page === 'settings'   && <Settings doSignOut={doSignOut} />}
              {page === 'flashcards' && <Flashcards />}
              {page === 'plan'       && <StudyPlan setPage={navigate} />}
              {page === 'notes'      && <Notes />}
            </div>
          </div>
          <FloatingNav page={page} setPage={navigate} keepOpen={readerModeActive} />
          <MiniTimer currentPage={page} setPage={navigate} />
          <FeedbackButton />
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

// ── Mini timer pill ───────────────────────────────────────────
function MiniTimer({ currentPage, setPage }: { currentPage: Page; setPage: (p: Page) => void }) {
  const [t, setT] = useState<TimerState>(timerStore.get)
  useEffect(() => { return timerStore.subscribe(setT) }, [])

  if (!t.running || currentPage === 'pomodoro') return null

  const { mm, ss, pct } = timerStore.fmt()
  const isWork  = t.mode === 'work'
  const accent  = isWork ? 'var(--accent)' : 'var(--green)'
  const glow    = isWork ? 'var(--accent-glow)' : 'var(--green-glow)'
  const circ    = 2 * Math.PI * 13

  return (
    <div onClick={() => setPage('pomodoro')} style={{ position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)', zIndex:998, display:'flex', alignItems:'center', gap:10, padding:'8px 16px 8px 10px', borderRadius:999, background:'var(--nav-bg)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)', border:`1px solid ${isWork?'rgba(99,140,245,0.3)':'rgba(62,207,160,0.3)'}`, boxShadow:`0 4px 24px ${glow}, var(--nav-shadow)`, cursor:'pointer', animation:'toastIn .35s var(--spring) both', userSelect:'none', touchAction:'manipulation' }}>
      <svg width="30" height="30" viewBox="0 0 30 30" style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
        <circle cx="15" cy="15" r="13" fill="none" stroke="var(--text-4)" strokeWidth="2.5"/>
        <circle cx="15" cy="15" r="13" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} style={{ transition:'stroke-dashoffset 1s linear', filter:`drop-shadow(0 0 4px ${glow})` }}/>
      </svg>
      <div style={{ fontFamily:'var(--font-display)', fontSize:18, letterSpacing:'-0.8px', color:'var(--text-1)', lineHeight:1 }}>
        {mm}<span style={{ opacity:0.3, fontSize:14 }}>:</span>{ss}
      </div>
      <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:accent, fontWeight:500 }}>
        {isWork?'Focus':'Break'}
      </div>
      <button onClick={e=>{e.stopPropagation();timerStore.toggle()}} style={{ width:28, height:28, borderRadius:'50%', border:`0.5px solid ${isWork?'rgba(99,140,245,0.3)':'rgba(62,207,160,0.3)'}`, background:'transparent', color:accent, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'manipulation', flexShrink:0 }}>
        {t.running
          ? <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="5" height="18" rx="1"/><rect x="14" y="3" width="5" height="18" rx="1"/></svg>
          : <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        }
      </button>
    </div>
  )
}

// ── Feedback button ───────────────────────────────────────────
function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      const profile = (() => { try { return JSON.parse(localStorage.getItem('shh_profile')??'{}') } catch { return {} } })()
      await submitFeedback(text.trim(), profile.name)
    } catch {}
    setSent(true); setBusy(false)
    setTimeout(() => { setSent(false); setText(''); setOpen(false) }, 2000)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ position:'fixed', bottom:92, right:16, zIndex:990, display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:999, background:'var(--bg-card)', border:'0.5px solid var(--border)', color:'var(--text-3)', fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)', backdropFilter:'blur(16px)', boxShadow:'0 4px 16px rgba(0,0,0,.12)', transition:'all .2s' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Feedback
      </button>
      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'flex-end', justifyContent:'flex-end', padding:'0 16px 110px', pointerEvents:'none' }}>
          <div style={{ width:320, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:20, padding:'20px 20px 16px', pointerEvents:'auto', boxShadow:'0 16px 48px rgba(0,0,0,.2)', backdropFilter:'blur(24px)', animation:'pageUp .25s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>Send feedback</div>
              <button onClick={()=>setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', display:'flex', padding:2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {sent ? (
              <div style={{ textAlign:'center', padding:'16px 0', color:'var(--green)', fontSize:14 }}>✓ Thanks! Your feedback helps a lot.</div>
            ) : (
              <>
                <textarea value={text} onChange={e=>setText(e.target.value)} rows={4} placeholder="What's working? What's broken? What would you love to see?" style={{ fontSize:13, resize:'none', marginBottom:10, borderRadius:10 }}/>
                <button onClick={submit} disabled={!text.trim()||busy} style={{ width:'100%', padding:'9px', borderRadius:10, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:13, fontWeight:500, cursor:(!text.trim()||busy)?'default':'pointer', fontFamily:'var(--font-body)', opacity:(!text.trim()||busy)?.5:1, transition:'all .2s' }}>
                  {busy?'Sending…':'Send feedback'}
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
    const t = (localStorage.getItem('shh_theme') as Theme) ?? 'dark'
    document.documentElement.setAttribute('data-theme', t)
    registerSW().catch(console.warn)
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

  if (skipAuth) {
    return (
      <ErrorBoundary>
        {/* No auth = tour always skipped for local users */}
        <AppShell user={null} doSignOut={() => { localStorage.removeItem('shh_skip_auth'); window.location.reload() }} initialTourDone={true} />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <AuthGate>
        {/* FIX: AuthGate now passes tourDone as third argument */}
        {(user, doSignOut, tourDone) => (
          <AppShell user={user} doSignOut={doSignOut} initialTourDone={tourDone} />
        )}
      </AuthGate>
    </ErrorBoundary>
  )
}
