import OnboardingFlow from '../components/auth/OnboardingFlow'
import { useState, useEffect, useRef } from 'react'
import { useUser } from '../App'
import type { Page } from '../App'
import { getStreak, recordStudyDay } from '../supabase'
import { generateWeeklySummaryText, summarizeStudyJourney } from '../studyHistory'
import { timerStore } from '../timerStore'
import Icon from '../components/Icon'
import { extractReadingPages } from './Library'

// ── Confetti ──────────────────────────────────────────────────
function fireConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;width:100%;height:100%'
  canvas.width = window.innerWidth; canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const colours = ['#7b9ef5','#b07ef7','#3ecfa0','#f59e0b','#f87171','#38bdf8']
  const pieces = Array.from({length:120},(_,i)=>({
    x: Math.random()*canvas.width, y: -20 - Math.random()*200,
    r: 4+Math.random()*5, c: colours[i%colours.length],
    vx: (Math.random()-0.5)*4, vy: 2+Math.random()*4,
    spin: (Math.random()-0.5)*0.2, angle: Math.random()*Math.PI*2,
    opacity: 1,
  }))
  let frame = 0
  const tick = () => {
    ctx.clearRect(0,0,canvas.width,canvas.height)
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin; p.opacity -= 0.008
      ctx.save(); ctx.globalAlpha = Math.max(0,p.opacity)
      ctx.translate(p.x,p.y); ctx.rotate(p.angle)
      ctx.fillStyle = p.c; ctx.fillRect(-p.r,-p.r/2,p.r*2,p.r)
      ctx.restore()
    })
    frame++
    if (frame < 160) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

// ── Streak milestone overlay ──────────────────────────────────
const MILESTONES = [3,7,14,30,60,100]

