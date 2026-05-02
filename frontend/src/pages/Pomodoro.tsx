import { useState, useEffect, useRef, useCallback } from 'react'

// ── Ambient audio ─────────────────────────────────────────────
let _ctx: AudioContext | null = null
let _nodes: AudioNode[] = []
let _cur: string | null = null

function stopAmbient() {
  _nodes.forEach(n => { try { (n as any).stop?.(); n.disconnect() } catch {} })
  _nodes = []; _cur = null
}

async function playAmbient(type: string) {
  if (_cur === type) return
  stopAmbient(); _cur = type
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    else if (_ctx.state === 'suspended') await _ctx.resume()
    else if (_ctx.state === 'closed')    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _ctx
    const buf = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate)
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 }
    const S = () => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s }
    const G = (v: number) => { const g = ctx.createGain(); g.gain.value = v; g.connect(ctx.destination); return g }
    const F = (t: BiquadFilterType, f: number) => { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; return x }
    if (type === 'white') { const s=S(),g=G(0.09); s.connect(g); s.start(); _nodes.push(s,g) }
    if (type === 'rain') {
      const s1=S(),hp=F('highpass',1200),lp=F('lowpass',10000),g1=G(0.2); s1.connect(hp);hp.connect(lp);lp.connect(g1);s1.start();_nodes.push(s1,hp,lp,g1)
      const s2=S(),lp2=F('lowpass',160),g2=G(0.055); s2.connect(lp2);lp2.connect(g2);s2.start();_nodes.push(s2,lp2,g2)
    }
    if (type === 'forest') {
      const s=S(),bp=F('bandpass',480),g=G(0.07); s.connect(bp);bp.connect(g);s.start()
      const lfo=ctx.createOscillator(),lg=ctx.createGain(); lfo.frequency.value=0.2;lg.gain.value=0.035;lfo.connect(lg);lg.connect(g.gain);lfo.start()
      _nodes.push(s,bp,g,lfo,lg)
    }
    if (type === 'cafe') {
      const s1=S(),b1=F('bandpass',680),g1=G(0.065); s1.connect(b1);b1.connect(g1);s1.start();_nodes.push(s1,b1,g1)
      const s2=S(),b2=F('bandpass',1250),g2=G(0.04); s2.connect(b2);b2.connect(g2);s2.start();_nodes.push(s2,b2,g2)
    }
  } catch {}
}

// ── Alarm — 8 escalating rings to wake someone up ────────────
// Each ring gets progressively louder and more urgent
let _alarmCtx: AudioContext | null = null

function playAlarm(type: 'bell' | 'chime' | 'beep') {
  try {
    if (_alarmCtx) { try { _alarmCtx.close() } catch {} }
    _alarmCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _alarmCtx

    if (type === 'beep') {
      // 8 escalating electronic beeps — gets louder and higher each time
      const freqs    = [440, 523, 587, 659, 740, 830, 932, 1047]
      const vols     = [0.15, 0.2, 0.25, 0.3, 0.35, 0.42, 0.5, 0.6]
      const gaps     = [0, 0.45, 0.85, 1.2, 1.55, 1.85, 2.1, 2.3]
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'square'
        osc.frequency.setValueAtTime(f, ctx.currentTime + gaps[i])
        g.gain.setValueAtTime(0, ctx.currentTime + gaps[i])
        g.gain.linearRampToValueAtTime(vols[i], ctx.currentTime + gaps[i] + 0.01)
        g.gain.setValueAtTime(vols[i], ctx.currentTime + gaps[i] + 0.18)
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + gaps[i] + 0.22)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + gaps[i])
        osc.stop(ctx.currentTime + gaps[i] + 0.25)
      })
    } else if (type === 'chime') {
      // 8 ascending chime tones — musical scale
      const freqs = [523, 587, 659, 698, 784, 880, 988, 1047]
      const vols  = [0.2, 0.22, 0.25, 0.27, 0.32, 0.37, 0.42, 0.5]
      freqs.forEach((f, i) => {
        const delay = i * 0.55
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, ctx.currentTime + delay)
        osc.frequency.exponentialRampToValueAtTime(f * 1.4, ctx.currentTime + delay + 0.4)
        g.gain.setValueAtTime(vols[i], ctx.currentTime + delay)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.9)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 1)
      })
    } else {
      // bell — 8 rings, gap shrinks and volume rises to create urgency
      const delays  = [0, 2.2, 4.0, 5.5, 6.7, 7.6, 8.3, 8.9]
      const vols    = [0.3, 0.34, 0.38, 0.42, 0.47, 0.52, 0.57, 0.65]
      const freqs   = [880, 880, 880, 880, 880, 920, 960, 1000]
      delays.forEach((delay, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freqs[i], ctx.currentTime + delay)
        osc.frequency.exponentialRampToValueAtTime(freqs[i] / 2, ctx.currentTime + delay + 1.6)
        g.gain.setValueAtTime(vols[i], ctx.currentTime + delay)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.8)
        osc.connect(g); g.connect(ctx.destination)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 2)
      })
    }
  } catch {}
}

