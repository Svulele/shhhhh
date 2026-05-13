import { useState, useEffect, useCallback } from 'react'
import { timerStore, setAlarmCallback } from '../timerStore'
import type { TimerState, TimerMode } from '../timerStore'

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
      const s1=S(),hp=F('highpass',1200),lp=F('lowpass',10000),g1=G(0.2)
      s1.connect(hp);hp.connect(lp);lp.connect(g1);s1.start();_nodes.push(s1,hp,lp,g1)
      const s2=S(),lp2=F('lowpass',160),g2=G(0.055)
      s2.connect(lp2);lp2.connect(g2);s2.start();_nodes.push(s2,lp2,g2)
    }
    if (type === 'forest') {
      const s=S(),bp=F('bandpass',480),g=G(0.07)
      s.connect(bp);bp.connect(g);s.start()
      const lfo=ctx.createOscillator(),lg=ctx.createGain()
      lfo.frequency.value=0.2;lg.gain.value=0.035;lfo.connect(lg);lg.connect(g.gain);lfo.start()
      _nodes.push(s,bp,g,lfo,lg)
    }
    if (type === 'cafe') {
      const s1=S(),b1=F('bandpass',680),g1=G(0.065)
      s1.connect(b1);b1.connect(g1);s1.start();_nodes.push(s1,b1,g1)
      const s2=S(),b2=F('bandpass',1250),g2=G(0.04)
      s2.connect(b2);b2.connect(g2);s2.start();_nodes.push(s2,b2,g2)
    }
  } catch {}
}

// ── Alarm — 8 escalating rings ────────────────────────────────
let _alarmCtx: AudioContext | null = null

export function playAlarm(type: 'bell' | 'chime' | 'beep') {
  try {
    if (_alarmCtx) { try { _alarmCtx.close() } catch {} }
    _alarmCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _alarmCtx
    if (type === 'beep') {
      const freqs=[440,523,587,659,740,830,932,1047]
      const vols=[0.15,0.2,0.25,0.3,0.35,0.42,0.5,0.6]
      const gaps=[0,0.45,0.85,1.2,1.55,1.85,2.1,2.3]
      freqs.forEach((f,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain()
        osc.type='square'
        osc.frequency.setValueAtTime(f,ctx.currentTime+gaps[i])
        g.gain.setValueAtTime(0,ctx.currentTime+gaps[i])
        g.gain.linearRampToValueAtTime(vols[i],ctx.currentTime+gaps[i]+0.01)
        g.gain.setValueAtTime(vols[i],ctx.currentTime+gaps[i]+0.18)
        g.gain.linearRampToValueAtTime(0,ctx.currentTime+gaps[i]+0.22)
        osc.connect(g);g.connect(ctx.destination)
        osc.start(ctx.currentTime+gaps[i]);osc.stop(ctx.currentTime+gaps[i]+0.25)
      })
    } else if (type === 'chime') {
      const freqs=[523,587,659,698,784,880,988,1047]
      const vols=[0.2,0.22,0.25,0.27,0.32,0.37,0.42,0.5]
      freqs.forEach((f,i)=>{
        const delay=i*0.55
        const osc=ctx.createOscillator(),g=ctx.createGain()
        osc.type='triangle'
        osc.frequency.setValueAtTime(f,ctx.currentTime+delay)
        osc.frequency.exponentialRampToValueAtTime(f*1.4,ctx.currentTime+delay+0.4)
        g.gain.setValueAtTime(vols[i],ctx.currentTime+delay)
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.9)
        osc.connect(g);g.connect(ctx.destination)
        osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+1)
      })
    } else {
      const delays=[0,2.2,4.0,5.5,6.7,7.6,8.3,8.9]
      const vols=[0.3,0.34,0.38,0.42,0.47,0.52,0.57,0.65]
      const freqs=[880,880,880,880,880,920,960,1000]
      delays.forEach((delay,i)=>{
        const osc=ctx.createOscillator(),g=ctx.createGain()
        osc.type='sine'
        osc.frequency.setValueAtTime(freqs[i],ctx.currentTime+delay)
        osc.frequency.exponentialRampToValueAtTime(freqs[i]/2,ctx.currentTime+delay+1.6)
        g.gain.setValueAtTime(vols[i],ctx.currentTime+delay)
        g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+1.8)
        osc.connect(g);g.connect(ctx.destination)
        osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+2)
      })
    }
  } catch {}
}

