import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Profile {
  name: string; ai: string; goals: string[]; vibe: string
  location: string; lat: number|null; lon: number|null; onboarded: boolean
}

const VIBES = [
  { id:'gentle',   emoji:'🌱', label:'Gentle',   desc:'Patient, warm, never judges.' },
  { id:'balanced', emoji:'⚡', label:'Balanced',  desc:'Supportive but keeps you on track.' },
  { id:'strict',   emoji:'🎯', label:'Strict',    desc:'Direct, focused, no fluff.' },
  { id:'chill',    emoji:'🌊', label:'Chill',     desc:'Relaxed, pressure-free buddy.' },
]

const AI_OPTIONS = [
  { id:'claude', label:'Claude',  sub:'by Anthropic' },
  { id:'gpt4',   label:'GPT-4',   sub:'by OpenAI'    },
  { id:'gemini', label:'Gemini',  sub:'by Google'     },
  { id:'llama',  label:'LLaMA',   sub:'Open source'  },
]

const GOAL_OPTIONS = ['Exams','Research','Personal growth','Language','Coding','Creative writing']

// ── Storage helpers ───────────────────────────────────────────
const loadProfile = (): Profile => {
  try { return { name:'', ai:'claude', vibe:'balanced', goals:[], location:'', lat:null, lon:null, onboarded:false, ...JSON.parse(localStorage.getItem('shh_profile')??'{}') } }
  catch { return { name:'', ai:'claude', vibe:'balanced', goals:[], location:'', lat:null, lon:null, onboarded:false } }
}
const saveProfile = (p: Profile) => localStorage.setItem('shh_profile', JSON.stringify(p))

const getStreak  = () => Number(localStorage.getItem('shh_streak') ?? 0)
const setStreak  = (n: number) => localStorage.setItem('shh_streak', String(n))
const getBooks   = () => { try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] } }
const getSessions = () => { try { return JSON.parse(localStorage.getItem('shh_chat_sessions') ?? '[]') } catch { return [] } }

// ── Theme hook ────────────────────────────────────────────────
function useThemeLocal() {
  const [t, setT] = useState<'dark'|'light'>(() =>
    (localStorage.getItem('shh_theme') as any) ?? 'dark'
  )
  const toggle = () => {
    const next = t === 'dark' ? 'light' : 'dark'
    setT(next); localStorage.setItem('shh_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  return { theme: t, toggle }
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase', color:'var(--text-3)', marginBottom:14 }}>{title}</div>
      {children}
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'16px 18px', textAlign:'center' }}>
      <div style={{ fontSize:10, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text-3)', marginBottom:8 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-display)', fontSize:28, letterSpacing:'-1px', color, lineHeight:1 }}>{value}</div>
    </div>
  )
}

