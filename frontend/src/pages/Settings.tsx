import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useTheme, useUser } from '../App'
import { saveCloudProfile } from '../supabase'

interface Profile {
  name: string; ai: string; vibe: string; goals: string[]
  location: string; lat: number|null; lon: number|null; onboarded: boolean
}

const AI_OPTIONS = [
  { id:'claude', label:'Claude',  sub:'Anthropic' },
  { id:'gpt4',   label:'GPT-4',   sub:'OpenAI'    },
  { id:'gemini', label:'Gemini',  sub:'Google'     },
  { id:'llama',  label:'LLaMA',   sub:'Open source'},
]
const GOAL_OPTIONS = ['Exams','Research','Personal growth','Language','Coding','Creative writing']
const VIBES = [
  { id:'gentle',   e:'🌱', label:'Gentle',   desc:'Warm, patient, never judges' },
  { id:'balanced', e:'⚡', label:'Balanced',  desc:'Supportive but accountable' },
  { id:'strict',   e:'🎯', label:'Strict',    desc:'Direct, no fluff, results' },
  { id:'chill',    e:'🌊', label:'Chill',     desc:'Laid-back, no pressure' },
]

const load = (): Profile => {
  try { return { name:'', ai:'claude', vibe:'balanced', goals:[], location:'', lat:null, lon:null, onboarded:false, ...JSON.parse(localStorage.getItem('shh_profile')??'{}') } }
  catch { return { name:'', ai:'claude', vibe:'balanced', goals:[], location:'', lat:null, lon:null, onboarded:false } }
}
const persist = (p: Profile) => localStorage.setItem('shh_profile', JSON.stringify(p))
const getBooks = () => { try { return JSON.parse(localStorage.getItem('shh_books')?? '[]') } catch { return [] } }
const getStreak = () => Number(localStorage.getItem('shh_streak') ?? 0)

type Tab = 'profile' | 'ai' | 'data'

