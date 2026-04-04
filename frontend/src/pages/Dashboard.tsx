import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../App'
import type { Page } from '../App'

// ─── Types ───────────────────────────────────────────────────
interface Profile {
  name: string; ai: string; goals: string[]
  location: string; lat: number | null; lon: number | null
  onboarded: boolean
}
interface Weather { temp: number; condition: string }
interface StudySession { bookTitle: string; page: number; totalPages: number }

// ─── Quotes ──────────────────────────────────────────────────
const QUOTES = [
  { text: 'The more that you read, the more things you will know.', author: 'Dr. Seuss' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', author: 'Gandhi' },
  { text: 'The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.', author: 'Brian Herbert' },
  { text: 'Develop a passion for learning. If you do, you will never cease to grow.', author: 'Anthony J. D\'Angelo' },
]

// ─── Onboarding ──────────────────────────────────────────────
const AI_OPTIONS = [
  { id: 'claude',  label: 'Claude',  sub: 'by Anthropic' },
  { id: 'gpt4',    label: 'GPT-4',   sub: 'by OpenAI'    },
  { id: 'gemini',  label: 'Gemini',  sub: 'by Google'     },
  { id: 'llama',   label: 'LLaMA',   sub: 'Open source'  },
]
const GOAL_OPTIONS = ['Exams', 'Research', 'Personal growth', 'Language', 'Coding', 'Creative writing']

function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [ai, setAi]     = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [locStatus, setLocStatus] = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [coords, setCoords]   = useState<{ lat: number; lon: number } | null>(null)
  const [locName, setLocName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (step === 0) setTimeout(() => inputRef.current?.focus(), 300) }, [step])

  const toggleGoal = (g: string) =>
    setGoals(p => p.includes(g) ? p.filter(x => x !== g) : [...p, g])

  const requestLocation = () => {
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        setCoords({ lat, lon })
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const d = await r.json()
          setLocName(d.address?.city || d.address?.town || d.address?.state || 'your area')
        } catch { setLocName('your area') }
        setLocStatus('granted')
      },
      () => setLocStatus('denied')
    )
  }

  const finish = () => {
    const profile: Profile = {
      name, ai, goals, location: locName,
      lat: coords?.lat ?? null, lon: coords?.lon ?? null, onboarded: true,
    }
    localStorage.setItem('shh_profile', JSON.stringify(profile))
    onDone(profile)
  }

  const canNext = [name.trim().length > 0, ai.length > 0, goals.length > 0, true][step]

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        {/* Dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
          {[0,1,2,3].map(i => <div key={i} className={`step-dot${i <= step ? ' active' : ''}`} />)}
        </div>

        {step === 0 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Welcome</p>
            <p className="onboard-q">What should I call you?</p>
            <input ref={inputRef} placeholder="Your name…"
              style={{ fontSize: 20, fontWeight: 300, padding: '16px 20px' }}
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canNext && setStep(1)} />
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Your AI</p>
            <p className="onboard-q">Which AI will you study with?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {AI_OPTIONS.map(opt => (
                <button key={opt.id} className={`ai-card${ai === opt.id ? ' active' : ''}`} onClick={() => setAi(opt.id)}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-1)' }}>{opt.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 300 }}>{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Focus areas</p>
            <p className="onboard-q">What are you studying for?</p>
            <div className="goal-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {GOAL_OPTIONS.map(g => (
                <button key={g} className={`goal-chip${goals.includes(g) ? ' active' : ''}`} onClick={() => toggleGoal(g)}>{g}</button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Almost there</p>
            <p className="onboard-q">Can I see your location?</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 28, fontWeight: 300, lineHeight: 1.6 }}>
              Used only for weather on your home screen. Stays on your device.
            </p>
            {locStatus === 'idle' && (
              <button className="btn btn-primary" onClick={requestLocation} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
                Share location
              </button>
            )}
            {locStatus === 'asking' && <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Asking…</p>}
            {locStatus === 'granted' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontSize: 14 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Got it — {locName}
              </div>
            )}
            {locStatus === 'denied' && <p style={{ color: '#f87171', fontSize: 13 }}>No worries, we'll skip that.</p>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          {step > 0 && (
            <button className="btn btn-ghost" style={{ padding: '8px 18px' }} onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3
            ? <button className="btn btn-primary" style={{ opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'default' }}
                onClick={() => canNext && setStep(s => s + 1)}>Continue</button>
            : <button className="btn btn-primary" onClick={finish}>Let's go →</button>
          }
        </div>
      </div>
    </div>
  )
}

// ─── Pomodoro widget ──────────────────────────────────────────
const WORK_S  = 25 * 60
const BREAK_S = 5  * 60
const CIRC    = 2 * Math.PI * 46

const SOUNDS: Record<string, string> = {
  rain:   'https://cdn.pixabay.com/audio/2022/05/13/audio_257112ef96.mp3',
  forest: 'https://cdn.pixabay.com/audio/2022/03/24/audio_1e91a8dcca.mp3',
  white:  'https://cdn.pixabay.com/audio/2022/01/18/audio_d0c6ff1bab.mp3',
}

function PomodoroWidget() {
  const [running, setRunning]   = useState(false)
  const [mode, setMode]         = useState<'work'|'break'>('work')
  const [left, setLeft]         = useState(WORK_S)
  const [sessions, setSessions] = useState(0)
  const [sound, setSound]       = useState<string|null>(null)
  const ivRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const total  = mode === 'work' ? WORK_S : BREAK_S
  const pct    = (total - left) / total
  const offset = CIRC * (1 - pct)
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const strokeColor = mode === 'work' ? '#7b9ef5' : '#3ecfa0'
  const playBg      = mode === 'work'
    ? 'linear-gradient(135deg,#5b8df5,#9070e8)' : 'linear-gradient(135deg,#2ecf94,#4ab8d0)'
  const playShadow  = mode === 'work'
    ? '0 5px 18px rgba(90,130,240,0.32)' : '0 5px 18px rgba(46,207,148,0.28)'

  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setLeft(l => {
          if (l <= 1) {
            clearInterval(ivRef.current!); ivRef.current = null
            setRunning(false)
            if (mode === 'work') { setSessions(n => n + 1); setMode('break'); setLeft(BREAK_S) }
            else { setMode('work'); setLeft(WORK_S) }
            return 0
          }
          return l - 1
        })
      }, 1000)
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, mode])

  useEffect(() => {
    audioRef.current?.pause(); audioRef.current = null
    if (sound && SOUNDS[sound]) {
      const a = new Audio(SOUNDS[sound])
      a.loop = true; a.volume = 0.28
      a.play().catch(() => {})
      audioRef.current = a
    }
    return () => audioRef.current?.pause()
  }, [sound])

  const reset = () => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode === 'work' ? WORK_S : BREAK_S)
  }

  const switchMode = (m: 'work'|'break') => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setMode(m); setLeft(m === 'work' ? WORK_S : BREAK_S)
  }

  const soundBtns: { key: string|null; label: React.ReactNode }[] = [
    { key: 'rain',   label: '🌧' },
    { key: 'forest', label: '🌿' },
    { key: 'white',  label: '〰' },
    { key: null,     label: <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
  ]

  return (
    <div className="pomo-card">
      <div className="pomo-top">
        <div>
          <div className="pomo-lbl">Focus timer</div>
          <div className="pomo-tabs">
            <button className={`pomo-tab${mode === 'work'  ? ' active' : ''}`} onClick={() => switchMode('work')}>Focus</button>
            <button className={`pomo-tab${mode === 'break' ? ' active' : ''}`} onClick={() => switchMode('break')}>Break</button>
          </div>
        </div>
        <div className="pomo-sessions">
          {sessions}<small>sessions</small>
        </div>
      </div>

      <div className="pomo-body">
        <div className="pomo-ring-wrap">
          <svg width="112" height="112" viewBox="0 0 112 112">
            <circle cx="56" cy="56" r="46" fill="none" stroke="var(--text-4)" strokeWidth="6"/>
            <circle cx="56" cy="56" r="46" fill="none" stroke={strokeColor}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={offset}
              style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none',
                filter: `drop-shadow(0 0 6px ${strokeColor}60)` }}
            />
          </svg>
          <div className="pomo-ring-center">
            <div className="pomo-time" style={{ color: strokeColor }}>{mm}:{ss}</div>
            <div className="pomo-mode">{mode === 'work' ? 'focus' : 'break'}</div>
          </div>
        </div>

        <div className="pomo-controls">
          <div className="pomo-btns">
            <button className="btn-reset" onClick={reset} title="Reset">
              <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
            </button>
            <button className="btn-play" style={{ background: playBg, boxShadow: playShadow }}
              onClick={() => setRunning(r => !r)}>
              {running
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              }
            </button>
          </div>
          <div className="sound-row">
            <span className="sound-lbl">Ambient</span>
            {soundBtns.map(({ key, label }) => (
              <button key={String(key)} className={`sound-btn${sound === key ? ' active' : ''}`}
                onClick={() => setSound(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Weather ──────────────────────────────────────────────────
function WeatherPill({ lat, lon, locationName }: { lat: number|null; lon: number|null; locationName: string }) {
  const [w, setW] = useState<Weather|null>(null)

  useEffect(() => {
    if (!lat || !lon) return
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
      .then(r => r.json())
      .then(d => {
        const code = d.current_weather?.weathercode ?? 0
        const temp = Math.round(d.current_weather?.temperature ?? 0)
        const conds: Record<number, string> = {
          0:'Clear',1:'Mostly clear',2:'Partly cloudy',3:'Overcast',
          45:'Foggy',61:'Rain',71:'Snow',80:'Showers',95:'Thunderstorm',
        }
        setW({ temp, condition: conds[code] ?? 'Clear' })
      }).catch(() => {})
  }, [lat, lon])

  const sunIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,200,60,0.85)" strokeWidth="1.9" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
    </svg>
  )

  return (
    <div className="weather-pill">
      {sunIcon}
      <div>
        <div className="weather-temp">{w ? `${w.temp}°` : '—'}</div>
        <div className="weather-loc">{locationName || '…'}</div>
      </div>
    </div>
  )
}

// ─── Theme toggle ─────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button className="icon-btn" onClick={toggle} title="Toggle theme">
      {theme === 'dark'
        ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        : <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  )
}

// ─── Streak dots ──────────────────────────────────────────────
function StreakDots({ count }: { count: number }) {
  const days = 7
  return (
    <div className="streak-dots">
      {Array.from({ length: days }).map((_, i) => {
        const filled = i < Math.min(count % 7 || 7, days)
        const isToday = i === (new Date().getDay() + 6) % 7
        return <div key={i} className={`s-dot${filled ? ' done' : ''}${isToday ? ' today' : ''}`} />
      })}
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────
export default function Dashboard({ setPage }: { material: any; setPage: (p: Page) => void }) {
  const [profile, setProfile] = useState<Profile|null>(null)
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const quote = QUOTES[new Date().getDay() % QUOTES.length]

  const session: StudySession|null = (() => {
    try { return JSON.parse(localStorage.getItem('shh_session') ?? 'null') } catch { return null }
  })()

  useEffect(() => {
    try {
      const stored = localStorage.getItem('shh_profile')
      if (stored) setProfile(JSON.parse(stored))
    } catch {}
    setLoading(false)
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
  }, [])

  if (loading) return null
  if (!profile?.onboarded) return <Onboarding onDone={p => setProfile(p)} />

  const firstName = profile.name.split(' ')[0]
  const streakCount = Number(localStorage.getItem('shh_streak') ?? 12)

  const quickCards = [
    { label: 'Ask the AI', sub: 'Explain, quiz, summarise', page: 'chat' as Page,
      color: '#7b9ef5', bg: 'rgba(99,140,245,0.11)', border: 'rgba(99,140,245,0.2)',
      icon: <svg viewBox="0 0 24 24" stroke="#7b9ef5" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label: 'My library', sub: 'Books, notes, uploads', page: 'library' as Page,
      color: '#b07ef7', bg: 'rgba(160,100,220,0.1)', border: 'rgba(160,100,220,0.18)',
      icon: <svg viewBox="0 0 24 24" stroke="#b07ef7" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
    { label: 'Start focus', sub: 'Pomodoro + sounds', page: 'pomodoro' as Page,
      color: '#3ecfa0', bg: 'rgba(40,180,130,0.1)', border: 'rgba(40,180,130,0.16)',
      icon: <svg viewBox="0 0 24 24" stroke="#3ecfa0" fill="none" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
    { label: 'Daily goals', sub: "Track today's progress", page: 'settings' as Page,
      color: '#f0a040', bg: 'rgba(240,160,60,0.09)', border: 'rgba(240,160,60,0.16)',
      icon: <svg viewBox="0 0 24 24" stroke="#f0a040" fill="none" strokeWidth="1.75" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  ]

  return (
    <>
      {/* Topbar */}
      <div className="home-topbar">
        <div className="home-logo">Shhhhh</div>
        <div className="topbar-right">
          {profile.lat && <WeatherPill lat={profile.lat} lon={profile.lon} locationName={profile.location} />}
          <ThemeToggle />
        </div>
      </div>

      {/* Two-column content */}
      <div className="home-inner">
        <div className="home-cols">

          {/* ── Left column ── */}
          <div className="home-col">
            {/* Hero */}
            <div>
              <div className="hero-time">{greeting}</div>
              <div className="hero-name">Hey, <em>{firstName}</em> —<br/>ready to learn?</div>
            </div>

            {/* Streak */}
            <div className="streak">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <div className="streak-num">{streakCount}</div>
                <div className="streak-icon">
                  <svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                </div>
              </div>
              <div className="streak-lbl">day streak</div>
              <StreakDots count={streakCount} />
            </div>

            {/* Quote */}
            <div className="quote">
              <div className="quote-text">"{quote.text}"</div>
              <div className="quote-author">— {quote.author}</div>
            </div>

            {/* Session banner */}
            {session && (
              <button className="session-banner" onClick={() => setPage('library')}>
                <div className="book-thumb">
                  <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg>
                </div>
                <div className="sess-info">
                  <div className="sess-lbl">Continue reading</div>
                  <div className="sess-title">{session.bookTitle}</div>
                  <div className="sess-prog">
                    <div className="sess-prog-fill" style={{ width: `${Math.round(session.page/session.totalPages*100)}%` }} />
                  </div>
                </div>
                <div className="sess-pct">{Math.round(session.page/session.totalPages*100)}%</div>
              </button>
            )}

            {/* Quick cards */}
            <div>
              <div className="sec-lbl">What do you want to do?</div>
              <div className="quick-grid">
                {quickCards.map(c => (
                  <button key={c.label} className="quick-card" onClick={() => setPage(c.page)}>
                    <div className="quick-icon" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                      {c.icon}
                    </div>
                    <h4>{c.label}</h4>
                    <p>{c.sub}</p>
                    <div className="quick-arrow">→</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="home-col" style={{ paddingTop: 4 }}>
            <PomodoroWidget />

            {/* Stats */}
            <div className="stat-grid">
              <div className="stat-card">
                <div className="sec-lbl" style={{ marginBottom: 4 }}>Today</div>
                <div className="stat-value" style={{ color: 'var(--accent)' }}>2h 40m</div>
                <div className="stat-sub">study time</div>
              </div>
              <div className="stat-card">
                <div className="sec-lbl" style={{ marginBottom: 4 }}>This week</div>
                <div className="stat-value" style={{ color: 'var(--green)' }}>14h</div>
                <div className="stat-sub">total focus</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
