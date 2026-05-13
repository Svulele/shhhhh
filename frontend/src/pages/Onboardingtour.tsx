import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'
import { supabase } from '../supabase'

const TOUR_KEY = 'shh_tour_done' // local fallback

interface TourStep {
  page: Page | null
  anchor: string | null
  icon: string
  kicker: string
  title: string
  body: string
  bullets?: string[]
  cta: string
}

const STEPS: TourStep[] = [
  {
    page: null, anchor: null,
    icon: 'S',
    kicker: 'First time here',
    title: 'Welcome to Shhhhh',
    body: 'This is your study room: books, focus sessions, AI help, notes, flashcards, and daily planning in one place.',
    bullets: ['Start by adding one PDF', 'Read a few pages', 'Let the app turn that work into review'],
    cta: 'Set up my space',
  },
  {
    page: 'library', anchor: 'library',
    icon: '1',
    kicker: 'Step one',
    title: 'Add your first book',
    body: 'The Library is where textbooks, notes, articles, and slides live. Drop in a PDF and Shhhhh remembers your place automatically.',
    bullets: ['PDFs stay in your browser storage', 'Progress is saved page by page', 'Books in progress appear on your dashboard'],
    cta: 'Next',
  },
  {
    page: 'library', anchor: null,
    icon: '2',
    kicker: 'While reading',
    title: 'Use reader mode',
    body: 'Open a book to enter reader mode. You can switch between original PDF view and a cleaner reading view, then mark the session done when you finish.',
    bullets: ['Use the arrows or keyboard to move pages', 'Open notes without leaving the book', 'The app uses your current page as study context'],
    cta: 'Show me AI help',
  },
  {
    page: 'chat', anchor: 'chat',
    icon: '3',
    kicker: 'Ask anything',
    title: 'Chat with your study context',
    body: 'Use Chat when you want an explanation, example question, summary, or study strategy. If you came from a book, the app carries that reading context with you.',
    bullets: ['Ask for simpler explanations', 'Turn confusing sections into examples', 'Jump from a recap question straight into chat'],
    cta: 'Next',
  },
  {
    page: 'flashcards', anchor: 'flashcards',
    icon: '4',
    kicker: 'Remember it',
    title: 'Review with flashcards',
    body: 'Flashcards help you come back to what matters. Rate cards as Hard, Okay, or Easy and Shhhhh spaces them out for future review.',
    bullets: ['Hard cards return sooner', 'Easy cards disappear for longer', 'Review mode keeps the session focused'],
    cta: 'Keep going',
  },
  {
    page: 'plan', anchor: 'plan',
    icon: '5',
    kicker: 'Stay consistent',
    title: 'Follow the daily plan',
    body: 'The Plan page pulls together reading, flashcards, focus time, and weak areas so you always know what to do next.',
    bullets: ['Tap a task to jump into it', 'Use Pomodoro when you need a focused block', 'Your dashboard shows the bigger picture'],
    cta: 'Finish tour',
  },
]