function MilestoneOverlay({ streak, name, onDismiss }: { streak:number; name:string; onDismiss:()=>void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fireConfetti()
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [])

  const handleShare = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    // Draw share card
    const W = 600, H = 320
    canvas.width = W; canvas.height = H
    // Background
    const grad = ctx.createLinearGradient(0,0,W,H)
    grad.addColorStop(0,'#0d0d1a'); grad.addColorStop(1,'#1a1030')
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H)
    // Accent bar top
    const bar = ctx.createLinearGradient(0,0,W,0)
    bar.addColorStop(0,'#7b9ef5'); bar.addColorStop(1,'#b07ef7')
    ctx.fillStyle = bar; ctx.fillRect(0,0,W,4)
    // Logo
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = 'italic 18px serif'
    ctx.fillText('Shhhhh', 36, 48)
    // Big number
    ctx.fillStyle = '#7b9ef5'
    ctx.font = `bold 96px serif`
    ctx.fillText(String(streak), 36, 170)
    // Day streak text
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '28px sans-serif'
    ctx.fillText('day streak', 36 + ctx.measureText(String(streak)).width + 12, 160)
    // Name
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '16px sans-serif'
    ctx.fillText(`${name} is on a roll with Shhhhh`, 36, 220)
    // URL
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '13px sans-serif'
    ctx.fillText('shhhhh-ten.vercel.app', 36, 290)

    canvas.toBlob(blob => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `shhhhh-${streak}-day-streak.png`; a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div onClick={onDismiss} style={{position:'fixed',inset:0,zIndex:9800,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)',backdropFilter:'blur(16px)',animation:'fadeIn .3s ease both'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'var(--bg-card)',border:'0.5px solid var(--border-active)',borderRadius:28,padding:'40px 44px 36px',maxWidth:360,width:'90vw',textAlign:'center',boxShadow:'0 32px 80px rgba(0,0,0,.5)',animation:'scaleIn .35s var(--spring) both'}}>
        {/* Hidden canvas for share card */}
        <canvas ref={canvasRef} style={{display:'none'}}/>

        <div style={{fontFamily:'var(--font-display)',fontSize:72,letterSpacing:'-4px',color:'var(--accent)',lineHeight:1,marginBottom:4}}>
          {streak}
        </div>
        <div style={{fontFamily:'var(--font-display)',fontSize:22,color:'var(--text-1)',marginBottom:8,letterSpacing:'-0.3px'}}>
          day streak
        </div>
        <div style={{fontSize:14,color:'var(--text-3)',fontWeight:300,lineHeight:1.65,marginBottom:28}}>
          {streak >= 30 ? "A whole month. That's incredible dedication." :
           streak >= 14 ? "Two weeks straight. You're building something real." :
           streak >= 7  ? "One full week. The habit is forming." :
                          "Three days in a row. Keep it going!"}
        </div>

        <div style={{display:'flex',gap:10}}>
          <button onClick={handleShare} style={{flex:1,padding:'11px',borderRadius:12,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',justifyContent:'center',gap:7,touchAction:'manipulation'}}>
            <Icon name="share" size={14} />
            Share
          </button>
          <button onClick={onDismiss} style={{flex:1,padding:'11px',borderRadius:12,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 14px var(--accent-glow)',touchAction:'manipulation'}}>
            Keep going!
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────
interface Profile {
  name: string; ai: string; vibe: string; goals: string[]
  location: string; lat: number|null; lon: number|null; onboarded: boolean
}

// ── Study time helpers ────────────────────────────────────────
function getStudyTimeData(): Record<string,number> {
  try { return JSON.parse(localStorage.getItem('shh_study_time') ?? '{}') } catch { return {} }
}
function fmtMins(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.round(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m/60), r = m%60
  return r > 0 ? `${h}h ${r}m` : `${h}h`
}

function StudyStats() {
  const data  = getStudyTimeData()
  const today = new Date().toISOString().split('T')[0]
  const days  = Array.from({length:7}).map((_,i)=>{
    const d   = new Date(Date.now()-(6-i)*86400000)
    const key = d.toISOString().split('T')[0]
    return { key, label:d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,1), secs:data[key]??0, isToday:key===today }
  })
  const maxS   = Math.max(...days.map(d=>d.secs), 1)
  const todayS = data[today]??0
  const weekS  = days.reduce((s,d)=>s+d.secs,0)

  return (
    <div style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:'var(--r-xl)',padding:'18px 20px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
        {[{label:'Today',val:fmtMins(todayS),color:'var(--accent)',sub:'study time'},{label:'This week',val:fmtMins(weekS),color:'var(--green)',sub:'total focus'}].map(s=>(
          <div key={s.label}>
            <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:4}}>{s.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:22,letterSpacing:'-0.5px',color:s.color,lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:11,color:'var(--text-3)',marginTop:2,fontWeight:300}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',alignItems:'flex-end',gap:4,height:40}}>
        {days.map(d=>{
          const h = Math.max(3,(d.secs/maxS)*40)
          return (
            <div key={d.key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
              <div title={fmtMins(d.secs)} style={{width:'100%',height:h,borderRadius:3,
                background:d.isToday?'linear-gradient(180deg,var(--accent),#7b6cf6)':d.secs>0?'var(--border-active)':'var(--text-4)',
                transition:'height .5s cubic-bezier(0.22,1,0.36,1)',opacity:d.secs>0?1:0.4}}/>
              <div style={{fontSize:9,color:d.isToday?'var(--accent)':'var(--text-3)',fontWeight:d.isToday?600:400}}>{d.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Study journey summary ─────────────────────────────────────
function StudyJourney() {
  const [summary, setSummary] = useState(() => summarizeStudyJourney())
  const [weeklyText, setWeeklyText] = useState(summary.weeklyText)

  useEffect(() => {
    const refresh = () => {
      const next = summarizeStudyJourney()
      setSummary(next)
      setWeeklyText(next.weeklyText)
      generateWeeklySummaryText(next).then(setWeeklyText)
    }
    refresh()
    window.addEventListener('shh:study-history-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('shh:study-history-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const s = summary.stats
  const stat = [
    { label: '7 days', value: `${s.weekPages}p`, sub: `${s.weekReviews} cards` },
    { label: '30 days', value: fmtMins(s.monthFocus), sub: `${s.monthPages} pages` },
    { label: 'Still to do', value: `${s.remainingPages}p`, sub: `${s.activeBooks} active` },
  ]

  return (
    <div style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:'var(--r-xl)',padding:'18px 20px'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:14}}>
        <div>
          <div style={{fontSize:9,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:6}}>Study journey</div>
          <div style={{fontFamily:'var(--font-display)',fontSize:21,letterSpacing:'-0.4px',color:'var(--text-1)',lineHeight:1.1}}>Weekly summary</div>
        </div>
        <div style={{fontSize:10,color:'var(--text-3)',padding:'4px 9px',borderRadius:999,background:'var(--bg-pill)',border:'0.5px solid var(--border)',whiteSpace:'nowrap'}}>
          {summary.weekLabel}
        </div>
      </div>

      <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.65,fontWeight:300,marginBottom:16}}>
        {weeklyText}
      </p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
        {stat.map(x => (
          <div key={x.label} style={{border:'0.5px solid var(--border)',borderRadius:12,padding:'10px 9px',background:'rgba(255,255,255,.02)'}}>
            <div style={{fontSize:9,letterSpacing:'1.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:4}}>{x.label}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:19,color:'var(--accent)',lineHeight:1}}>{x.value}</div>
            <div style={{fontSize:10,color:'var(--text-3)',marginTop:3}}>{x.sub}</div>
          </div>
        ))}
      </div>

      {summary.coverage.length > 0 && (
        <div style={{borderTop:'0.5px solid var(--border)',paddingTop:12}}>
          <div style={{fontSize:10,letterSpacing:'1.8px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:8}}>Covered so far</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {summary.coverage.map(item => (
              <div key={item} style={{fontSize:12,color:'var(--text-2)',fontWeight:300,lineHeight:1.45,display:'flex',gap:8}}>
                <Icon name="check" size={15} style={{color:'var(--green)'}} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard({ setPage }: { setPage:(p:Page)=>void }) {
  const { user }          = useUser()
  const [profile,  setProfile]  = useState<Profile|null>(null)
  const [streak,   setStreak]   = useState(0)
  const [greeting, setGreeting] = useState('')
  const [showMilestone, setShowMilestone] = useState(false)

  const session = (()=>{try{return JSON.parse(localStorage.getItem(`shh_resume:${user?.id || 'local'}`) ?? (!user ? localStorage.getItem('shh_session') : null) ?? 'null')}catch{return null}})()
  const [excerpt, setExcerpt] = useState<{page:number;text:string}|null>(null)
  useEffect(() => {
    if (!session?.bookId) return
    let cancelled = false
    const page = session.page || 1
    extractReadingPages({bookId:session.bookId,title:session.bookTitle,author:'',currentPage:page,totalPages:session.totalPages,fromPage:page,toPage:page}).then(pages=>{if(!cancelled)setExcerpt(pages.find(p=>p.text.trim()) || null)}).catch(()=>{})
    return () => {cancelled=true}
  }, [session?.bookId, session?.page, session?.totalPages, session?.bookTitle])

  useEffect(()=>{
    const raw = localStorage.getItem('shh_profile')
    if (raw) try{ const p=JSON.parse(raw); if(p?.onboarded) setProfile(p) }catch{}
    const h = new Date().getHours()
    setGreeting(h<12?'Good morning':h<17?'Good afternoon':'Good evening')
  },[])

  useEffect(()=>{
    if(user){
      recordStudyDay(user.id).catch(console.warn)
      getStreak(user.id).then(s=>{
        setStreak(s)
        localStorage.setItem('shh_streak',String(s))
        // Check if this is a milestone AND we haven't shown it today
        const lastShown = localStorage.getItem('shh_milestone_shown')
        const today = new Date().toISOString().split('T')[0]
        if (MILESTONES.includes(s) && lastShown !== `${today}-${s}`) {
          setTimeout(() => setShowMilestone(true), 1200) // slight delay for drama
          localStorage.setItem('shh_milestone_shown', `${today}-${s}`)
        }
      }).catch(()=>setStreak(Number(localStorage.getItem('shh_streak')??0)))
    } else {
      setStreak(Number(localStorage.getItem('shh_streak')??0))
    }
  },[user])

  if (!profile?.onboarded) return <OnboardingFlow onDone={p=>setProfile(p)}/>

  const firstName = profile.name.split(' ')[0]

  const progress = session ? Math.min(100, Math.round(session.page / session.totalPages * 100)) : 0
  const todaySeconds = getStudyTimeData()[new Date().toISOString().split('T')[0]] || 0
  const resume = () => { if (session?.bookId) sessionStorage.setItem('shh_resume_request', session.bookId); setPage('library') }
  return <section className="redesign-home">
    {showMilestone && <MilestoneOverlay streak={streak} name={firstName} onDismiss={()=>setShowMilestone(false)} />}
    <p className="eyebrow">{greeting}</p><h1 className="page-title">Hey, <em className="title-accent">{firstName}</em>.</h1><p className="page-subtitle">A little progress. A quieter mind.</p>
    <div className="home-study-grid">
      <article className="continue-hero">
        <span className="hero-label"><Icon name="library" size={19} />Continue studying</span>
        <h2>{session?.bookTitle || 'Your next chapter starts here.'}</h2>
        <p>{session ? `Page ${session.page} of ${session.totalPages} · ${progress}% complete` : 'Bring a text-based PDF. Make space to understand it.'}</p>
        {session && <div className="hero-progress" role="progressbar" aria-label="Reading progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}} /></div>}
        <button className="ui-button hero-resume" onClick={resume}>{session ? 'Resume reading' : 'Add your first PDF'}<Icon name="arrow" size={18} /></button>
        <Icon name="library" size={130} className="hero-book-art" />
      </article>
      <article className="soft-card today-card"><span className="eyebrow">Today</span><div className="today-value">{Math.floor(todaySeconds / 60)}<small> min studied</small></div><p><Icon name="flame" size={18} /> {streak} day streak</p><button className="ui-button" onClick={()=>{timerStore.setDurations(25,5);timerStore.switchMode('work');timerStore.play();setPage('pomodoro')}}><Icon name="play" size={18} />Start 25 min focus</button></article>
      <article className="soft-card ask-pdf-card"><div><span className="eyebrow"><Icon name="ask" size={18} /> Ask your PDF</span><h2>A thought worth exploring.</h2><p>{excerpt ? `“${excerpt.text.slice(0,320)}${excerpt.text.length>320?'…':''}”` : 'Open a book to see a real passage here, then ask a question about what you read.'}</p>{excerpt && <span className="source-page">Page {excerpt.page}</span>}</div><button className="ui-button primary" onClick={()=>setPage('chat')}>Ask a question<Icon name="arrow" size={18} /></button></article>
    </div>
    <div className="home-insights"><StudyStats /><StudyJourney /></div>
  </section>
}
