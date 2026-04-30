import { useState, useEffect, useRef } from 'react'
import { useTheme, useUser } from '../App'
import type { Page } from '../App'
import { getStreak, recordStudyDay } from '../supabase'

// ── Types ─────────────────────────────────────────────────────
interface Profile {
  name: string; ai: string; vibe: string; goals: string[]
  location: string; lat: number|null; lon: number|null; onboarded: boolean
}

// ── 30 quotes, unique daily rotation ─────────────────────────
const QUOTES = [
  { text:'The more that you read, the more things you will know.', author:'Dr. Seuss' },
  { text:'An investment in knowledge pays the best interest.', author:'Benjamin Franklin' },
  { text:'Live as if you were to die tomorrow. Learn as if you were to live forever.', author:'Gandhi' },
  { text:'The beautiful thing about learning is that no one can take it away from you.', author:'B.B. King' },
  { text:'Education is not preparation for life; education is life itself.', author:'John Dewey' },
  { text:'The capacity to learn is a gift; the ability to learn is a skill.', author:'Brian Herbert' },
  { text:'Develop a passion for learning. If you do, you will never cease to grow.', author:"Anthony J. D'Angelo" },
  { text:'Tell me and I forget. Teach me and I remember. Involve me and I learn.', author:'Benjamin Franklin' },
  { text:'The expert in anything was once a beginner.', author:'Helen Hayes' },
  { text:'Education is the passport to the future.', author:'Malcolm X' },
  { text:'The mind is not a vessel to be filled but a fire to be kindled.', author:'Plutarch' },
  { text:'Learning never exhausts the mind.', author:'Leonardo da Vinci' },
  { text:'The roots of education are bitter, but the fruit is sweet.', author:'Aristotle' },
  { text:'Strive for progress, not perfection.', author:'Unknown' },
  { text:'Small steps every day lead to massive results.', author:'Unknown' },
  { text:"You don't have to be great to start, but you have to start to be great.", author:'Zig Ziglar' },
  { text:'Success is the sum of small efforts repeated day in and day out.', author:'Robert Collier' },
  { text:"It always seems impossible until it's done.", author:'Nelson Mandela' },
  { text:"Don't watch the clock; do what it does — keep going.", author:'Sam Levenson' },
  { text:'The secret of getting ahead is getting started.', author:'Mark Twain' },
  { text:'Push yourself, because no one else is going to do it for you.', author:'Unknown' },
  { text:'Great things never came from comfort zones.', author:'Unknown' },
  { text:'Work hard in silence, let your success be your noise.', author:'Frank Ocean' },
  { text:'You are capable of more than you know.', author:'E.O. Wilson' },
  { text:"Believe you can and you're halfway there.", author:'Theodore Roosevelt' },
  { text:'Every accomplishment starts with the decision to try.', author:'John F. Kennedy' },
  { text:"Don't stop until you're proud.", author:'Unknown' },
  { text:'Hardships often prepare ordinary people for an extraordinary destiny.', author:'C.S. Lewis' },
  { text:'The only way to do great work is to love what you do.', author:'Steve Jobs' },
  { text:'Dream big, start small, act now.', author:'Robin Sharma' },
]