function stopAlarm() {
  try { _alarmCtx?.close(); _alarmCtx = null } catch {}
}

// ── Types ─────────────────────────────────────────────────────
type Mode = 'work' | 'break'
interface Log { mode: Mode; mins: number; ts: number }

// ── Icon components ───────────────────────────────────────────
const PlayIcon  = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const PauseIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
const ResetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
const ExpandIcon= () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
const CloseIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const SoundOnIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
const SoundOffIcon= () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>

// ── Shared timer state ─────────────────────────────────────────
function useTimer(workMins: number, brkMins: number, alarmType: 'bell'|'chime'|'beep', onDone: (m: Mode) => void) {
  const [mode,    setMode]    = useState<Mode>('work')
  const [left,    setLeft]    = useState(workMins * 60)
  const [running, setRunning] = useState(false)
  const [sessions,setSessions]= useState(0)
  const [log,     setLog]     = useState<Log[]>([])
  const ivRef = useRef<ReturnType<typeof setInterval>|null>(null)

  useEffect(() => {
    if (!running) return
    ivRef.current = setInterval(() => {
      setLeft(l => {
        if (l > 1) return l - 1
        clearInterval(ivRef.current!); ivRef.current = null
        setRunning(false)
        playAlarm(alarmType)
        setLog(lg => [...lg, { mode, mins: mode === 'work' ? workMins : brkMins, ts: Date.now() }])
        const next: Mode = mode === 'work' ? 'break' : 'work'
        if (mode === 'work') setSessions(n => n + 1)
        setMode(next)
        setLeft((next === 'work' ? workMins : brkMins) * 60)
        onDone(mode)
        return 0
      })
    }, 1000)
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, mode, workMins, brkMins, alarmType])

  const switchMode = (m: Mode) => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setMode(m); setLeft((m === 'work' ? workMins : brkMins) * 60)
  }
  const reset = useCallback(() => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft((mode === 'work' ? workMins : brkMins) * 60)
  }, [mode, workMins, brkMins])

  const total = (mode === 'work' ? workMins : brkMins) * 60
  const pct   = total > 0 ? ((total - left) / total) * 100 : 0
  const mm    = String(Math.floor(left / 60)).padStart(2, '0')
  const ss    = String(left % 60).padStart(2, '0')

  return { mode, left, running, setRunning, sessions, log, switchMode, reset, pct, mm, ss, total }
}