export function stopAlarm() {
  try { _alarmCtx?.close(); _alarmCtx = null } catch {}
}

// ── Hook: subscribe to global timer ──────────────────────────
function useTimerState() {
  const [state, setState] = useState<TimerState>(timerStore.get)
  useEffect(() => { return timerStore.subscribe(setState) }, [])
  return state
}

// ── Icons ─────────────────────────────────────────────────────
const PlayIcon  = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const PauseIcon = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
const ResetIcon = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
const ExpandIcon= () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>

// ── Done overlay ──────────────────────────────────────────────
function DoneOverlay({ mode, onDismiss }: { mode: TimerMode; onDismiss: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (['Enter',' ','Escape'].includes(e.key)) onDismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const isWork = mode === 'work'
  return (
    <div onClick={onDismiss} style={{ position:'fixed',inset:0,zIndex:9500,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .25s ease both' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:28,padding:'44px 52px',maxWidth:320,width:'90vw',textAlign:'center',boxShadow:'0 32px 80px rgba(0,0,0,.45)',animation:'scaleIn .3s var(--spring) both' }}>
        <div style={{ width:60,height:60,borderRadius:'50%',background:isWork?'var(--accent-soft)':'rgba(62,207,160,.1)',border:`1.5px solid ${isWork?'var(--border-active)':'rgba(62,207,160,.3)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={isWork?'var(--accent)':'var(--green)'} strokeWidth="2.2" strokeLinecap="round">
            {isWork ? <polyline points="20 6 9 17 4 12"/> : <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>}
          </svg>
        </div>
        <div style={{ fontFamily:'var(--font-display)',fontSize:24,letterSpacing:'-0.4px',color:'var(--text-1)',marginBottom:8 }}>
          {isWork ? 'Session done' : 'Break over'}
        </div>
        <div style={{ fontSize:13,color:'var(--text-3)',fontWeight:300,lineHeight:1.65,marginBottom:28 }}>
          {isWork ? 'Take a moment to breathe.' : 'Ready when you are.'}
        </div>
        <button onClick={onDismiss} style={{ padding:'11px 36px',borderRadius:999,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 18px var(--accent-glow)',touchAction:'manipulation' }}>
          {isWork ? 'Start break' : 'Back to focus'}
        </button>
        <div style={{ fontSize:11,color:'var(--text-3)',marginTop:10 }}>Tap anywhere · Enter</div>
      </div>
    </div>
  )
}

// ── Full-screen focus mode ────────────────────────────────────
function FocusMode({ sound, onSound, onExit }: {
  sound: string|null; onSound: (k:string|null)=>void; onExit: ()=>void
}) {
  const t = useTimerState()
  const { mm, ss, pct } = timerStore.fmt()
  const isWork = t.mode === 'work'
  const accent = isWork ? 'var(--accent)' : 'var(--green)'
  const glow   = isWork ? 'var(--accent-glow)' : 'var(--green-glow)'

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit()
      if (e.key === ' ') { e.preventDefault(); timerStore.toggle() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const border = 'var(--border)'

  const pill = (active: boolean): React.CSSProperties => ({
    padding: '5px 16px', borderRadius: 999, fontSize: 12,
    cursor: 'pointer', fontFamily: 'var(--font-body)',
    border: `0.5px solid ${active ? accent : border}`,
    background: 'transparent',
    color: active ? accent : 'var(--text-3)',
    fontWeight: active ? 500 : 300,
    transition: 'all .2s', touchAction: 'manipulation' as const,
  })

  const iconBtn = (active: boolean): React.CSSProperties => ({
    width: 40, height: 40, borderRadius: 12,
    border: `0.5px solid ${active ? accent : border}`,
    background: 'transparent',
    color: active ? accent : 'var(--text-3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all .18s', touchAction: 'manipulation' as const,
  })

  const circleBtn = (): React.CSSProperties => ({
    width: 46, height: 46, borderRadius: '50%',
    border: `0.5px solid ${border}`,
    background: 'transparent', color: 'var(--text-3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', touchAction: 'manipulation' as const,
  })

  const SoundIcon = ({ type, active }: { type: string; active: boolean }) => {
    const col = active ? accent : 'var(--text-3)'
    const s = { fill: 'none' as const, stroke: col, strokeWidth: 1.7, strokeLinecap: 'round' as const }
    if (type === 'rain') return (
      <svg width="17" height="17" viewBox="0 0 24 24" {...s}>
        <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
        <line x1="8" y1="19" x2="8" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/><line x1="12" y1="21" x2="12" y2="23"/>
      </svg>
    )
    if (type === 'forest') return (
      <svg width="17" height="17" viewBox="0 0 24 24" {...s} strokeLinejoin="round">
        <path d="M12 2L8 9h2l-3 6h4v4h2v-4h4l-3-6h2z"/>
      </svg>
    )
    if (type === 'cafe') return (
      <svg width="17" height="17" viewBox="0 0 24 24" {...s}>
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    )
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" {...s}>
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
      </svg>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'var(--bg)',
      overflow: 'hidden',
      animation: 'fadeIn .3s ease both',
      display: 'grid',
      // topbar | timer zone | controls — controls get fixed height, timer fills middle
      gridTemplateRows: 'auto 1fr auto',
      // Respect the floating nav bar height at bottom (~90px)
      paddingBottom: 'calc(var(--nav-bottom, 36px) + 70px)',
    }}>
      {/* Glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 70% 50% at 50% 42%, ${
          isWork ? 'rgba(80,110,240,0.07)' : 'rgba(40,200,140,0.06)'
        } 0%, transparent 65%)`,
        transition: 'background 1.5s ease',
      }}/>

      {/* ── ROW 1: TOP BAR ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '24px 28px 0',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 300, letterSpacing: '-2px', color: 'var(--text-2)', lineHeight: 1 }}>{t.sessions}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Sessions</div>
        </div>

        <div style={{ display: 'flex', borderRadius: 999, padding: 4, border: `0.5px solid ${border}`, background: 'transparent', gap: 2, marginTop: 2 }}>
          {(['work', 'break'] as TimerMode[]).map(m => (
            <button key={m} onClick={() => timerStore.switchMode(m)} style={pill(t.mode === m)}>
              {m === 'work' ? 'Focus' : 'Break'}
            </button>
          ))}
        </div>

        <button onClick={onExit} style={circleBtn()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── ROW 2: TIMER — fills entire middle zone, centered inside it ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex',
        alignItems: 'center',     // vertically centered in the zone
        justifyContent: 'center',
      }}>
        {t.running && <>
          <div style={{ position: 'absolute', width: '75vmin', height: '75vmin', borderRadius: '50%', border: `1px solid ${isWork ? 'rgba(99,140,245,0.05)' : 'rgba(62,207,160,0.05)'}`, animation: 'pulse 3s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', width: '58vmin', height: '58vmin', borderRadius: '50%', border: `0.5px solid ${isWork ? 'rgba(99,140,245,0.03)' : 'rgba(62,207,160,0.03)'}`, animation: 'pulse 3s ease-in-out infinite', animationDelay: '.9s' }}/>
        </>}

        {/* Timer — font size scales to fill the available zone */}
        <div style={{ display: 'flex', alignItems: 'center', userSelect: 'none' }}>
          <span style={{
            fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, serif",
            // Bigger clamp — fills the red rectangle
            fontSize: 'clamp(100px, 20vw, 240px)',
            fontWeight: 900, letterSpacing: '-6px',
            color: 'var(--text-1)', lineHeight: 0.9,
          }}>{mm}</span>

          {/* Double dot colon */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(8px, 1.5vw, 18px)',
            flexShrink: 0,
            width: 'clamp(24px, 3.5vw, 52px)',
            marginTop: 'clamp(10px, 1.8vw, 24px)',
          }}>
            <div style={{ width: 'clamp(10px, 1.3vw, 16px)', height: 'clamp(10px, 1.3vw, 16px)', borderRadius: '50%', background: 'var(--text-1)' }}/>
            <div style={{ width: 'clamp(10px, 1.3vw, 16px)', height: 'clamp(10px, 1.3vw, 16px)', borderRadius: '50%', background: 'var(--text-1)' }}/>
          </div>

          <span style={{
            fontFamily: "'Playfair Display', 'Instrument Serif', Georgia, serif",
            fontSize: 'clamp(100px, 20vw, 240px)',
            fontWeight: 900, letterSpacing: '-6px',
            color: 'var(--text-1)', lineHeight: 0.9,
          }}>{ss}</span>
        </div>
      </div>

      {/* ── ROW 3: CONTROLS — above nav bar, not overlapping it ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        gap: 14,
        padding: '0 32px 20px',   // bottom padding keeps it off the nav bar
      }}>
        {/* Play · Reset LEFT — Sounds CENTER — Spacer RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button onClick={timerStore.toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: accent, display: 'flex', padding: 0, touchAction: 'manipulation', filter: `drop-shadow(0 0 8px ${glow})` }}>
              {t.running
                ? <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18" rx="1.5"/><rect x="15" y="3" width="4" height="18" rx="1.5"/></svg>
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              }
            </button>
            <button onClick={timerStore.reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0, touchAction: 'manipulation' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {(['rain', 'forest', 'cafe', 'white'] as const).map(k => (
              <button key={k} onClick={() => onSound(sound === k ? null : k)} style={iconBtn(sound === k)}>
                <SoundIcon type={k} active={sound === k}/>
              </button>
            ))}
            <button onClick={() => onSound(sound ? null : 'rain')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: sound ? 'var(--text-3)' : 'var(--text-4)', display: 'flex', marginLeft: 4, padding: 0, touchAction: 'manipulation' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                {sound
                  ? <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                  : <><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                }
              </svg>
            </button>
          </div>

          <div style={{ width: 68 }}/>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: 'var(--text-4)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: accent, borderRadius: 99, transition: t.running ? 'width 1s linear' : 'none', boxShadow: `0 0 6px ${glow}` }}/>
        </div>

        {/* Alarm */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', fontFamily: 'var(--font-body)' }}>Alarm</span>
          <div style={{ display: 'flex', gap: 7 }}>
            {(['bell', 'chime', 'beep'] as const).map(a => (
              <button key={a} onClick={() => timerStore.setAlarmType(a)} style={pill(t.alarmType === a)}>{a}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
// ── Main Pomodoro page ────────────────────────────────────────
export default function Pomodoro() {
  const t = useTimerState()
  const { mm, ss, pct } = timerStore.fmt()
  const [sound,      setSound]      = useState<string|null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(t.workMins)
  const [customBrk,  setCustomBrk]  = useState(t.brkMins)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiTip,      setAiTip]      = useState<string|null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [showDone,   setShowDone]   = useState(false)
  const [doneMode,   setDoneMode]   = useState<TimerMode>('work')

  // Register alarm callback — fires even if user is on another page
  useEffect(() => {
    setAlarmCallback((mode, type) => {
      playAlarm(type)
      setDoneMode(mode); setShowDone(true)
    })
    return () => setAlarmCallback(null)
  }, [])

  const handleSound = useCallback(async (key: string|null) => {
    if (!key || sound === key) { stopAmbient(); setSound(null); return }
    setSound(key); try { await playAmbient(key) } catch { stopAmbient(); setSound(null) }
  }, [sound])

  const applyCustom = () => {
    timerStore.setDurations(customWork, customBrk); setShowCustom(false)
  }

  const askAI = async () => {
    setAiLoading(true); setAiTip(null)
    const p = (() => { try { return JSON.parse(localStorage.getItem('shh_profile')??'{}') } catch { return {} } })()
    try {
      const res = await fetch((import.meta.env.VITE_API_URL??'http://localhost:3001')+'/api/chat',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:120,system:'Reply ONLY with valid JSON.',
          messages:[{role:'user',content:`Goals: ${p.goals?.join(',')||'study'}, vibe: ${p.vibe||'balanced'}. Suggest Pomodoro minutes. JSON: {"work":25,"break":5,"tip":"one sentence"}`}]})
      })
      const data = await res.json()
      const parsed = JSON.parse((data.content??[]).map((c:any)=>c.text??'').join('').replace(/```json|```/g,'').trim())
      timerStore.setDurations(parsed.work??25, parsed.break??5)
      setCustomWork(parsed.work??25); setCustomBrk(parsed.break??5)
      setAiTip(parsed.tip); setShowCustom(false)
    } catch { setAiTip('Could not reach AI.') }
    setAiLoading(false)
  }

  const isWork = t.mode === 'work'
  const accent = isWork ? 'var(--accent)' : 'var(--green)'
  const circ   = 2 * Math.PI * 90

  return (
    <>
      {fullscreen && <FocusMode sound={sound} onSound={handleSound} onExit={()=>setFullscreen(false)}/>}
      {showDone   && <DoneOverlay mode={doneMode} onDismiss={()=>{ stopAlarm(); setShowDone(false) }}/>}

      <div className="page-scroll">
        <div style={{ maxWidth:640,margin:'0 auto',padding:'clamp(24px,4vw,44px) clamp(16px,4vw,44px) 120px' }}>

          {/* Header */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', Georgia, serif",fontWeight:700,fontSize:30,letterSpacing:'-0.8px',color:'var(--text-1)',marginBottom:3 }}>Focus</div>
              <div style={{ fontSize:12,color:'var(--text-3)' }}>{t.sessions} session{t.sessions!==1?'s':''} today</div>
            </div>
            <button onClick={()=>setFullscreen(true)} style={{ display:'flex',alignItems:'center',gap:7,padding:'8px 16px',borderRadius:999,border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .2s',touchAction:'manipulation' }}>
              <ExpandIcon/> Full screen
            </button>
          </div>

          {/* Mode tabs */}
          <div style={{ display:'flex',gap:6,marginBottom:24 }}>
            {(['work','break'] as TimerMode[]).map(m=>(
              <button key={m} onClick={()=>timerStore.switchMode(m)} style={{ padding:'6px 16px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',border:'0.5px solid var(--border)',background:t.mode===m?'var(--bg-pill)':'transparent',color:t.mode===m?'var(--text-1)':'var(--text-3)',transition:'all .18s',touchAction:'manipulation' }}>
                {m==='work'?'Focus':'Break'}
              </button>
            ))}
          </div>

          {/* Ring + controls */}
          <div style={{ display:'flex',alignItems:'center',gap:28,flexWrap:'wrap',marginBottom:24 }}>
            <div style={{ position:'relative',flexShrink:0 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="var(--text-4)" strokeWidth="6"/>
                <circle cx="100" cy="100" r="90" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)}
                  style={{ transition:t.running?'stroke-dashoffset 1s linear':'none',filter:`drop-shadow(0 0 8px ${isWork?'var(--accent-glow)':'var(--green-glow)'})` }}
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
                <button onClick={timerStore.reset} style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--ctrl-color)',display:'flex',padding:6,touchAction:'manipulation' }}><ResetIcon/></button>
                <button onClick={timerStore.toggle} style={{ background:'transparent',border:'none',cursor:'pointer',color:accent,display:'flex',padding:6,touchAction:'manipulation' }}>
                  {t.running?<PauseIcon/>:<PlayIcon/>}
                </button>
              </div>
              <div style={{ height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',maxWidth:180 }}>
                <div style={{ height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${accent},${isWork?'#b07ef7':'#34d399'})`,borderRadius:99,transition:t.running?'width 1s linear':'none' }}/>
              </div>
              <div style={{ fontSize:12,color:'var(--text-3)' }}>{t.workMins}m focus · {t.brkMins}m break</div>
            </div>
          </div>

          {/* Alarm */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'14px 16px',marginBottom:10 }}>
            <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10 }}>End alarm</div>
            <div style={{ display:'flex',gap:6 }}>
              {([{v:'bell',l:'Bell',s:'8 rings'},{v:'chime',l:'Chime',s:'Ascending'},{v:'beep',l:'Beep',s:'Electronic'}] as const).map(({v,l,s})=>(
                <button key={v} onClick={()=>timerStore.setAlarmType(v)} style={{ flex:1,padding:'8px 6px',borderRadius:10,border:`0.5px solid ${t.alarmType===v?'var(--border-active)':'var(--border)'}`,background:t.alarmType===v?'var(--accent-soft)':'transparent',color:t.alarmType===v?'var(--accent)':'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:t.alarmType===v?500:300,textAlign:'center',touchAction:'manipulation' }}>
                  <div>{l}</div><div style={{ fontSize:9,color:'var(--text-3)',marginTop:1 }}>{s}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ambient */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'14px 16px',marginBottom:10 }}>
            <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10 }}>Ambient</div>
            <div style={{ display:'flex',gap:7,flexWrap:'wrap' }}>
              {[{k:'rain',l:'🌧',n:'Rain'},{k:'forest',l:'🌿',n:'Forest'},{k:'cafe',l:'☕',n:'Café'},{k:'white',l:'〰',n:'White'}].map(({k,l,n})=>(
                <button key={k} onClick={()=>handleSound(k)} style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 13px',borderRadius:999,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',background:sound===k?'var(--accent-soft)':'var(--bg-pill)',border:`0.5px solid ${sound===k?'var(--border-active)':'var(--border)'}`,color:sound===k?'var(--accent)':'var(--text-2)',touchAction:'manipulation' }}>
                  <span>{l}</span>{n}{sound===k&&<span style={{ fontSize:9,opacity:.6 }}>•</span>}
                </button>
              ))}
              {sound&&<button onClick={()=>handleSound(null)} style={{ padding:'7px 11px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',background:'transparent',border:'0.5px solid var(--border)',color:'var(--text-3)',touchAction:'manipulation' }}>Stop</button>}
            </div>
          </div>

          {/* Custom */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'14px 16px',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)' }}>Custom timer</div>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={()=>setShowCustom(s=>!s)} style={{ padding:'4px 11px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',background:'var(--bg-pill)',border:'0.5px solid var(--border)',color:'var(--text-2)',touchAction:'manipulation' }}>{showCustom?'Hide':'Manual'}</button>
                <button onClick={askAI} disabled={aiLoading} style={{ display:'flex',alignItems:'center',gap:4,padding:'4px 11px',borderRadius:999,fontSize:11,cursor:aiLoading?'default':'pointer',fontFamily:'var(--font-body)',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',opacity:aiLoading?.6:1,touchAction:'manipulation' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
                  {aiLoading?'…':'AI'}
                </button>
              </div>
            </div>
            {aiTip&&<div style={{ fontSize:12,color:'var(--text-2)',marginTop:10,lineHeight:1.5,fontStyle:'italic' }}>"{aiTip}"</div>}
            {showCustom&&(
              <div style={{ display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:12 }}>
                <label style={{ display:'flex',alignItems:'center',gap:7,fontSize:13,color:'var(--text-2)' }}>
                  Focus <input type="number" min={1} max={120} value={customWork} onChange={e=>setCustomWork(Number(e.target.value))} style={{ width:50,padding:'5px 7px',fontSize:13,textAlign:'center' }}/> m
                </label>
                <label style={{ display:'flex',alignItems:'center',gap:7,fontSize:13,color:'var(--text-2)' }}>
                  Break <input type="number" min={1} max={60} value={customBrk} onChange={e=>setCustomBrk(Number(e.target.value))} style={{ width:44,padding:'5px 7px',fontSize:13,textAlign:'center' }}/> m
                </label>
                <button onClick={applyCustom} style={{ padding:'6px 15px',borderRadius:999,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>Apply</button>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