function getQuoteOfDay() {
  const today = new Date().toISOString().split('T')[0]
  try {
    const s = JSON.parse(localStorage.getItem('shh_quote_state') ?? '{}')
    if (s.date === today && typeof s.idx === 'number') return QUOTES[s.idx % QUOTES.length]
    const seen: number[] = s.seen ?? []
    const pool = QUOTES.map((_,i)=>i).filter(i=>!seen.includes(i))
    const candidates = pool.length > 0 ? pool : QUOTES.map((_,i)=>i)
    const idx = candidates[Math.floor(Math.random() * candidates.length)]
    const newSeen = pool.length > 0 ? [...seen, idx] : [idx]
    localStorage.setItem('shh_quote_state', JSON.stringify({ date:today, idx, seen:newSeen }))
    return QUOTES[idx]
  } catch { return QUOTES[0] }
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

// ── Onboarding ────────────────────────────────────────────────
const AI_OPTS  = [{id:'claude',label:'Claude',sub:'Anthropic'},{id:'gpt4',label:'GPT-4',sub:'OpenAI'},{id:'gemini',label:'Gemini',sub:'Google'},{id:'llama',label:'LLaMA',sub:'Open source'}]
const GOAL_OPTS = ['Exams','Research','Personal growth','Language','Coding','Creative writing']
const VIBES    = [
  {id:'gentle',  e:'🌱',label:'Gentle',  desc:'Warm, patient, never judges'},
  {id:'balanced',e:'⚡',label:'Balanced', desc:'Supportive but accountable'},
  {id:'strict',  e:'🎯',label:'Strict',   desc:'Direct, no fluff, results'},
  {id:'chill',   e:'🌊',label:'Chill',    desc:'Laid-back, no pressure'},
]

function Onboarding({ onDone }: { onDone:(p:Profile)=>void }) {
  const [step,setStep]   = useState(0)
  const [name,setName]   = useState('')
  const [ai,setAi]       = useState('claude')
  const [vibe,setVibe]   = useState('balanced')
  const [goals,setGoals] = useState<string[]>([])
  const [locSt,setLocSt] = useState<'idle'|'asking'|'done'|'denied'>('idle')
  const [coords,setCoords] = useState<{lat:number;lon:number}|null>(null)
  const [locName,setLocName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(()=>{ if(step===0) setTimeout(()=>inputRef.current?.focus(),200) },[step])
  const toggleGoal = (g:string) => setGoals(p=>p.includes(g)?p.filter(x=>x!==g):[...p,g])
  const canNext = [name.trim().length>0, true, true, goals.length>0, true][step]

  const reqLoc = () => {
    setLocSt('asking')
    navigator.geolocation.getCurrentPosition(async pos=>{
      const {latitude:lat,longitude:lon} = pos.coords; setCoords({lat,lon})
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        const d = await r.json()
        setLocName(d.address?.city||d.address?.town||d.address?.state||'your area')
      } catch { setLocName('your area') }
      setLocSt('done')
    }, ()=>setLocSt('denied'))
  }

  const finish = () => {
    const p:Profile = { name, ai, vibe, goals, location:locName, lat:coords?.lat??null, lon:coords?.lon??null, onboarded:true }
    localStorage.setItem('shh_profile', JSON.stringify(p)); onDone(p)
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div style={{display:'flex',gap:8,marginBottom:32}}>
          {[0,1,2,3,4].map(i=><div key={i} className={`step-dot${i<=step?' active':''}`}/>)}
        </div>

        {step===0&&<div>
          <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>Welcome</p>
          <p className="onboard-q">What should I call you?</p>
          <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name…"
            style={{fontSize:18,fontWeight:300,padding:'14px 18px'}} onKeyDown={e=>e.key==='Enter'&&canNext&&setStep(1)}/>
        </div>}

        {step===1&&<div>
          <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>Your AI</p>
          <p className="onboard-q">Which AI will you study with?</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {AI_OPTS.map(o=><button key={o.id} className={`ai-card${ai===o.id?' active':''}`} onClick={()=>setAi(o.id)}>
              <span style={{fontSize:14,fontWeight:500,color:'var(--text-1)'}}>{o.label}</span>
              <span style={{fontSize:11,color:'var(--text-3)',fontWeight:300}}>{o.sub}</span>
            </button>)}
          </div>
        </div>}

        {step===2&&<div>
          <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>Your style</p>
          <p className="onboard-q">What kind of study buddy?</p>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {VIBES.map(v=><button key={v.id} onClick={()=>setVibe(v.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:14,textAlign:'left',cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .2s',background:vibe===v.id?'var(--accent-soft)':'var(--bg-card)',border:`0.5px solid ${vibe===v.id?'var(--border-active)':'var(--border)'}`}}>
              <span style={{fontSize:22,flexShrink:0}}>{v.e}</span>
              <div><div style={{fontSize:14,fontWeight:500,color:'var(--text-1)',marginBottom:2}}>{v.label}</div>
              <div style={{fontSize:12,color:'var(--text-3)',fontWeight:300}}>{v.desc}</div></div>
              {vibe===v.id&&<svg style={{marginLeft:'auto',flexShrink:0}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>)}
          </div>
        </div>}

        {step===3&&<div>
          <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>Focus areas</p>
          <p className="onboard-q">What are you studying for?</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {GOAL_OPTS.map(g=><button key={g} className={`goal-chip${goals.includes(g)?' active':''}`} onClick={()=>toggleGoal(g)}>{g}</button>)}
          </div>
        </div>}

        {step===4&&<div>
          <p style={{fontSize:11,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>Almost there</p>
          <p className="onboard-q">Can I see your location?</p>
          <p style={{color:'var(--text-3)',fontSize:13,marginBottom:24,fontWeight:300,lineHeight:1.6}}>Only used for weather. Stays on your device.</p>
          {locSt==='idle'&&<button className="btn btn-primary" onClick={reqLoc} style={{display:'inline-flex',alignItems:'center',gap:8}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
            Share location
          </button>}
          {locSt==='asking'&&<p style={{color:'var(--text-3)',fontSize:13}}>Asking…</p>}
          {locSt==='done'&&<p style={{color:'var(--green)',fontSize:13}}>✓ {locName}</p>}
          {locSt==='denied'&&<p style={{color:'#f87171',fontSize:13}}>No worries, we'll skip weather.</p>}
        </div>}

        <div style={{display:'flex',alignItems:'center',marginTop:32,paddingTop:20,borderTop:'0.5px solid var(--border)'}}>
          {step>0&&<button className="btn btn-ghost" style={{padding:'8px 18px'}} onClick={()=>setStep(s=>s-1)}>Back</button>}
          <div style={{flex:1}}/>
          {step<4
            ?<button className="btn btn-primary" style={{opacity:canNext?1:0.35,cursor:canNext?'pointer':'default'}} onClick={()=>canNext&&setStep(s=>s+1)}>Continue</button>
            :<button className="btn btn-primary" onClick={finish}>Let's go →</button>}
        </div>
      </div>
    </div>
  )
}

// ── Ambient + bell (Web Audio, no CORS) ───────────────────────
let _ac: AudioContext|null = null; let _nodes: AudioNode[] = []
function stopAmb() { _nodes.forEach(n=>{try{(n as any).stop?.();n.disconnect()}catch{}}); _nodes=[] }
async function playAmb(type: string) {
  stopAmb()
  try {
    if (!_ac) _ac = new (window.AudioContext||(window as any).webkitAudioContext)()
    if (_ac.state==='suspended') await _ac.resume()
    const ctx=_ac, len=ctx.sampleRate*4, nb=ctx.createBuffer(2,len,ctx.sampleRate)
    for(let c=0;c<2;c++){const d=nb.getChannelData(c);for(let i=0;i<len;i++)d[i]=Math.random()*2-1}
    const S=()=>{const s=ctx.createBufferSource();s.buffer=nb;s.loop=true;return s}
    const G=(v:number)=>{const g=ctx.createGain();g.gain.value=v;g.connect(ctx.destination);return g}
    const F=(t:BiquadFilterType,f:number)=>{const x=ctx.createBiquadFilter();x.type=t;x.frequency.value=f;return x}
    if(type==='white'){const s=S(),g=G(.09);s.connect(g);s.start();_nodes.push(s,g)}
    if(type==='rain'){const s1=S(),hp=F('highpass',1200),lp=F('lowpass',10000),g1=G(.2);s1.connect(hp);hp.connect(lp);lp.connect(g1);s1.start();const s2=S(),lp2=F('lowpass',160),g2=G(.05);s2.connect(lp2);lp2.connect(g2);s2.start();_nodes.push(s1,hp,lp,g1,s2,lp2,g2)}
    if(type==='forest'){const s=S(),bp=F('bandpass',480),g=G(.07),lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=.22;lg.gain.value=.04;lfo.connect(lg);lg.connect(g.gain);s.connect(bp);bp.connect(g);s.start();lfo.start();_nodes.push(s,bp,g,lfo,lg)}
    if(type==='cafe'){const s1=S(),b1=F('bandpass',680),g1=G(.06);s1.connect(b1);b1.connect(g1);s1.start();const s2=S(),b2=F('bandpass',1250),g2=G(.04);s2.connect(b2);b2.connect(g2);s2.start();_nodes.push(s1,b1,g1,s2,b2,g2)}
  } catch(e){console.warn('Ambient:',e)}
}
function playBell(){try{const ctx=new(window.AudioContext||(window as any).webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.setValueAtTime(880,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(440,ctx.currentTime+1.5);gain.gain.setValueAtTime(.45,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+2);osc.start();osc.stop(ctx.currentTime+2)}catch{}}

// ── Pomodoro widget ───────────────────────────────────────────
const WORK_S=25*60, BRK_S=5*60
function PomodoroWidget() {
  const [mode,setMode]   = useState<'work'|'break'>('work')
  const [workS,setWorkS] = useState(WORK_S)
  const [brkS,setBrkS]   = useState(BRK_S)
  const [left,setLeft]   = useState(WORK_S)
  const [run,setRun]     = useState(false)
  const [sess,setSess]   = useState(0)
  const [sound,setSound] = useState<string|null>(null)
  const [showCfg,setShowCfg] = useState(false)
  const [cwM,setCwM]     = useState(25)
  const [cbM,setCbM]     = useState(5)
  const iv = useRef<any>(null)
  const total = mode==='work'?workS:brkS
  const pct   = total>0?((total-left)/total)*100:0
  const mm = String(Math.floor(left/60)).padStart(2,'0')
  const ss = String(left%60).padStart(2,'0')

  useEffect(()=>{
    if(run){iv.current=setInterval(()=>setLeft(l=>{
      if(l<=1){clearInterval(iv.current);iv.current=null;setRun(false);playBell()
        if(mode==='work'){setSess(n=>n+1);setMode('break');setLeft(brkS)}else{setMode('work');setLeft(workS)};return 0}
      return l-1}),1000)}
    return ()=>{if(iv.current)clearInterval(iv.current)}
  },[run,mode,workS,brkS])

  useEffect(()=>{
    if(sound) playAmb(sound).catch(console.warn); else stopAmb()
    return ()=>stopAmb()
  },[sound])

  const switchMode=(m:'work'|'break')=>{clearInterval(iv.current);setRun(false);setMode(m);setLeft(m==='work'?workS:brkS)}
  const reset=()=>{clearInterval(iv.current);setRun(false);setLeft(mode==='work'?workS:brkS)}
  const applyCfg=()=>{const w=Math.max(1,Math.min(120,cwM))*60,b=Math.max(1,Math.min(60,cbM))*60;setWorkS(w);setBrkS(b);clearInterval(iv.current);setRun(false);setLeft(mode==='work'?w:b);setShowCfg(false)}

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
          <div className="pomo-sessions-num">{sess}</div>
          <div className="pomo-sessions-lbl">sessions</div>
        </div>
      </div>

      {/* Timer + controls — grouped left, controls RIGHT NEXT TO digits */}
      <div className="pomo-time-row">
        <div className="pomo-time">{mm}<span className="sep">:</span>{ss}</div>
        <div className="pomo-controls">
          <button className="pomo-btn" onClick={reset}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
          </button>
          <button className="pomo-btn pomo-btn-play" onClick={()=>setRun(r=>!r)}>
            {run
              ?<svg width="28" height="28" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              :<svg width="28" height="28" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
          </button>
        </div>
      </div>

      {/* Progress line */}
      <div style={{height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',marginTop:12}}>
        <div style={{height:'100%',width:`${pct}%`,borderRadius:99,transition:run?'width 1s linear':'none',background:`linear-gradient(90deg,var(--accent),${mode==='work'?'#b07ef7':'var(--green)'})`}}/>
      </div>

      {/* Ambient */}
      <div className="pomo-ambient">
        <span className="ambient-lbl">Ambient</span>
        {[{k:'rain',l:'🌧'},{k:'forest',l:'🌿'},{k:'cafe',l:'☕'},{k:'white',l:'〰'}].map(({k,l})=>(
          <button key={k} className={`sound-btn${sound===k?' active':''}`} onClick={()=>setSound(sound===k?null:k)}>{l}</button>
        ))}
        {sound&&<button className="sound-btn" onClick={()=>setSound(null)}><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>

      {/* Custom time */}
      <div style={{marginTop:12,paddingTop:12,borderTop:'0.5px solid var(--border)'}}>
        {showCfg?(
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <label style={{fontSize:12,color:'var(--text-2)',display:'flex',alignItems:'center',gap:5}}>
              Focus <input type="number" min={1} max={120} value={cwM} onChange={e=>setCwM(Number(e.target.value))} style={{width:48,padding:'4px 6px',fontSize:12,textAlign:'center'}}/> min
            </label>
            <label style={{fontSize:12,color:'var(--text-2)',display:'flex',alignItems:'center',gap:5}}>
              Break <input type="number" min={1} max={60} value={cbM} onChange={e=>setCbM(Number(e.target.value))} style={{width:40,padding:'4px 6px',fontSize:12,textAlign:'center'}}/> min
            </label>
            <button onClick={applyCfg} style={{padding:'5px 12px',borderRadius:999,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)'}}>Apply</button>
            <button onClick={()=>setShowCfg(false)} style={{fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer'}}>✕</button>
          </div>
        ):(
          <button onClick={()=>setShowCfg(true)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:999,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)'}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></svg>
            Custom time
          </button>
        )}
      </div>
    </div>
  )
}

// ── Study stats with 7-day chart ──────────────────────────────
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

// ── Weather pill — auto-refreshes every 10 min ────────────────
function WeatherPill({ lat, lon, locationName }: { lat:number; lon:number; locationName:string }) {
  const [temp, setTemp] = useState<number|null>(null)
  const [loc,  setLoc]  = useState(locationName)

  const fetchW = async (la:number, lo:number) => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current_weather=true`)
      const d = await r.json()
      setTemp(Math.round(d.current_weather?.temperature ?? 0))
    } catch {}
  }

  useEffect(() => {
    fetchW(lat, lon)
    // Refresh every 10 minutes
    const iv = setInterval(() => fetchW(lat, lon), 10 * 60 * 1000)
    // Also watch position for movement
    let watchId: number|null = null
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async pos => {
          const {latitude:la, longitude:lo} = pos.coords
          fetchW(la, lo)
          try {
            const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json`)
            const d = await r.json()
            const name = d.address?.city||d.address?.town||d.address?.state
            if (name) setLoc(name)
          } catch {}
        },
        () => {},
        { enableHighAccuracy:false, maximumAge:300000, timeout:15000 }
      )
    }
    return () => {
      clearInterval(iv)
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [lat, lon])

  return (
    <div className="weather-pill">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(250,190,50,.9)" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="12" cy="12" r="4"/>
        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/>
        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
        <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.78" y2="4.22"/>
      </svg>
      <div>
        <div className="weather-temp">{temp!==null?`${temp}°`:'—'}</div>
        <div className="weather-loc">{loc||'…'}</div>
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ material: _material, setPage }: { material:any; setPage:(p:Page)=>void }) {
  const { theme, toggle } = useTheme()
  const { user }          = useUser()
  const [profile,  setProfile]  = useState<Profile|null>(null)
  const [streak,   setStreak]   = useState(0)
  const [greeting, setGreeting] = useState('')

  const quote   = getQuoteOfDay()
  const session = (()=>{try{return JSON.parse(localStorage.getItem('shh_session')??'null')}catch{return null}})()

  useEffect(()=>{
    const raw = localStorage.getItem('shh_profile')
    if (raw) try{ const p=JSON.parse(raw); if(p?.onboarded) setProfile(p) }catch{}
    const h = new Date().getHours()
    setGreeting(h<12?'Good morning':h<17?'Good afternoon':'Good evening')
  },[])

  useEffect(()=>{
    if(user){
      recordStudyDay(user.id).catch(console.warn)
      getStreak(user.id).then(s=>{setStreak(s);localStorage.setItem('shh_streak',String(s))}).catch(()=>setStreak(Number(localStorage.getItem('shh_streak')??0)))
    } else {
      setStreak(Number(localStorage.getItem('shh_streak')??0))
    }
  },[user])

  if (!profile?.onboarded) return <Onboarding onDone={p=>setProfile(p)}/>

  const firstName = profile.name.split(' ')[0]

  const quickCards = [
    {label:'Ask the AI',   sub:'Explain, quiz, summarise',  page:'chat'      as Page,color:'#7b9ef5',bg:'rgba(99,140,245,.1)',   border:'rgba(99,140,245,.2)',   icon:<svg viewBox="0 0 24 24" stroke="#7b9ef5" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>},
    {label:'My library',   sub:'Books, notes, uploads',      page:'library'   as Page,color:'#b07ef7',bg:'rgba(160,100,220,.09)',border:'rgba(160,100,220,.18)', icon:<svg viewBox="0 0 24 24" stroke="#b07ef7" fill="none" strokeWidth="1.75" strokeLinecap="round"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg>},
    {label:'Start focus',  sub:'Pomodoro + sounds',          page:'pomodoro'  as Page,color:'#3ecfa0',bg:'rgba(40,180,130,.09)',  border:'rgba(40,180,130,.16)',  icon:<svg viewBox="0 0 24 24" stroke="#3ecfa0" fill="none" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>},
    {label:'Today\'s plan', sub:'Your AI study schedule',   page:'plan'      as Page,color:'#f0a040',bg:'rgba(240,160,60,.09)',  border:'rgba(240,160,60,.16)',  icon:<svg viewBox="0 0 24 24" stroke="#f0a040" fill="none" strokeWidth="1.75" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>},
  ]

  return (
    <>
      <div className="home-topbar">
        <div className="home-logo">Shhhhh</div>
        <div className="topbar-right">
          {profile.lat&&<WeatherPill lat={profile.lat} lon={profile.lon!} locationName={profile.location}/>}
          <button className="icon-btn" onClick={toggle} title="Toggle theme">
            {theme==='dark'
              ?<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              :<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
          </button>
        </div>
      </div>

      <div className="home-inner">
        <div className="home-cols">
          {/* ── Left ── */}
          <div className="home-col">
            <div>
              <div className="hero-time">{greeting}</div>
              <div className="hero-name">Hey, <em>{firstName}</em> —<br/>ready to learn?</div>
            </div>

            <div className="card streak">
              <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                <div className="streak-num">{streak}</div>
                <div className="streak-icon"><svg viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div>
              </div>
              <div className="streak-lbl">Day streak</div>
              <div className="streak-dots">
                {Array.from({length:7}).map((_,i)=>{
                  const filled=i<Math.min(streak%7||7,7), isToday=i===(new Date().getDay()+6)%7
                  return <div key={i} className={`s-dot${filled?' done':''}${isToday?' today':''}`}/>
                })}
              </div>
            </div>

            <div className="card quote">
              <div className="quote-text">"{quote.text}"</div>
              <div className="quote-author">— {quote.author}</div>
            </div>

            {session&&(
              <button className="session-banner" onClick={()=>setPage('library')}>
                <div className="book-thumb"><svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/></svg></div>
                <div className="sess-info">
                  <div className="sess-lbl">Continue reading</div>
                  <div className="sess-title">{session.bookTitle}</div>
                  <div className="sess-prog"><div className="sess-prog-fill" style={{width:`${Math.round(session.page/session.totalPages*100)}%`}}/></div>
                </div>
                <div className="sess-pct">{Math.round(session.page/session.totalPages*100)}%</div>
              </button>
            )}

            <div>
              <div className="sec-lbl">What do you want to do?</div>
              <div className="quick-grid">
                {quickCards.map(c=>(
                  <button key={c.label} className="quick-card" onClick={()=>setPage(c.page)}>
                    <div className="quick-icon" style={{background:c.bg,border:`1px solid ${c.border}`}}>{c.icon}</div>
                    <h4>{c.label}</h4><p>{c.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right ── */}
          <div className="home-col" style={{paddingTop:4}}>
            <PomodoroWidget/>
            <StudyStats/>
          </div>
        </div>
      </div>
    </>
  )
}