// ── Completion overlay ────────────────────────────────────────
function DoneOverlay({ completedMode, onDismiss }: { completedMode: Mode; onDismiss: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (['Enter',' ','Escape'].includes(e.key)) onDismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div onClick={onDismiss} style={{ position:'fixed',inset:0,zIndex:9500,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .25s ease both' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:28,padding:'44px 52px',maxWidth:340,width:'90vw',textAlign:'center',boxShadow:'0 32px 80px rgba(0,0,0,.45)',animation:'scaleIn .3s var(--spring) both' }}>
        {/* Big checkmark icon — no emoji */}
        <div style={{ width:64,height:64,borderRadius:'50%',background:completedMode==='work'?'var(--accent-soft)':'rgba(62,207,160,.12)',border:`1.5px solid ${completedMode==='work'?'var(--border-active)':'rgba(62,207,160,.35)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 22px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={completedMode==='work'?'var(--accent)':'var(--green)'} strokeWidth="2.2" strokeLinecap="round">
            {completedMode==='work'
              ? <polyline points="20 6 9 17 4 12"/>
              : <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>}
          </svg>
        </div>
        <div style={{ fontFamily:'var(--font-display)',fontSize:24,letterSpacing:'-0.4px',color:'var(--text-1)',marginBottom:8 }}>
          {completedMode === 'work' ? 'Session done' : 'Break over'}
        </div>
        <div style={{ fontSize:13,color:'var(--text-3)',fontWeight:300,lineHeight:1.65,marginBottom:28 }}>
          {completedMode === 'work' ? 'Take a moment to breathe. You earned it.' : 'Ready when you are.'}
        </div>
        <button onClick={onDismiss} style={{ padding:'11px 36px',borderRadius:999,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 18px var(--accent-glow)',transition:'all .2s',touchAction:'manipulation' }}>
          {completedMode === 'work' ? 'Start break' : 'Back to focus'}
        </button>
        <div style={{ fontSize:11,color:'var(--text-3)',marginTop:12 }}>Tap anywhere or press Enter</div>
      </div>
    </div>
  )
}

// ── Full-screen focus mode ────────────────────────────────────
function FocusMode({
  mm,ss,pct,mode,running,sessions,sound,alarmType,
  onPlayPause,onReset,onExit,onSound,onAlarm,onSwitchMode,
}: {
  mm:string;ss:string;pct:number;mode:Mode;running:boolean;sessions:number
  sound:string|null;alarmType:'bell'|'chime'|'beep'
  onPlayPause:()=>void;onReset:()=>void;onExit:()=>void
  onSound:(k:string|null)=>void;onAlarm:(t:'bell'|'chime'|'beep')=>void
  onSwitchMode:(m:Mode)=>void
}) {
  const circ = 2 * Math.PI * 130
  const isWork = mode === 'work'
  const accent = isWork ? 'var(--accent)' : 'var(--green)'
  const glow   = isWork ? 'var(--accent-glow)' : 'var(--green-glow)'

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      if (e.key === ' ') { e.preventDefault(); onPlayPause() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9000,background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',animation:'fadeIn .3s ease both',overflow:'hidden' }}>

      {/* Ambient background glow */}
      <div style={{ position:'absolute',inset:0,background:`radial-gradient(ellipse 70% 55% at 50% 45%, ${isWork?'rgba(80,110,240,0.12)':'rgba(40,200,140,0.1)'} 0%,transparent 70%)`,pointerEvents:'none',transition:'background 1.5s ease' }}/>

      {/* Top row */}
      <div style={{ position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',zIndex:1 }}>
        {/* Sessions */}
        <div style={{ display:'flex',flexDirection:'column' }}>
          <div style={{ fontFamily:'var(--font-display)',fontSize:32,letterSpacing:'-1px',color:'var(--text-1)',lineHeight:1 }}>{sessions}</div>
          <div style={{ fontSize:9,color:'var(--text-3)',letterSpacing:'2px',textTransform:'uppercase',marginTop:3 }}>sessions</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex',gap:4,background:'var(--bg-card)',borderRadius:999,padding:4,border:'0.5px solid var(--border)' }}>
          {(['work','break'] as Mode[]).map(m => (
            <button key={m} onClick={() => onSwitchMode(m)} style={{ padding:'5px 16px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',border:'none',background:mode===m?accent:'transparent',color:mode===m?'white':'var(--text-3)',fontWeight:mode===m?500:300,transition:'all .2s',touchAction:'manipulation' }}>
              {m === 'work' ? 'Focus' : 'Break'}
            </button>
          ))}
        </div>

        {/* Exit */}
        <button onClick={onExit} style={{ width:40,height:40,borderRadius:'50%',border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',touchAction:'manipulation' }}>
          <CloseIcon/>
        </button>
      </div>

      {/* Giant ring + time — the centrepiece */}
      <div style={{ position:'relative',zIndex:1,marginBottom:48 }}>
        {/* Outer pulse ring when running */}
        {running && <div style={{ position:'absolute',inset:-20,borderRadius:'50%',border:`1px solid ${isWork?'rgba(99,140,245,0.18)':'rgba(62,207,160,0.18)'}`,animation:'pulse 2.5s ease-in-out infinite' }}/>}
        {running && <div style={{ position:'absolute',inset:-38,borderRadius:'50%',border:`0.5px solid ${isWork?'rgba(99,140,245,0.08)':'rgba(62,207,160,0.08)'}`,animation:'pulse 2.5s ease-in-out infinite',animationDelay:'0.8s' }}/>}

        <svg width="300" height="300" viewBox="0 0 300 300" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="150" cy="150" r="130" fill="none" stroke="var(--text-4)" strokeWidth="4"/>
          <circle cx="150" cy="150" r="130" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
            style={{ transition:running?'stroke-dashoffset 1s linear':'none', filter:`drop-shadow(0 0 14px ${glow})` }}
          />
        </svg>

        {/* Time — the entire point */}
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6 }}>
          <div style={{ fontFamily:'var(--font-display)',fontSize:'clamp(64px,14vw,88px)',letterSpacing:'-5px',color:'var(--text-1)',lineHeight:1,userSelect:'none' }}>
            {mm}<span style={{ opacity:0.2,letterSpacing:'-2px' }}>:</span>{ss}
          </div>
          <div style={{ fontSize:10,letterSpacing:'3px',textTransform:'uppercase',color:isWork?'var(--accent)':'var(--green)',fontWeight:500 }}>
            {isWork ? 'focus' : 'break'}
          </div>
        </div>
      </div>

      {/* Play/Pause + Reset */}
      <div style={{ display:'flex',alignItems:'center',gap:24,marginBottom:40,zIndex:1 }}>
        <button onClick={onReset} style={{ width:50,height:50,borderRadius:'50%',border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',touchAction:'manipulation' }}>
          <ResetIcon/>
        </button>
        <button onClick={onPlayPause} style={{ width:76,height:76,borderRadius:'50%',border:'none',background:`linear-gradient(135deg,${accent},${isWork?'#7b6cf6':'#34d399'})`,color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 32px ${glow}`,transition:'all .25s',touchAction:'manipulation' }}>
          {running ? <PauseIcon/> : <PlayIcon/>}
        </button>
        <button onClick={() => onSound(sound ? null : 'rain')} style={{ width:50,height:50,borderRadius:'50%',border:`0.5px solid ${sound?'var(--border-active)':'var(--border)'}`,background:sound?'var(--accent-soft)':'var(--bg-card)',color:sound?'var(--accent)':'var(--text-2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',touchAction:'manipulation' }}>
          {sound ? <SoundOnIcon/> : <SoundOffIcon/>}
        </button>
      </div>

      {/* Bottom shelf — sounds + alarm */}
      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10,zIndex:1 }}>
        <div style={{ display:'flex',gap:8 }}>
          {[{k:'rain',l:'🌧'},{k:'forest',l:'🌿'},{k:'cafe',l:'☕'},{k:'white',l:'〰'}].map(({k,l})=>(
            <button key={k} onClick={()=>onSound(sound===k?null:k)} style={{ width:38,height:38,borderRadius:11,border:`0.5px solid ${sound===k?'var(--border-active)':'var(--border)'}`,background:sound===k?'var(--accent-soft)':'var(--bg-card)',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .18s',touchAction:'manipulation' }}>{l}</button>
          ))}
        </div>
        <div style={{ display:'flex',gap:5,alignItems:'center' }}>
          <span style={{ fontSize:9,color:'var(--text-3)',letterSpacing:'1.5px',textTransform:'uppercase',marginRight:4 }}>alarm</span>
          {(['bell','chime','beep'] as const).map(t=>(
            <button key={t} onClick={()=>onAlarm(t)} style={{ padding:'4px 11px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',border:`0.5px solid ${alarmType===t?'var(--border-active)':'var(--border)'}`,background:alarmType===t?'var(--accent-soft)':'transparent',color:alarmType===t?'var(--accent)':'var(--text-3)',transition:'all .18s',touchAction:'manipulation' }}>{t}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function Pomodoro() {
  const [workMins, setWorkMins] = useState(25)
  const [brkMins,  setBrkMins]  = useState(5)
  const [sound,    setSound]    = useState<string|null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(25)
  const [customBrk,  setCustomBrk]  = useState(5)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiTip,     setAiTip]       = useState<string|null>(null)
  const [alarmType, setAlarmType]   = useState<'bell'|'chime'|'beep'>('bell')
  const [fullscreen,setFullscreen]  = useState(false)
  const [showDone,  setShowDone]    = useState(false)
  const [doneMode,  setDoneMode]    = useState<Mode>('work')

  const onDone = (m: Mode) => { setDoneMode(m); setShowDone(true) }

  const timer = useTimer(workMins, brkMins, alarmType, onDone)

  useEffect(() => () => { stopAmbient(); stopAlarm() }, [])

  const handleSound = async (key: string | null) => {
    if (!key || sound === key) { stopAmbient(); setSound(null); return }
    setSound(key)
    try { await playAmbient(key) } catch { stopAmbient(); setSound(null) }
  }

  const applyCustom = () => {
    const w = Math.max(1,Math.min(120,customWork)), b = Math.max(1,Math.min(60,customBrk))
    setWorkMins(w); setBrkMins(b)
    timer.switchMode(timer.mode) // resets with new values
    setShowCustom(false)
  }

  const askAI = async () => {
    setAiLoading(true); setAiTip(null)
    const p = (() => { try { return JSON.parse(localStorage.getItem('shh_profile')??'{}') } catch { return {} } })()
    try {
      const res = await fetch((import.meta.env.VITE_API_URL??'http://localhost:3001')+'/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:120,system:'Reply ONLY with valid JSON.',messages:[{role:'user',content:`Goals: ${p.goals?.join(',')||'study'}, vibe: ${p.vibe||'balanced'}. Suggest Pomodoro minutes. JSON: {"work":25,"break":5,"tip":"one sentence"}`}]})
      })
      const data = await res.json()
      const parsed = JSON.parse((data.content??[]).map((c:any)=>c.text??'').join('').replace(/```json|```/g,'').trim())
      setCustomWork(parsed.work??25); setCustomBrk(parsed.break??5); setAiTip(parsed.tip); setShowCustom(true)
    } catch { setAiTip('Could not reach AI.') }
    setAiLoading(false)
  }

  const { mode, running, setRunning, sessions, log, switchMode, reset, pct, mm, ss } = timer
  const isWork = mode === 'work'
  const accent = isWork ? 'var(--accent)' : 'var(--green)'
  const circ   = 2 * Math.PI * 90

  return (
    <>
      {fullscreen && (
        <FocusMode
          mm={mm} ss={ss} pct={pct} mode={mode} running={running}
          sessions={sessions} sound={sound} alarmType={alarmType}
          onPlayPause={() => setRunning(r => !r)}
          onReset={reset} onExit={() => setFullscreen(false)}
          onSound={handleSound} onAlarm={setAlarmType} onSwitchMode={switchMode}
        />
      )}
      {showDone && <DoneOverlay completedMode={doneMode} onDismiss={() => { stopAlarm(); setShowDone(false) }}/>}

      <div className="page-scroll">
        <div style={{ maxWidth:640,margin:'0 auto',padding:'clamp(24px,4vw,44px) clamp(16px,4vw,44px) 120px' }}>

          {/* Header */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:28 }}>
            <div>
              <div style={{ fontFamily:'var(--font-display)',fontSize:30,letterSpacing:'-0.8px',color:'var(--text-1)',marginBottom:3 }}>Focus</div>
              <div style={{ fontSize:12,color:'var(--text-3)' }}>{sessions} session{sessions!==1?'s':''} today</div>
            </div>
            <button onClick={() => setFullscreen(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:999,border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .2s',touchAction:'manipulation' }}>
              <ExpandIcon/> Full screen
            </button>
          </div>

          {/* Mode tabs */}
          <div style={{ display:'flex',gap:6,marginBottom:28 }}>
            {(['work','break'] as Mode[]).map(m=>(
              <button key={m} onClick={()=>switchMode(m)} style={{ padding:'6px 16px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',border:'0.5px solid var(--border)',background:mode===m?'var(--bg-pill)':'transparent',color:mode===m?'var(--text-1)':'var(--text-3)',transition:'all .18s',touchAction:'manipulation' }}>
                {m==='work'?'Focus':'Break'}
              </button>
            ))}
          </div>

          {/* Ring timer + controls */}
          <div style={{ display:'flex',alignItems:'center',gap:clamp(24),flexWrap:'wrap',marginBottom:28 }}>
            <div style={{ position:'relative',flexShrink:0 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="var(--text-4)" strokeWidth="6"/>
                <circle cx="100" cy="100" r="90" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
                  style={{ transition:running?'stroke-dashoffset 1s linear':'none',filter:`drop-shadow(0 0 8px ${isWork?'var(--accent-glow)':'var(--green-glow)'})` }}
                />
              </svg>
              <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
                <div style={{ fontFamily:'var(--font-display)',fontSize:44,letterSpacing:'-2px',color:'var(--timer-color)',lineHeight:1 }}>
                  {mm}<span style={{ opacity:0.25,fontSize:34 }}>:</span>{ss}
                </div>
                <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:isWork?'var(--accent)':'var(--green)',marginTop:6 }}>
                  {isWork?'focus':'break'}
                </div>
              </div>
            </div>

            <div style={{ display:'flex',flexDirection:'column',gap:16,flex:1,minWidth:140 }}>
              <div style={{ display:'flex',alignItems:'center',gap:16 }}>
                <button onClick={reset} style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--ctrl-color)',display:'flex',alignItems:'center',padding:6,touchAction:'manipulation' }}><ResetIcon/></button>
                <button onClick={()=>setRunning(r=>!r)} style={{ background:'transparent',border:'none',cursor:'pointer',color:accent,display:'flex',alignItems:'center',padding:6,touchAction:'manipulation' }}>
                  {running?<PauseIcon/>:<PlayIcon/>}
                </button>
              </div>
              <div style={{ height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',maxWidth:180 }}>
                <div style={{ height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${accent},${isWork?'#b07ef7':'#34d399'})`,borderRadius:99,transition:running?'width 1s linear':'none' }}/>
              </div>
              <div style={{ fontSize:12,color:'var(--text-3)' }}>{workMins}m focus · {brkMins}m break</div>
            </div>
          </div>

          {/* Alarm type */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px 18px',marginBottom:10 }}>
            <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12 }}>End alarm</div>
            <div style={{ display:'flex',gap:7 }}>
              {([{t:'bell',label:'Bell',sub:'8 rings'},{t:'chime',label:'Chime',sub:'Ascending'},{t:'beep',label:'Beep',sub:'Electronic'}] as const).map(({t,label,sub})=>(
                <button key={t} onClick={()=>setAlarmType(t)} style={{ flex:1,padding:'9px 8px',borderRadius:12,border:`0.5px solid ${alarmType===t?'var(--border-active)':'var(--border)'}`,background:alarmType===t?'var(--accent-soft)':'transparent',color:alarmType===t?'var(--accent)':'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:alarmType===t?500:300,transition:'all .18s',textAlign:'center',touchAction:'manipulation' }}>
                  <div>{label}</div><div style={{ fontSize:9,color:'var(--text-3)',marginTop:2 }}>{sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ambient */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px 18px',marginBottom:10 }}>
            <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12 }}>Ambient</div>
            <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
              {[{k:'rain',l:'🌧',n:'Rain'},{k:'forest',l:'🌿',n:'Forest'},{k:'cafe',l:'☕',n:'Café'},{k:'white',l:'〰',n:'White'}].map(({k,l,n})=>(
                <button key={k} onClick={()=>handleSound(k)} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',background:sound===k?'var(--accent-soft)':'var(--bg-pill)',border:`0.5px solid ${sound===k?'var(--border-active)':'var(--border)'}`,color:sound===k?'var(--accent)':'var(--text-2)',touchAction:'manipulation' }}>
                  <span style={{ fontSize:14 }}>{l}</span>{n}{sound===k&&<span style={{ fontSize:9,opacity:.6 }}>ON</span>}
                </button>
              ))}
              {sound&&<button onClick={()=>handleSound(null)} style={{ padding:'8px 12px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',background:'transparent',border:'0.5px solid var(--border)',color:'var(--text-3)',transition:'all .18s',touchAction:'manipulation' }}>Stop</button>}
            </div>
          </div>

          {/* Custom */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px 18px',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:showCustom?14:0 }}>
              <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)' }}>Custom timer</div>
              <div style={{ display:'flex',gap:7 }}>
                <button onClick={()=>setShowCustom(s=>!s)} style={{ padding:'5px 12px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',background:'var(--bg-pill)',border:'0.5px solid var(--border)',color:'var(--text-2)',transition:'all .18s',touchAction:'manipulation' }}>{showCustom?'Hide':'Manual'}</button>
                <button onClick={askAI} disabled={aiLoading} style={{ display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:999,fontSize:11,cursor:aiLoading?'default':'pointer',fontFamily:'var(--font-body)',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',opacity:aiLoading?.6:1,transition:'all .18s',touchAction:'manipulation' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
                  {aiLoading?'…':'AI suggest'}
                </button>
              </div>
            </div>
            {aiTip&&<div style={{ fontSize:12,color:'var(--text-2)',marginBottom:12,lineHeight:1.5,fontStyle:'italic' }}>"{aiTip}"</div>}
            {showCustom&&(
              <div style={{ display:'flex',alignItems:'center',gap:12,flexWrap:'wrap' }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)' }}>
                  Focus <input type="number" min={1} max={120} value={customWork} onChange={e=>setCustomWork(Number(e.target.value))} style={{ width:52,padding:'6px 8px',fontSize:13,textAlign:'center' }}/> min
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)' }}>
                  Break <input type="number" min={1} max={60} value={customBrk} onChange={e=>setCustomBrk(Number(e.target.value))} style={{ width:48,padding:'6px 8px',fontSize:13,textAlign:'center' }}/> min
                </div>
                <button onClick={applyCustom} style={{ padding:'7px 16px',borderRadius:999,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>Apply</button>
              </div>
            )}
          </div>

          {/* Session log */}
          {log.length>0&&(
            <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'16px 18px' }}>
              <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12 }}>Today</div>
              <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                {[...log].reverse().slice(0,6).map((s,i)=>(
                  <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:13,color:'var(--text-2)' }}>
                    <span style={{ color:s.mode==='work'?'var(--accent)':'var(--green)',fontWeight:500 }}>{s.mode==='work'?'Focus':'Break'}</span>
                    <span>{s.mins} min</span>
                    <span style={{ color:'var(--text-3)',fontSize:11 }}>{new Date(s.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// helper — avoids inline function call in JSX
function clamp(n: number) { return `clamp(16px,${n/16}vw,${n}px)` }