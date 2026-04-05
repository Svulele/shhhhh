import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../App'
import type { Page } from '../App'

// ── Types ─────────────────────────────────────────────────────
interface Profile {
  name: string; ai: string; goals: string[]; vibe: string
  location: string; lat: number|null; lon: number|null; onboarded: boolean
}

// ── Quotes ────────────────────────────────────────────────────
const QUOTES = [
  { text:'The more that you read, the more things you will know.', author:'Dr. Seuss' },
  { text:'An investment in knowledge pays the best interest.', author:'Benjamin Franklin' },
  { text:'Live as if you were to die tomorrow. Learn as if you were to live forever.', author:'Gandhi' },
  { text:'The beautiful thing about learning is that no one can take it away from you.', author:'B.B. King' },
  { text:'Education is not preparation for life; education is life itself.', author:'John Dewey' },
  { text:'The capacity to learn is a gift; the ability to learn is a skill.', author:'Brian Herbert' },
  { text:'Develop a passion for learning. If you do, you will never cease to grow.', author:"Anthony J. D'Angelo" },
]

const AI_OPTIONS = [
  { id:'claude',  label:'Claude',  sub:'by Anthropic' },
  { id:'gpt4',    label:'GPT-4',   sub:'by OpenAI'    },
  { id:'gemini',  label:'Gemini',  sub:'by Google'     },
  { id:'llama',   label:'LLaMA',   sub:'Open source'  },
]
const GOAL_OPTIONS = ['Exams','Research','Personal growth','Language','Coding','Creative writing']

// ── Vibe / personality ────────────────────────────────────────
const VIBES = [
  { id:'gentle',   emoji:'🌱', label:'Gentle',   desc:'Patient, warm, encouraging. Never judges.' },
  { id:'balanced', emoji:'⚡', label:'Balanced',  desc:'Supportive but keeps you on track.' },
  { id:'strict',   emoji:'🎯', label:'Strict',    desc:'Direct, focused, no fluff. Gets things done.' },
  { id:'chill',    emoji:'🌊', label:'Chill',     desc:'Laid-back buddy. Study when you feel it.' },
]

// ── Storage ───────────────────────────────────────────────────
const loadProfile = (): Profile|null => { try { const p = JSON.parse(localStorage.getItem('shh_profile')?? 'null'); return p?.onboarded ? p : null } catch { return null } }
const saveProfile = (p: Profile) => localStorage.setItem('shh_profile', JSON.stringify(p))

// ── Onboarding ────────────────────────────────────────────────
const STEPS = ['name','ai','vibe','goals','location']

