import { useState, useEffect } from 'react'
import type { Page } from '../App'

const TOUR_KEY = 'shh_tour_done'

interface TourStep {
  page: Page | null        // navigate here when step advances (null = stay on home)
  anchor: string | null    // data-tour attribute to spotlight
  emoji: string
  title: string
  body: string
  cta: string
}

const STEPS: TourStep[] = [
  {
    page: null, anchor: null,
    emoji: '👋',
    title: "Welcome to Shhhhh",
    body: "Your personal AI study buddy. It reads with you, quizzes you, and actually remembers you across sessions. Take a 30-second tour.",
    cta: "Show me around →",
  },
  {
    page: 'library', anchor: 'library',
    emoji: '📚',
    title: "Your Library",
    body: "Upload any PDF — textbooks, notes, articles. Read it in clean ebook mode or original PDF. The AI always knows which page you're on.",
    cta: "Got it",
  },
  {
    page: 'chat', anchor: 'chat',
    emoji: '🤖',
    title: "Ask the AI",
    body: "Ask anything about what you're studying. No need to explain — it already knows your book and page. It also remembers things about you over time.",
    cta: "Nice",
  },
  {
    page: 'flashcards', anchor: 'flashcards',
    emoji: '🃏',
    title: "Auto Flashcards",
    body: "Cards are automatically created from every reading session. Rate them Hard, Okay, or Easy — the app decides when to show them again.",
    cta: "Smart",
  },
  {
    page: 'pomodoro', anchor: 'pomodoro',
    emoji: '⏱',
    title: "Focus Timer",
    body: "Pomodoro sessions with ambient sounds — rain, forest, café, white noise. All in-browser. A bell plays when time is up.",
    cta: "Let's go",
  },
  {
    page: 'plan', anchor: 'plan',
    emoji: '📅',
    title: "Daily Plan",
    body: "Every morning the AI builds a personalised study plan from your books, cards due, and study time this week. Tap any task to jump to it.",
    cta: "Start studying →",
  },
]