function getSpotlight(anchor: string | null) {
  if (!anchor) return null
  const el = document.querySelector(`[data-tour="${anchor}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

// ── Mark tour done in Supabase + localStorage ─────────────────
async function markTourDone(userId?: string) {
  // Always save locally first (works offline / no-auth)
  localStorage.setItem(TOUR_KEY, '1')

  // Save to Supabase so it persists across devices
  if (userId && supabase) {
    try {
      await supabase
        .from('profiles')
        .update({ tour_done: true })
        .eq('id', userId)
    } catch (e) {
      console.warn('Could not save tour_done to Supabase:', e)
    }
  }
}

// ── Check if tour already done (local OR cloud) ───────────────
async function isTourDone(userId?: string): Promise<boolean> {
  // Local check first — fast
  if (localStorage.getItem(TOUR_KEY)) return true

  // Cloud check — catches new devices
  if (userId && supabase) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('tour_done')
        .eq('id', userId)
        .single()
      if (data?.tour_done) {
        // Sync to local so future checks are instant
        localStorage.setItem(TOUR_KEY, '1')
        return true
      }
    } catch {
      // If Supabase fails, fall through and show tour
    }
  }

  return false
}

export default function OnboardingTour({
  setPage,
  userId,
  forceShow = false,
  onDone,
}: {
  setPage: (p: Page) => void
  userId?: string       // pass the logged-in user's id from AuthGate
  forceShow?: boolean
  onDone?: () => void
}) {
  const [step,      setStep]      = useState(0)
  const [visible,   setVisible]   = useState(false)
  const [exiting,   setExiting]   = useState(false)
  const [spotlight, setSpotlight] = useState<{ top:number; left:number; width:number; height:number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (forceShow) {
      const t = setTimeout(() => setVisible(true), 120)
      return () => clearTimeout(t)
    }

    // Check both local + Supabase before showing
    isTourDone(userId).then(done => {
      if (done) return
      const t = setTimeout(() => setVisible(true), 900)
      return () => clearTimeout(t)
    })
  }, [userId, forceShow])

  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
      if (e.key === 'Enter') advance()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, step])

  // Poll for spotlight element after step/page change
  useEffect(() => {
    if (!visible) return
    if (pollRef.current) clearInterval(pollRef.current)

    const current = STEPS[step]
    if (!current.anchor) { setSpotlight(null); return }

    let attempts = 0
    pollRef.current = setInterval(() => {
      const s = getSpotlight(current.anchor)
      if (s) { setSpotlight(s); clearInterval(pollRef.current!) }
      if (++attempts > 40) { setSpotlight(null); clearInterval(pollRef.current!) }
    }, 100)

    const onResize = () => setSpotlight(getSpotlight(current.anchor))
    window.addEventListener('resize', onResize)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [step, visible])

  if (!visible) return null

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1
  const PAD     = 12

  const dismiss = () => {
    setExiting(true)
    setTimeout(async () => {
      setVisible(false)
      await markTourDone(userId)
      onDone?.()
    }, 220)
  }

  const advance = () => {
    if (isLast) { dismiss(); return }
    setExiting(true)
    setTimeout(() => {
      const next = STEPS[step + 1]
      if (next.page) setPage(next.page)
      setStep(s => s + 1)
      setExiting(false)
      setSpotlight(null)
    }, 220)
  }

  const goBack = () => {
    if (step === 0) return
    setExiting(true)
    setTimeout(() => {
      const prev = STEPS[step - 1]
      if (prev.page) setPage(prev.page)
      setStep(s => s - 1)
      setExiting(false)
      setSpotlight(null)
    }, 220)
  }

  const progress = ((step + 1) / STEPS.length) * 100
  const W = window.innerWidth
  const H = window.innerHeight

  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9993,
    width: 'clamp(300px,90vw,390px)',
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 22,
    padding: '20px 20px 18px',
    boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 0.5px rgba(255,255,255,.06)',
    backdropFilter: 'blur(32px)',
    animation: exiting ? 'tourOut .2s ease both' : 'tourIn .28s ease both',
  }

  if (!spotlight || !current.anchor) {
    cardStyle = { ...cardStyle, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  } else {
    const spCx  = spotlight.left + spotlight.width / 2
    const cardW = Math.min(390, W * 0.9)
    const cardL = Math.max(16, Math.min(spCx - cardW / 2, W - cardW - 16))
    const spBot = spotlight.top + spotlight.height + PAD
    const spTop = spotlight.top - PAD

    if (spBot + 280 < H) {
      cardStyle = { ...cardStyle, top: spBot + 10, left: cardL }
    } else {
      cardStyle = { ...cardStyle, bottom: H - spTop + 10, left: cardL }
    }
  }

  return (
    <>
      <svg
        style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:9991, pointerEvents:'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="shh-spotlight-mask">
            <rect width="100%" height="100%" fill="white"/>
            {spotlight && (
              <rect
                x={spotlight.left - PAD} y={spotlight.top - PAD}
                width={spotlight.width + PAD * 2} height={spotlight.height + PAD * 2}
                rx={14} fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.68)" mask="url(#shh-spotlight-mask)" style={{ transition:'opacity .3s ease' }}/>
        {spotlight && (
          <rect
            x={spotlight.left - PAD} y={spotlight.top - PAD}
            width={spotlight.width + PAD * 2} height={spotlight.height + PAD * 2}
            rx={14} fill="none"
            stroke="rgba(99,140,245,0.7)" strokeWidth="1.5"
            style={{ filter:'drop-shadow(0 0 10px rgba(99,140,245,0.5))' }}
          />
        )}
      </svg>

      <div onClick={dismiss} style={{ position:'fixed', inset:0, zIndex:9992, cursor:'pointer' }}/>

      <div style={{ ...cardStyle, pointerEvents:'auto' }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="App tour">
        <div style={{ height:2, background:'var(--text-4)', borderRadius:99, overflow:'hidden', marginBottom:18 }}>
          <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,var(--accent),#b07ef7)', width:`${progress}%`, transition:'width .35s ease' }}/>
        </div>

        <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
          <div style={{ width:42, height:42, borderRadius:12, flexShrink:0, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'0.5px solid var(--border-active)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:17, fontWeight:600, fontFamily:'var(--font-display)', boxShadow:'0 8px 24px var(--accent-glow)' }}>
            {current.icon}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'1.6px', color:'var(--accent)', fontWeight:600, marginBottom:6 }}>
              {current.kicker}
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:500, color:'var(--text-1)', marginBottom:7, letterSpacing:'-0.4px', lineHeight:1.15 }}>
              {current.title}
            </div>
            <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:300, lineHeight:1.6 }}>
              {current.body}
            </div>
          </div>
        </div>

        {current.bullets && (
          <div style={{ display:'grid', gap:7, margin:'0 0 18px 56px' }}>
            {current.bullets.map(item => (
              <div key={item} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--text-2)', lineHeight:1.45 }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'var(--accent)', marginTop:6, flexShrink:0, boxShadow:'0 0 10px var(--accent-glow)' }}/>
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:5 }} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height:5, borderRadius:99,
                background: i === step ? 'var(--accent)' : 'var(--text-4)',
                width: i === step ? 18 : 5,
                transition:'width .3s ease, background .3s ease',
              }}/>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {step > 0 && (
              <button onClick={goBack} style={{ padding:'7px 10px', borderRadius:999, fontSize:12, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-3)', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .18s' }}>
                Back
              </button>
            )}
            <button onClick={dismiss} style={{ padding:'7px 10px', borderRadius:999, fontSize:12, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-3)', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .18s' }}>
              Skip
            </button>
            <button onClick={advance} style={{ padding:'7px 16px', borderRadius:999, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'var(--font-body)', background:'linear-gradient(135deg,var(--accent),#7b6cf6)', color:'white', boxShadow:'0 4px 14px var(--accent-glow)', transition:'all .2s' }}>
              {current.cta}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes tourOut { from { opacity:1; } to { opacity:0; } }
      `}</style>
    </>
  )
}