function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep]   = useState(0)
  const [name, setName]   = useState('')
  const [ai, setAi]       = useState('')
  const [vibe, setVibe]   = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [locStatus, setLocStatus] = useState<'idle'|'asking'|'granted'|'denied'>('idle')
  const [coords, setCoords] = useState<{lat:number;lon:number}|null>(null)
  const [locName, setLocName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (step===0) setTimeout(()=>inputRef.current?.focus(),300) },[step])

  const toggle = (g: string) => setGoals(p => p.includes(g) ? p.filter(x=>x!==g) : [...p,g])

  const requestLoc = () => {
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const {latitude:lat, longitude:lon} = pos.coords
        setCoords({lat,lon})
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const d = await r.json()
          setLocName(d.address?.city||d.address?.town||d.address?.state||'your area')
        } catch { setLocName('your area') }
        setLocStatus('granted')
      },
      () => setLocStatus('denied')
    )
  }

  const finish = () => {
    const p: Profile = { name, ai, vibe, goals, location:locName, lat:coords?.lat??null, lon:coords?.lon??null, onboarded:true }
    saveProfile(p); onDone(p)
  }

  const canNext = [name.trim().length>0, ai.length>0, vibe.length>0, goals.length>0, true][step]

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div style={{display:'flex',gap:8,marginBottom:36}}>
          {STEPS.map((_,i) => <div key={i} className={`step-dot${i<=step?' active':''}`}/>)}
        </div>

        {step===0 && (
          <div>
            <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Welcome</p>
            <p className="onboard-q">What should I call you?</p>
            <input ref={inputRef} placeholder="Your name…" style={{fontSize:20,fontWeight:300,padding:'16px 20px'}}
              value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&canNext&&setStep(1)}/>
          </div>
        )}

        {step===1 && (
          <div>
            <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Your AI</p>
            <p className="onboard-q">Which AI will you study with?</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {AI_OPTIONS.map(o => (
                <button key={o.id} className={`ai-card${ai===o.id?' active':''}`} onClick={()=>setAi(o.id)}>
                  <span style={{fontSize:15,fontWeight:500,color:'var(--text-1)'}}>{o.label}</span>
                  <span style={{fontSize:11,color:'var(--text-3)',fontWeight:300}}>{o.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step===2 && (
          <div>
            <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Your style</p>
            <p className="onboard-q">What kind of study buddy do you want?</p>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {VIBES.map(v => (
                <button key={v.id} onClick={()=>setVibe(v.id)}
                  style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',borderRadius:16,textAlign:'left',cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .2s',
                    background:vibe===v.id?'var(--accent-soft)':'var(--bg-card)',
                    border:`0.5px solid ${vibe===v.id?'var(--border-active)':'var(--border)'}`,
                  }}>
                  <span style={{fontSize:24,flexShrink:0}}>{v.emoji}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:500,color:'var(--text-1)',marginBottom:2}}>{v.label}</div>
                    <div style={{fontSize:12,color:'var(--text-3)',fontWeight:300}}>{v.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step===3 && (
          <div>
            <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Focus areas</p>
            <p className="onboard-q">What are you studying for?</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
              {GOAL_OPTIONS.map(g => (
                <button key={g} className={`goal-chip${goals.includes(g)?' active':''}`} onClick={()=>toggle(g)}>{g}</button>
              ))}
            </div>
          </div>
        )}

        {step===4 && (
          <div>
            <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Almost there</p>
            <p className="onboard-q">Can I see your location?</p>
            <p style={{color:'var(--text-3)',fontSize:13,marginBottom:28,fontWeight:300,lineHeight:1.6}}>
              Used only for weather on your home screen. Stays on your device.
            </p>
            {locStatus==='idle' && (
              <button className="btn btn-primary" onClick={requestLoc} style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
                Share location
              </button>
            )}
            {locStatus==='asking'  && <p style={{color:'var(--text-3)',fontSize:14}}>Asking…</p>}
            {locStatus==='granted' && <div style={{display:'flex',alignItems:'center',gap:8,color:'var(--green)',fontSize:14}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Got it — {locName}</div>}
            {locStatus==='denied'  && <p style={{color:'#f87171',fontSize:13}}>No worries, we'll skip that.</p>}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',marginTop:36,paddingTop:24,borderTop:'0.5px solid var(--border)'}}>
          {step>0 && <button className="btn btn-ghost" style={{padding:'8px 18px'}} onClick={()=>setStep(s=>s-1)}>Back</button>}
          <div style={{flex:1}}/>
          {step<4
            ? <button className="btn btn-primary" style={{opacity:canNext?1:0.35,cursor:canNext?'pointer':'default'}} onClick={()=>canNext&&setStep(s=>s+1)}>Continue</button>
            : <button className="btn btn-primary" onClick={finish}>Let's go →</button>
          }
        </div>
      </div>
    </div>
  )
}

// ── Pomodoro widget ───────────────────────────────────────────
const DEFAULT_WORK  = 25 * 60
const DEFAULT_BREAK = 5  * 60

// Tiny bell sound via Web Audio API — no external dependency
function playBell() {
  try {
    const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.8)
  } catch {}
}

// Ambient sounds
const AMBIENT_SRCS: Record<string, string> = {
  rain:   'https://cdn.pixabay.com/audio/2022/05/13/audio_257112ef96.mp3',
  forest: 'https://cdn.pixabay.com/audio/2022/03/24/audio_1e91a8dcca.mp3',
  white:  'https://cdn.pixabay.com/audio/2022/01/18/audio_d0c6ff1bab.mp3',
  cafe:   'https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3',
}

function PomodoroWidget() {
  const [mode, setMode]         = useState<'work'|'break'>('work')
  const [workSecs, setWorkSecs] = useState(DEFAULT_WORK)
  const [brkSecs, setBrkSecs]   = useState(DEFAULT_BREAK)
  const [left, setLeft]         = useState(DEFAULT_WORK)
  const [running, setRunning]   = useState(false)
  const [sessions, setSessions] = useState(0)
  const [sound, setSound]       = useState<string|null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(25)
  const [customBrk, setCustomBrk]   = useState(5)
  const [aiLoading, setAiLoading]   = useState(false)

  const ivRef    = useRef<ReturnType<typeof setInterval>|null>(null)
  const audioRef = useRef<HTMLAudioElement|null>(null)

  const total = mode==='work' ? workSecs : brkSecs

  // Timer tick
  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setLeft(l => {
          if (l <= 1) {
            clearInterval(ivRef.current!); ivRef.current = null
            setRunning(false)
            playBell()
            if (mode==='work') { setSessions(n=>n+1); setMode('break'); setLeft(brkSecs) }
            else { setMode('work'); setLeft(workSecs) }
            return 0
          }
          return l-1
        })
      }, 1000)
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, mode, workSecs, brkSecs])

  // Ambient audio
  useEffect(() => {
    audioRef.current?.pause(); audioRef.current = null
    if (sound && AMBIENT_SRCS[sound]) {
      const a = new Audio(AMBIENT_SRCS[sound])
      a.loop = true; a.volume = 0.28; a.play().catch(()=>{})
      audioRef.current = a
    }
    return () => audioRef.current?.pause()
  }, [sound])

  const switchMode = (m: 'work'|'break') => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setMode(m); setLeft(m==='work' ? workSecs : brkSecs)
  }

  const reset = () => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode==='work' ? workSecs : brkSecs)
  }

  const applyCustom = () => {
    const w = Math.max(1, Math.min(120, customWork)) * 60
    const b = Math.max(1, Math.min(60,  customBrk))  * 60
    setWorkSecs(w); setBrkSecs(b)
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode==='work' ? w : b)
    setShowCustom(false)
  }

  const askAiForTimer = async () => {
    setAiLoading(true)
    const profile = JSON.parse(localStorage.getItem('shh_profile')??'{}')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          model:'claude-sonnet-4-20250514', max_tokens:200,
          messages:[{ role:'user', content:`Based on these study goals: ${profile.goals?.join(', ')||'general study'}, and study vibe: ${profile.vibe||'balanced'}, suggest optimal Pomodoro focus and break durations in minutes. Respond ONLY with JSON: {"work":25,"break":5,"reason":"short reason"}` }]
        })
      })
      const data = await res.json()
      const text = (data.content??[]).map((c:any)=>c.text??'').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      setCustomWork(parsed.work); setCustomBrk(parsed.break)
      setShowCustom(true)
    } catch {}
    setAiLoading(false)
  }

  const mm  = String(Math.floor(left/60)).padStart(2,'0')
  const ss  = String(left%60).padStart(2,'0')
  const pct = total > 0 ? ((total-left)/total)*100 : 0

  const soundBtns = [
    { key:'rain',   label:'🌧' },
    { key:'forest', label:'🌿' },
    { key:'cafe',   label:'☕' },
    { key:'white',  label:'〰' },
    { key:null,     label:<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
  ]

  return (
    <div className="pomo-card">
      <div className="pomo-top">
        <div>
          <div className="pomo-lbl">Focus timer</div>
          <div className="pomo-tabs">
            <button className={`pomo-tab${mode==='work'?' active':''}`}  onClick={()=>switchMode('work')}>Focus</button>
            <button className={`pomo-tab${mode==='break'?' active':''}`} onClick={()=>switchMode('break')}>Break</button>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="pomo-sessions-num">{sessions}</div>
          <div className="pomo-sessions-lbl">sessions</div>
        </div>
      </div>

      {/* Time + controls — controls sit immediately right of digits */}
      <div className="pomo-time-row">
        <div className="pomo-time">{mm}<span className="sep">:</span>{ss}</div>
        <div className="pomo-controls">
          <button className="pomo-btn" onClick={reset} title="Reset">
            <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="1.8">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
          </button>
          <button className="pomo-btn pomo-btn-play" onClick={()=>setRunning(r=>!r)}>
            {running
              ? <svg width="30" height="30" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              : <svg width="30" height="30" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
        </div>
      </div>

      {/* Tiny progress line under timer */}
      <div style={{height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',marginTop:12,marginBottom:0}}>
        <div style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,var(--accent),${mode==='work'?'#b07ef7':'var(--green)'})`,borderRadius:99,transition:running?'width 1s linear':'none'}}/>
      </div>

      {/* Ambient sound row */}
      <div className="pomo-ambient">
        <span className="ambient-lbl">Ambient</span>
        {soundBtns.map(({key,label}) => (
          <button key={String(key)} className={`sound-btn${sound===key?' active':''}`} onClick={()=>setSound(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* Custom timer row */}
      <div style={{marginTop:14,paddingTop:14,borderTop:'0.5px solid var(--border)'}}>
        {showCustom ? (
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}>
              Focus
              <input type="number" min={1} max={120} value={customWork} onChange={e=>setCustomWork(Number(e.target.value))}
                style={{width:52,padding:'5px 8px',fontSize:12,textAlign:'center'}}/>
              min
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-2)'}}>
              Break
              <input type="number" min={1} max={60} value={customBrk} onChange={e=>setCustomBrk(Number(e.target.value))}
                style={{width:44,padding:'5px 8px',fontSize:12,textAlign:'center'}}/>
              min
            </div>
            <button onClick={applyCustom} style={{padding:'5px 14px',borderRadius:999,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)'}}>Apply</button>
            <button onClick={()=>setShowCustom(false)} style={{padding:'5px 10px',borderRadius:999,background:'transparent',border:'none',color:'var(--text-3)',fontSize:12,cursor:'pointer'}}>Cancel</button>
          </div>
        ) : (
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setShowCustom(true)}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:999,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
              Custom time
            </button>
            <button onClick={askAiForTimer} disabled={aiLoading}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:999,border:'0.5px solid var(--border-active)',background:'var(--accent-soft)',color:'var(--accent)',fontSize:11,cursor:aiLoading?'default':'pointer',fontFamily:'var(--font-body)',transition:'all .18s',opacity:aiLoading?0.6:1}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>
              {aiLoading ? 'Thinking…' : 'Ask AI to set time'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weather pill ──────────────────────────────────────────────
function WeatherPill({ lat, lon, locationName }: { lat:number|null; lon:number|null; locationName:string }) {
  const [temp, setTemp] = useState<number|null>(null)
  useEffect(() => {
    if (!lat||!lon) return
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
      .then(r=>r.json()).then(d=>setTemp(Math.round(d.current_weather?.temperature??0))).catch(()=>{})
  }, [lat,lon])
  return (
    <div className="weather-pill">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(250,190,50,.9)" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
      </svg>
      <div>
        <div className="weather-temp">{temp!==null?`${temp}°`:'—'}</div>
        <div className="weather-loc">{locationName||'…'}</div>
      </div>
    </div>
  )
}

// ── Theme toggle ──────────────────────────────────────────────
function ThemeToggle() {
  const {theme,toggle} = useTheme()
  return (
    <button className="icon-btn" onClick={toggle} title="Toggle theme">
      {theme==='dark'
        ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        : <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      }
    </button>
  )
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard({ setPage }: { setPage:(p:Page)=>void }) {
  const [profile, setProfile] = useState<Profile|null>(null)
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')
  const quote   = QUOTES[new Date().getDay() % QUOTES.length]
  const streak  = Number(localStorage.getItem('shh_streak') ?? 12)
  const session = (() => { try { return JSON.parse(localStorage.getItem('shh_session')?? 'null') } catch { return null } })()

  useEffect(() => {
    setProfile(loadProfile())
    setLoading(false)
    const h = new Date().getHours()
    setGreeting(h<12?'Good morning':h<17?'Good afternoon':'Good evening')
  }, [])

  if (loading) return null
  if (!profile?.onboarded) return <Onboarding onDone={p=>setProfile(p)}/>

  const firstName = profile.name.split(' ')[0]

  const quickCards = [
    { label:'Ask the AI',  sub:'Explain, quiz, summarise',  page:'chat'     as Page, color:'#7b9ef5', bg:'rgba(99,140,245,.1)',   border:'rgba(99,140,245,.2)',  icon:<svg viewBox="0 0 24 24" stroke="#7b9ef5" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { label:'My library',  sub:'Books, notes, uploads',      page:'library'  as Page, color:'#b07ef7', bg:'rgba(160,100,220,.09)', border:'rgba(160,100,220,.18)', icon:<svg viewBox="0 0 24 24" stroke="#b07ef7" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg> },
    { label:'Start focus', sub:'Pomodoro + sounds',          page:'pomodoro' as Page, color:'#3ecfa0', bg:'rgba(40,180,130,.09)',  border:'rgba(40,180,130,.16)', icon:<svg viewBox="0 0 24 24" stroke="#3ecfa0" fill="none" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
    { label:'Daily goals', sub:"Track today's progress",     page:'settings' as Page, color:'#f0a040', bg:'rgba(240,160,60,.09)',  border:'rgba(240,160,60,.16)', icon:<svg viewBox="0 0 24 24" stroke="#f0a040" fill="none" strokeWidth="1.75" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  ]

  return (
    <>
      <div className="home-topbar">
        <div className="home-logo">Shhhhh</div>
        <div className="topbar-right">
          {profile.lat && <WeatherPill lat={profile.lat} lon={profile.lon} locationName={profile.location}/>}
          <ThemeToggle/>
        </div>
      </div>

      <div className="home-inner">
        <div className="home-cols">

          {/* ── Left col ── */}
          <div className="home-col">
            <div>
              <div className="hero-time">{greeting}</div>
              <div className="hero-name">Hey, <em>{firstName}</em> —<br/>ready to learn?</div>
            </div>

            {/* Streak */}
            <div className="card streak">
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <div className="streak-num">{streak}</div>
                <div className="streak-icon">
                  <svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                </div>
              </div>
              <div className="streak-lbl">Day streak</div>
              <div className="streak-dots">
                {Array.from({length:7}).map((_,i) => {
                  const filled  = i < Math.min(streak%7||7, 7)
                  const isToday = i === (new Date().getDay()+6)%7
                  return <div key={i} className={`s-dot${filled?' done':''}${isToday?' today':''}`}/>
                })}
              </div>
            </div>

            {/* Quote */}
            <div className="card quote">
              <div className="quote-text">"{quote.text}"</div>
              <div className="quote-author">— {quote.author}</div>
            </div>

            {/* Session banner */}
            {session && (
              <button className="session-banner" onClick={()=>setPage('library')}>
                <div className="book-thumb">
                  <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg>
                </div>
                <div className="sess-info">
                  <div className="sess-lbl">Continue reading</div>
                  <div className="sess-title">{session.bookTitle}</div>
                  <div className="sess-prog">
                    <div className="sess-prog-fill" style={{width:`${Math.round(session.page/session.totalPages*100)}%`}}/>
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
                  <button key={c.label} className="quick-card" onClick={()=>setPage(c.page)}>
                    <div className="quick-icon" style={{background:c.bg,border:`1px solid ${c.border}`}}>{c.icon}</div>
                    <h4>{c.label}</h4><p>{c.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right col ── */}
          <div className="home-col" style={{paddingTop:4}}>
            <PomodoroWidget />
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-lbl">Today</div>
                <div className="stat-value" style={{color:'var(--accent)'}}>2h 40m</div>
                <div className="stat-sub">study time</div>
              </div>
              <div className="stat-card">
                <div className="stat-lbl">This week</div>
                <div className="stat-value" style={{color:'var(--green)'}}>14h</div>
                <div className="stat-sub">total focus</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