// ── Get position of a data-tour element ───────────────────────
function getSpotlight(anchor: string | null) {
  if (!anchor) return null
  const el = document.querySelector(`[data-tour="${anchor}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

// ── Main ──────────────────────────────────────────────────────
export default function OnboardingTour({ setPage, onDone }: { setPage: (p: Page) => void; onDone?: () => void }) {
  const [step,       setStep]       = useState(0)
  const [visible,    setVisible]    = useState(false)
  const [exiting,    setExiting]    = useState(false)
  const [spotlight,  setSpotlight]  = useState<{ top:number; left:number; width:number; height:number } | null>(null)

  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY)) return
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [])

  // Update spotlight whenever step changes — poll briefly for DOM readiness
  useEffect(() => {
    if (!visible) return
    const current = STEPS[step]
    let attempts = 0
    const poll = setInterval(() => {
      const s = getSpotlight(current.anchor)
      if (s) { setSpotlight(s); clearInterval(poll) }
      if (++attempts > 30) { setSpotlight(null); clearInterval(poll) }
    }, 100)
    // Also update on resize
    const onResize = () => setSpotlight(getSpotlight(current.anchor))
    window.addEventListener('resize', onResize)
    return () => { clearInterval(poll); window.removeEventListener('resize', onResize) }
  }, [step, visible])

  if (!visible) return null

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1
  const PAD     = 12

  const advance = () => {
    if (isLast) { dismiss(); return }
    setExiting(true)
    setTimeout(() => {
      const next = STEPS[step + 1]
      if (next.page) setPage(next.page)
      setStep(s => s + 1)
      setExiting(false)
      setSpotlight(null) // clear old spotlight while new page loads
    }, 220)
  }

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(TOUR_KEY, '1')
      onDone?.()
    }, 220)
  }

  const progress = ((step + 1) / STEPS.length) * 100
  const W = window.innerWidth
  const H = window.innerHeight

  // Card position: centre on step 0, otherwise above/below spotlight
  let cardStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9993,
    width: 'clamp(300px,90vw,390px)',
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border)',
    borderRadius: 24,
    padding: '22px 22px 18px',
    boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 0.5px rgba(255,255,255,.06)',
    backdropFilter: 'blur(32px)',
    animation: exiting
      ? 'tourOut .2s var(--ease-in-out) both'
      : 'tourIn .32s var(--ease-out) both',
  }

  if (!spotlight || !current.anchor) {
    // Centre of screen
    cardStyle = { ...cardStyle, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  } else {
    const spCx   = spotlight.left + spotlight.width / 2
    const cardW  = Math.min(390, W * 0.9)
    const cardL  = Math.max(16, Math.min(spCx - cardW / 2, W - cardW - 16))
    const spBot  = spotlight.top + spotlight.height + PAD
    const spTop  = spotlight.top - PAD

    // Try to place below; if not enough room place above
    if (spBot + 180 < H) {
      cardStyle = { ...cardStyle, top: spBot + 10, left: cardL }
    } else {
      cardStyle = { ...cardStyle, bottom: H - spTop + 10, left: cardL }
    }
  }

  return (
    <>
      {/* ── SVG overlay with spotlight cutout ── */}
      <svg
        style={{ position:'fixed', inset:0, width:'100%', height:'100%', zIndex:9991, pointerEvents:'none' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id="shh-spotlight-mask">
            <rect width="100%" height="100%" fill="white"/>
            {spotlight && (
              <rect
                x={spotlight.left - PAD}
                y={spotlight.top  - PAD}
                width={spotlight.width  + PAD * 2}
                height={spotlight.height + PAD * 2}
                rx={14}
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Dimmed overlay */}
        <rect
          width="100%" height="100%"
          fill="rgba(0,0,0,0.68)"
          mask="url(#shh-spotlight-mask)"
          style={{ transition: 'opacity .3s ease' }}
        />

        {/* Spotlight accent border + glow */}
        {spotlight && (
          <rect
            x={spotlight.left - PAD}
            y={spotlight.top  - PAD}
            width={spotlight.width  + PAD * 2}
            height={spotlight.height + PAD * 2}
            rx={14}
            fill="none"
            stroke="rgba(99,140,245,0.7)"
            strokeWidth="1.5"
            style={{ filter:'drop-shadow(0 0 10px rgba(99,140,245,0.5))' }}
          />
        )}
      </svg>

      {/* Click backdrop to skip */}
      <div onClick={dismiss} style={{ position:'fixed', inset:0, zIndex:9992, cursor:'pointer' }}/>

      {/* ── Tour card ── */}
      <div style={{ ...cardStyle, pointerEvents:'auto' }} onClick={e => e.stopPropagation()}>

        {/* Progress bar */}
        <div style={{ height:2, background:'var(--text-4)', borderRadius:99, overflow:'hidden', marginBottom:18 }}>
          <div style={{ height:'100%', borderRadius:99, background:'linear-gradient(90deg,var(--accent),#b07ef7)', width:`${progress}%`, transition:'width .35s var(--ease-out)' }}/>
        </div>

        {/* Content */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:13, marginBottom:18 }}>
          <div style={{ width:42, height:42, borderRadius:12, flexShrink:0, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21 }}>
            {current.emoji}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:500, color:'var(--text-1)', marginBottom:5, letterSpacing:'-0.2px' }}>
              {current.title}
            </div>
            <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:300, lineHeight:1.65 }}>
              {current.body}
            </div>
          </div>
        </div>

        {/* Dot indicators + buttons */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Step dots */}
          <div style={{ display:'flex', gap:5 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                height:5, borderRadius:99,
                background: i === step ? 'var(--accent)' : 'var(--text-4)',
                width: i === step ? 18 : 5,
                transition:'width .3s var(--spring), background .3s ease',
              }}/>
            ))}
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={dismiss} style={{ padding:'7px 13px', borderRadius:999, fontSize:12, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-3)', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .18s' }}>
              Skip
            </button>
            <button onClick={advance} style={{ padding:'7px 18px', borderRadius:999, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', fontFamily:'var(--font-body)', background:'linear-gradient(135deg,var(--accent),#7b6cf6)', color:'white', boxShadow:'0 4px 14px var(--accent-glow)', transition:'all .2s' }}>
              {current.cta}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourIn  { from { opacity:0; transform:translateY(14px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes tourOut { from { opacity:1; transform:translateY(0) scale(1); }       to { opacity:0; transform:translateY(8px) scale(0.97); } }
      `}</style>
    </>
  )
}