export default function Settings({ doSignOut }: { doSignOut?: () => void }) {
  const { theme, toggle } = useTheme()
  const { user } = useUser()

  const [tab, setTab]         = useState<Tab>('profile')
  const [profile, setProfile] = useState<Profile>(load)
  const [saved, setSaved]     = useState(false)
  const [locStatus, setLocStatus] = useState<'idle'|'asking'|'done'|'denied'>('idle')

  const books   = getBooks()
  const streak  = getStreak()
  const booksRead  = books.filter((b:any) => b.totalPages > 1 && b.currentPage >= b.totalPages).length
  const inProg     = books.filter((b:any) => b.currentPage > 1 && b.currentPage < b.totalPages).length

  useEffect(() => { persist(profile) }, [profile])

  const up = (patch: Partial<Profile>) => setProfile(p => ({ ...p, ...patch }))

  const toggleGoal = (g: string) =>
    up({ goals: profile.goals.includes(g) ? profile.goals.filter(x => x !== g) : [...profile.goals, g] })

  const save = async () => {
    persist(profile)
    if (user) {
      try {
        await saveCloudProfile(user.id, {
          name: profile.name, ai: profile.ai, vibe: profile.vibe,
          goals: profile.goals, location: profile.location,
          lat: profile.lat, lon: profile.lon,
        })
      } catch {}
    }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const requestLoc = () => {
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const d = await r.json()
          const loc = d.address?.city || d.address?.town || d.address?.state || 'your area'
          up({ lat, lon, location: loc })
        } catch { up({ lat, lon }) }
        setLocStatus('done')
      },
      () => setLocStatus('denied')
    )
  }

  const clearAll = () => {
    if (!confirm('Delete all books, notes, chats and settings?')) return
    localStorage.clear(); window.location.reload()
  }

  const inp: CSSProperties = {
    width:'100%', background:'var(--bg-input)', border:'1px solid var(--border)',
    borderRadius:10, padding:'10px 14px', color:'var(--text-1)',
    fontFamily:'var(--font-body)', fontSize:14, fontWeight:300, outline:'none',
  }

  const tabBtn = (t: Tab): CSSProperties => ({
    padding:'7px 18px', borderRadius:999, fontSize:12, cursor:'pointer',
    fontFamily:'var(--font-body)', border:'0.5px solid var(--border)',
    background: tab===t ? 'var(--bg-pill)' : 'transparent',
    color: tab===t ? 'var(--text-1)' : 'var(--text-3)',
    transition:'all .18s',
  })

  return (
    <div className="page-scroll">
      <div style={{ maxWidth:640, margin:'0 auto', padding:'32px clamp(16px,4vw,40px) 120px' }}>

        {/* Header row — compact */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:26, letterSpacing:'-0.5px', color:'var(--text-1)' }}>Settings</div>
            {user && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{user.email}</div>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {/* Theme toggle inline */}
            <button onClick={toggle} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
              {theme==='dark'
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> Light</>
                : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark</>
              }
            </button>
            {doSignOut && (
              <button onClick={doSignOut} style={{ padding:'7px 14px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
                Sign out
              </button>
            )}
          </div>
        </div>

        {/* Stat bar */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:24 }}>
          {[
            { label:'Streak', val:`${streak}🔥`, color:'var(--amber)' },
            { label:'Books read', val:String(booksRead), color:'var(--accent)' },
            { label:'In progress', val:String(inProg), color:'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:14, padding:'14px 12px', textAlign:'center' }}>
              <div style={{ fontSize:9, letterSpacing:'2px', textTransform:'uppercase', color:'var(--text-3)', marginBottom:6 }}>{s.label}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:24, letterSpacing:'-0.5px', color:s.color, lineHeight:1 }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:20 }}>
          <button style={tabBtn('profile')} onClick={() => setTab('profile')}>Profile</button>
          <button style={tabBtn('ai')}      onClick={() => setTab('ai')}>AI & vibe</button>
          <button style={tabBtn('data')}    onClick={() => setTab('data')}>Data</button>
        </div>

        {/* ── Profile tab ── */}
        {tab === 'profile' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:8 }}>Your name</div>
              <input style={inp} value={profile.name} placeholder="What should I call you?"
                onChange={e => up({ name: e.target.value })}/>
            </div>

            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:12 }}>Study goals</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {GOAL_OPTIONS.map(g => (
                  <button key={g} onClick={() => toggleGoal(g)} style={{
                    padding:'7px 15px', borderRadius:999, fontSize:12, cursor:'pointer',
                    fontFamily:'var(--font-body)', border:'0.5px solid var(--border)', transition:'all .18s',
                    background: profile.goals.includes(g) ? 'rgba(167,139,250,.14)' : 'transparent',
                    color:      profile.goals.includes(g) ? '#c4b5fd' : 'var(--text-3)',
                    borderColor: profile.goals.includes(g) ? 'rgba(167,139,250,.35)' : 'var(--border)',
                  }}>{g}</button>
                ))}
              </div>
            </div>

            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:3 }}>Location</div>
                  <div style={{ fontSize:14, color:'var(--text-1)', fontWeight:profile.location?500:300 }}>
                    {profile.location || 'Not set — used for weather'}
                  </div>
                  {locStatus==='done' && <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>✓ Updated</div>}
                  {locStatus==='denied' && <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>Permission denied</div>}
                </div>
                <button onClick={requestLoc} disabled={locStatus==='asking'} style={{ padding:'8px 16px', borderRadius:999, border:'0.5px solid var(--border-active)', background:'var(--accent-soft)', color:'var(--accent)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', opacity:locStatus==='asking'?0.6:1 }}>
                  {locStatus==='asking' ? 'Asking…' : profile.location ? 'Update' : 'Allow'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI & vibe tab ── */}
        {tab === 'ai' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:12 }}>AI assistant</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {AI_OPTIONS.map(o => (
                  <button key={o.id} onClick={() => up({ ai: o.id })} style={{
                    padding:'12px 14px', borderRadius:12, textAlign:'left', cursor:'pointer',
                    fontFamily:'var(--font-body)', border:'0.5px solid var(--border)', transition:'all .2s',
                    background: profile.ai===o.id ? 'var(--accent-soft)' : 'var(--bg)',
                    borderColor: profile.ai===o.id ? 'var(--border-active)' : 'var(--border)',
                  }}>
                    <div style={{ fontSize:14, fontWeight:500, color:'var(--text-1)' }}>{o.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:300 }}>{o.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:12 }}>Study buddy vibe</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {VIBES.map(v => (
                  <button key={v.id} onClick={() => up({ vibe: v.id })} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12,
                    textAlign:'left', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s',
                    border:'0.5px solid var(--border)',
                    background: profile.vibe===v.id ? 'var(--accent-soft)' : 'transparent',
                    borderColor: profile.vibe===v.id ? 'var(--border-active)' : 'var(--border)',
                  }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{v.e}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)' }}>{v.label}</div>
                      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:300 }}>{v.desc}</div>
                    </div>
                    {profile.vibe===v.id && <svg style={{ marginLeft:'auto', flexShrink:0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Data tab ── */}
        {tab === 'data' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
              <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.7, fontWeight:300, marginBottom:14 }}>
                All data — books, notes, chats, settings — lives on <strong style={{ fontWeight:500, color:'var(--text-1)' }}>your device only</strong>.
                {user && <> Your profile syncs to your account so it works across devices.</>}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={clearAll} style={{ padding:'9px 18px', borderRadius:10, border:'0.5px solid rgba(239,68,68,.25)', background:'rgba(239,68,68,.07)', color:'#f87171', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
                  Clear all local data
                </button>
              </div>
            </div>

            {user && (
              <div style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'18px 20px' }}>
                <div style={{ fontSize:11, color:'var(--text-3)', letterSpacing:'1px', marginBottom:8 }}>Account</div>
                <div style={{ fontSize:14, color:'var(--text-1)', marginBottom:12 }}>{user.email}</div>
                <button onClick={doSignOut} style={{ padding:'9px 18px', borderRadius:10, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Save button — always visible */}
        {tab !== 'data' && (
          <button onClick={save} style={{ width:'100%', marginTop:20, padding:'12px', borderRadius:12, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 18px var(--accent-glow)', transition:'all .2s' }}>
            {saved ? '✓ Saved' : 'Save changes'}
          </button>
        )}
      </div>
    </div>
  )
}