// ── Main Settings ─────────────────────────────────────────────
export default function Settings() {
  const { theme, toggle } = useThemeLocal()
  const [profile, setProfile] = useState<Profile>(loadProfile)
  const [saved, setSaved]     = useState(false)
  const [locStatus, setLocStatus] = useState<'idle'|'asking'|'done'|'denied'>('idle')
  const [streak, setStreakState]  = useState(getStreak)

  // Stats
  const books    = getBooks()
  const sessions = getSessions()
  const booksRead    = books.filter((b:any) => b.currentPage >= b.totalPages && b.totalPages > 1).length
  const booksInProg  = books.filter((b:any) => b.currentPage > 1 && b.currentPage < b.totalPages).length
  const totalChats   = sessions.length

  useEffect(() => { saveProfile(profile) }, [profile])

  const update = (patch: Partial<Profile>) => setProfile(p => ({ ...p, ...patch }))

  const toggleGoal = (g: string) =>
    update({ goals: profile.goals.includes(g) ? profile.goals.filter(x => x !== g) : [...profile.goals, g] })

  const save = () => {
    saveProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const requestLocation = () => {
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const d = await r.json()
          const loc = d.address?.city || d.address?.town || d.address?.state || 'your area'
          update({ lat, lon, location: loc })
        } catch { update({ lat, lon }) }
        setLocStatus('done')
      },
      () => setLocStatus('denied')
    )
  }

  const resetStreak = () => { setStreak(0); setStreakState(0) }

  const clearAllData = () => {
    if (!window.confirm('This will delete all your books, notes, chats and settings. Are you sure?')) return
    localStorage.clear()
    window.location.reload()
  }

  // Shared card style
  const card: React.CSSProperties = {
    background:'var(--bg-card)', border:'0.5px solid var(--border)',
    borderRadius:16, padding:'18px 20px', marginBottom:10,
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', background:'var(--bg-input)', border:'1px solid var(--border)',
    borderRadius:10, padding:'11px 14px', color:'var(--text-1)',
    fontFamily:'var(--font-body)', fontSize:14, fontWeight:300,
    outline:'none',
  }

  return (
    <div style={{ padding:'36px clamp(20px,4vw,56px) 140px', maxWidth:1400, margin:'0 auto', width:'100%' }}>

      {/* Header — left aligned */}
      <div style={{ marginBottom:36 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:32, letterSpacing:'-1px', color:'var(--text-1)', lineHeight:1.1, marginBottom:6 }}>My profile</div>
        <div style={{ fontSize:12, color:'var(--text-3)' }}>Everything stays on your device</div>
      </div>

      {/* Stats */}
      <Section title="Your stats">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
          <StatChip label="Streak"     value={`${streak}🔥`}  color="var(--amber)"/>
          <StatChip label="Books read" value={String(booksRead)}   color="var(--accent)"/>
          <StatChip label="In progress" value={String(booksInProg)} color="var(--green)"/>
          <StatChip label="AI chats"   value={String(totalChats)}  color="#b07ef7"/>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:3 }}>Theme</div>
              <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:300 }}>
                {theme === 'dark' ? 'Dark — easy on the eyes at night' : 'Light — great for bright environments'}
              </div>
            </div>
            <button onClick={toggle} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-pill)', color:'var(--text-1)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
              {theme === 'dark'
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</>
              }
            </button>
          </div>
        </div>
      </Section>

      {/* Profile */}
      <Section title="About you">
        <div style={card}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:12, color:'var(--text-3)', marginBottom:7, letterSpacing:'0.5px' }}>Your name</label>
            <input style={inputStyle} value={profile.name} placeholder="What should I call you?"
              onChange={e => update({ name: e.target.value })}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, color:'var(--text-3)', marginBottom:10, letterSpacing:'0.5px' }}>Study goals</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {GOAL_OPTIONS.map(g => (
                <button key={g} onClick={()=>toggleGoal(g)}
                  style={{ padding:'7px 16px', borderRadius:999, fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', border:'0.5px solid var(--border)', transition:'all .18s',
                    background: profile.goals.includes(g) ? 'rgba(167,139,250,0.14)' : 'transparent',
                    color:      profile.goals.includes(g) ? '#c4b5fd' : 'var(--text-3)',
                    borderColor: profile.goals.includes(g) ? 'rgba(167,139,250,.35)' : 'var(--border)',
                  }}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* AI */}
      <Section title="AI assistant">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {AI_OPTIONS.map(opt => (
            <button key={opt.id} onClick={()=>update({ ai: opt.id })}
              style={{ padding:'14px 16px', borderRadius:14, textAlign:'left', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s', display:'flex', flexDirection:'column', gap:3,
                background: profile.ai===opt.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                border: `0.5px solid ${profile.ai===opt.id ? 'var(--border-active)' : 'var(--border)'}`,
                boxShadow: profile.ai===opt.id ? '0 0 0 1px var(--border-active)' : 'none',
              }}>
              <span style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>{opt.label}</span>
              <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:300 }}>{opt.sub}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Study buddy vibe */}
      <Section title="Study buddy personality">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
          {VIBES.map(v => (
            <button key={v.id} onClick={()=>update({vibe:v.id})}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:14, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s', textAlign:'left',
                background:(profile as any).vibe===v.id?'var(--accent-soft)':'var(--bg-card)',
                border:`0.5px solid ${(profile as any).vibe===v.id?'var(--border-active)':'var(--border)'}`,
              }}>
              <span style={{fontSize:22}}>{v.emoji}</span>
              <div>
                <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>{v.label}</div>
                <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{v.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Location */}
      <Section title="Location & weather">
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)', marginBottom:3 }}>
                {profile.location ? profile.location : 'Not set'}
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:300 }}>
                {profile.location ? 'Used for weather on your home screen' : 'Share your location for live weather'}
              </div>
            </div>
            <button onClick={requestLocation} disabled={locStatus==='asking'}
              style={{ padding:'9px 16px', borderRadius:999, border:'0.5px solid var(--border-active)', background:'var(--accent-soft)', color:'var(--accent)', fontSize:12, fontWeight:500, cursor:locStatus==='asking'?'default':'pointer', fontFamily:'var(--font-body)', transition:'all .2s', flexShrink:0, opacity:locStatus==='asking'?0.6:1 }}>
              {locStatus==='asking' ? 'Asking…' : profile.location ? 'Update' : 'Share location'}
            </button>
          </div>
          {locStatus==='denied' && <p style={{ fontSize:12, color:'#f87171', marginTop:10 }}>Permission denied — please allow location in browser settings.</p>}
          {locStatus==='done' && <p style={{ fontSize:12, color:'var(--green)', marginTop:10 }}>✓ Location updated</p>}
        </div>
      </Section>

      {/* Streak */}
      <Section title="Streak">
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:32, letterSpacing:'-1px', color:'var(--text-1)', lineHeight:1 }}>
                {streak} <span style={{ fontSize:20 }}>🔥</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:6, fontWeight:300 }}>day streak</div>
            </div>
            <button onClick={resetStreak}
              style={{ padding:'8px 14px', borderRadius:999, border:'0.5px solid rgba(239,68,68,.2)', background:'rgba(239,68,68,.07)', color:'#f87171', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
              Reset streak
            </button>
          </div>
        </div>
      </Section>

      {/* Save */}
      <div style={{ display:'flex', gap:10, marginBottom:28 }}>
        <button onClick={save}
          style={{ flex:1, padding:'12px', borderRadius:12, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 18px var(--accent-glow)', transition:'all .2s' }}>
          {saved ? '✓ Saved' : 'Save changes'}
        </button>
      </div>

      {/* Danger zone */}
      <Section title="Data">
        <div style={{ ...card, borderColor:'rgba(239,68,68,.15)' }}>
          <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:14, lineHeight:1.6, fontWeight:300 }}>
            All your data — books, notes, chats, settings — lives only on this device. Nothing is sent to any server except AI messages.
          </div>
          <button onClick={clearAllData}
            style={{ padding:'9px 18px', borderRadius:10, border:'0.5px solid rgba(239,68,68,.25)', background:'rgba(239,68,68,.07)', color:'#f87171', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
            Clear all data
          </button>
        </div>
      </Section>

    </div>
  )
}