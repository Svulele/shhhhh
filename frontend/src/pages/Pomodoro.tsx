import { useLandscapePhone } from '../useLandscapePhone'
import { useWakeLock } from '../useWakeLock'
import { clockStore } from '../clockStore'
import { clockEligible } from '../clockRules'
import InputHint from '../components/InputHint'
import { plural } from '../plural'
import { keyboardShortcutsEnabled } from '../useInputMode'
import useOverlayBack from '../components/useOverlayBack'
import { aiFetch, API_URL } from '../api'
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { timerStore, setAlarmCallback } from '../timerStore'
import type { TimerState, TimerMode } from '../timerStore'
import Icon from '../components/Icon'
import { createPortal } from 'react-dom'
import useModalFocus from '../components/useModalFocus'

// ── Ambient audio ─────────────────────────────────────────────
let _ctx: AudioContext | null = null
let _nodes: AudioNode[] = []
let _cur: string | null = null
let audioGeneration = 0
const alarmNodes = new Set<AudioNode>()
function audioContext() {
  if (!_ctx || _ctx.state === 'closed') _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  if (_ctx.state === 'suspended') void _ctx.resume()
  return _ctx
}
function suspendIdleAudio() { if (!_nodes.length && !alarmNodes.size && _ctx?.state === 'running') void _ctx.suspend() }

function stopAmbient() {
  _nodes.forEach(n => { try { (n as any).stop?.(); n.disconnect() } catch {} })
  _nodes = []; _cur = null; window.dispatchEvent(new Event('shh:ambient')); audioGeneration++; suspendIdleAudio()
}

async function playAmbient(type: string) {
  if (_cur === type) return
  stopAmbient(); _cur = type; window.dispatchEvent(new Event('shh:ambient'))
  try {
    const generation = audioGeneration
    const ctx = audioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    if (generation !== audioGeneration) { suspendIdleAudio(); return }
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
// Ambient and alarm share one context; sources disconnect after their final sample.

export function playAlarm(type: 'bell' | 'chime' | 'beep') {
  try {
    stopAlarm()
    const ctx = audioContext()
    const track = (osc: OscillatorNode, gain: GainNode) => {
      alarmNodes.add(osc); alarmNodes.add(gain)
      osc.onended = () => { osc.disconnect(); gain.disconnect(); alarmNodes.delete(osc); alarmNodes.delete(gain); suspendIdleAudio() }
    }
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
        track(osc,g);osc.connect(g);g.connect(ctx.destination)
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
        track(osc,g);osc.connect(g);g.connect(ctx.destination)
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
        track(osc,g);osc.connect(g);g.connect(ctx.destination)
        osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+2)
      })
    }
  } catch {}
}

export function stopAlarm() {
  for (const node of alarmNodes) { try { (node as AudioScheduledSourceNode).stop?.(); node.disconnect() } catch {} }
  alarmNodes.clear(); suspendIdleAudio()
}

// ── Hook: subscribe to global timer ──────────────────────────
function useTimerState() {
  const [state, setState] = useState<TimerState>(timerStore.get)
  useEffect(() => { return timerStore.subscribe(setState) }, [])
  return state
}

// ── Icons ─────────────────────────────────────────────────────
const PlayIcon = () => <Icon name="play" size={26} />
const PauseIcon = () => <Icon name="pause" size={26} />
const ResetIcon = () => <Icon name="reset" size={20} />
const ExpandIcon = () => <Icon name="expand" size={18} />

// ── Done overlay ──────────────────────────────────────────────
function DoneOverlay({ mode, onDismiss }: { mode: TimerMode; onDismiss: () => void }) {
  const ref=useRef<HTMLDivElement>(null)
  useModalFocus(ref,true,onDismiss)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (keyboardShortcutsEnabled() && ['Enter',' ','Escape'].includes(e.key)) onDismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onDismiss])
  const isWork = mode === 'work'
  return (
    <div onClick={onDismiss} style={{ position:'fixed',inset:0,zIndex:9500,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .25s ease both' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={isWork?'Focus session complete':'Break complete'} onClick={e=>e.stopPropagation()} style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:28,padding:'44px 52px',maxWidth:320,width:'90vw',textAlign:'center',boxShadow:'0 32px 80px rgba(0,0,0,.45)',animation:'scaleIn .3s var(--spring) both' }}>
        <div style={{ width:60,height:60,borderRadius:'50%',background:isWork?'var(--accent-soft)':'rgba(62,207,160,.1)',border:`1.5px solid ${isWork?'var(--border-active)':'rgba(62,207,160,.3)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}>
          <Icon name={isWork?"check":"cafe"} size={26} />
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
        <div style={{ fontSize:11,color:'var(--text-3)',marginTop:10 }}><InputHint touch="Tap outside to continue" keys="Click outside or press Enter to continue" /></div>
      </div>
    </div>
  )
}

function useAmbient() {
  const [sound, setSound] = useState<string|null>(()=>_cur);
  useEffect(() => { const sync=()=>setSound(_cur);window.addEventListener('shh:ambient',sync);return()=>window.removeEventListener('shh:ambient',sync); }, []);
  const change=useCallback(async(key:string|null)=>{ if(!key||_cur===key){stopAmbient();return;}try{await playAmbient(key)}catch{stopAmbient()} },[]);
  return {sound, change};
}
const readClockPreferences=()=>{try{const p=JSON.parse(localStorage.getItem('shh_profile')??'{}');return `${p.rotateClock!==false}:${p.rotateClockAnyPage===true}`;}catch{return 'true:false'}};
const subscribeClockPreferences=(cb:()=>void)=>{window.addEventListener('shh:profile-updated',cb);window.addEventListener('storage',cb);return()=>{window.removeEventListener('shh:profile-updated',cb);window.removeEventListener('storage',cb)}};
export function TimerFullscreen({page, reader}:{page:string;reader:boolean}) {
  const landscape=useLandscapePhone();
  const running=useSyncExternalStore(timerStore.subscribe,()=>timerStore.get().running,()=>false);
  const preferences=useSyncExternalStore(subscribeClockPreferences,readClockPreferences,()=> 'true:false');
  const state=useSyncExternalStore(clockStore.subscribe,clockStore.getSnapshot,clockStore.getSnapshot);
  const [rotate,anyPage]=preferences.split(':').map(value=>value==='true');
  const eligible=clockEligible(page,reader,running,rotate,anyPage);
  useEffect(()=>{clockStore.dispatch({type:'environment',landscape,eligible})},[landscape,eligible]);
  useEffect(()=>()=>clockStore.dispatch({type:'close',landscape:false}),[]);
  const exit=useCallback(()=>clockStore.dispatch({type:'close',landscape:matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)').matches}),[]);
  const {sound,change}=useAmbient();
  return state.source ? <FocusMode source={state.source} sound={sound} onSound={change} onExit={exit}/> : null;
}

// ── Full-screen focus mode ────────────────────────────────────
function FocusMode({ source, sound, onSound, onExit }: {
  source: 'auto'|'manual';
  sound: string|null; onSound: (k:string|null)=>void; onExit: ()=>void
}) {
  useOverlayBack(true, onExit)
  const t = useTimerState()
  const { mm, ss, pct } = timerStore.fmt()
  const landscape=useLandscapePhone();
  const [dockShown,setDockShown]=useState(true);
  const [dockActivity,setDockActivity]=useState(0);
  useWakeLock(t.running);
  useEffect(()=>timerStore.subscribe(next=>{if(!next.running)setDockShown(true)}),[]);
  useEffect(()=>{if(!landscape||!t.running||!dockShown)return;const id=setTimeout(()=>setDockShown(false),4000);return()=>clearTimeout(id)},[landscape,t.running,dockShown,dockActivity]);
  const touchClock=()=>{if(document.documentElement.dataset.input!=='touch'||window.getSelection()?.toString())return;if(landscape){setDockShown(value=>!value);setDockActivity(value=>value+1)}else timerStore.toggle()};
  const ref = useRef<HTMLDivElement>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const element = ref.current
    const previous = document.activeElement as HTMLElement | null
    const app = document.querySelector<HTMLElement>('.app')
    const wasInert = app?.inert || false
    if(app) app.inert = true
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let entered = false, disposed = false
    if (source === 'manual' && element?.requestFullscreen) void element.requestFullscreen().then(() => { if(disposed) { if(document.fullscreenElement===element) void document.exitFullscreen(); } else entered = true }).catch(() => { /* fixed overlay fallback */ })
    element?.querySelector<HTMLButtonElement>('button[aria-label="Close full screen"]')?.focus()
    const change = () => { if (entered && !document.fullscreenElement) onExit() }
    const key = (e: KeyboardEvent) => {
      if(keyboardShortcutsEnabled() && e.key==='Escape'){e.preventDefault();onExit()}
      if(keyboardShortcutsEnabled() && e.key===' ' && !(e.target as HTMLElement).closest('button,input,select,textarea,[contenteditable]:not([contenteditable=false])')){e.preventDefault();timerStore.toggle()}
      if(e.key==='Tab') {
        const buttons = Array.from(element?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []).filter(button=>!button.closest('[inert]'))
        const first=buttons[0],last=buttons[buttons.length-1]
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus()}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus()}
      }
    }
    document.addEventListener('fullscreenchange',change)
    document.addEventListener('keydown',key)
    return () => {
      disposed = true
      document.removeEventListener('fullscreenchange',change);document.removeEventListener('keydown',key)
      if(document.fullscreenElement===element) void document.exitFullscreen().catch(()=>{})
      document.body.style.overflow=oldOverflow
      if(app) app.inert = wasInert
      previous?.focus()
      if(previewTimer.current){clearTimeout(previewTimer.current);stopAlarm()}
    }
  }, [onExit,source])
  const preview = (type: 'bell'|'chime'|'beep') => {
    if(previewTimer.current) clearTimeout(previewTimer.current)
    timerStore.setAlarmType(type);playAlarm(type)
    previewTimer.current=setTimeout(()=>{stopAlarm();previewTimer.current=null},1200)
  }
  return createPortal(<div className={`fullscreen-focus ${landscape && !dockShown ? 'clock-dock-hidden' : ''}`} data-source={source} ref={ref} role="dialog" aria-modal="true" aria-label="Full screen focus timer">
    <div className="fullscreen-top"><span>{plural(t.sessions, 'session')}</span><div className="mode-segment">{(['work','break'] as TimerMode[]).map(m=><button key={m} aria-pressed={t.mode===m} onClick={()=>timerStore.switchMode(m)}>{m==='work'?'Focus':'Break'}</button>)}</div><button className="round-button" aria-label="Close full screen" onClick={onExit}><Icon name="close" /></button></div>
    <div className="fullscreen-clock" onClick={touchClock}><div role="timer" aria-label={`${plural(Number(mm), 'minute')} ${plural(Number(ss), 'second')} remaining`}>{mm}:{ss}</div><div className="fullscreen-progress" role="progressbar" aria-label="Session progress" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${pct}%`}} /></div><p>{t.mode==='work'?'Nothing else needs your attention right now.':'Breathe. Let your mind wander.'}</p></div>
    <div className="fullscreen-bottom" onPointerDown={()=>setDockActivity(value=>value+1)} inert={landscape && !dockShown}><div className="fullscreen-dock"><button className="round-button primary" aria-label={t.running?'Pause session':'Start session'} onClick={timerStore.toggle}><Icon name={t.running?'pause':'play'} size={26} /></button><button className="round-button" aria-label="Reset timer" onClick={timerStore.reset}><Icon name="reset" /></button><span className="dock-divider" />{[{k:'rain',n:'Rain'},{k:'forest',n:'Forest'},{k:'cafe',n:'Café'},{k:'white',n:'White noise'}].map(({k,n})=><button className="round-button" key={k} title={n} aria-label={n} aria-pressed={sound===k} onClick={()=>onSound(k)}><Icon name={k} /></button>)}<button className="round-button" aria-label="Mute ambient sound" aria-pressed={!sound} onClick={()=>onSound(null)}><Icon name="mute" /></button></div><div className="alarm-row"><span className="eyebrow">Alarm</span>{(['bell','chime','beep'] as const).map(type=><button className="ui-button" key={type} aria-pressed={t.alarmType===type} onClick={()=>preview(type)}>{type[0].toUpperCase()+type.slice(1)}</button>)}</div><small className="fullscreen-help"><InputHint touch={landscape?"Tap the clock to show or hide controls":"Tap to start or pause"} keys="Space to start or pause · Esc to return" /></small></div>
  </div>,document.body)
}

// The alarm UI stays mounted as pages change, just like the shared timer.
export function TimerAlarm() {
  const [done, setDone] = useState<TimerMode | null>(null)
  const [host,setHost] = useState<Element>(document.body)
  useEffect(()=>{const sync=()=>setHost(document.fullscreenElement || document.body);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync)},[])
  useEffect(() => {
    setAlarmCallback((mode,type)=>{playAlarm(type);setDone(mode)})
    return () => setAlarmCallback(null)
  }, [])
  const dismiss = useCallback(()=>{stopAlarm();setDone(null)},[])
  return done ? createPortal(<DoneOverlay mode={done} onDismiss={dismiss} />, host) : null
}

function FocusClock() {
  const t = useTimerState()
  const { mm, ss, pct } = timerStore.fmt()
  const circ = 2 * Math.PI * 134
  return (<div className={`focus-ring ${t.running?'running':''}`}>
            <svg viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="focus-gradient"><stop stopColor="#7c6cff"/><stop offset="1" stopColor="#c79bff"/></linearGradient></defs><circle cx="150" cy="150" r="134" fill="none" stroke="var(--soft)" strokeWidth="9"/><circle cx="150" cy="150" r="134" fill="none" stroke="url(#focus-gradient)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} /></svg>
            <div><span className="focus-time" role="timer" aria-label={`${plural(Number(mm), 'minute')} ${plural(Number(ss), 'second')} remaining`}>{mm}:{ss}</span><span className="focus-mode-label">{t.mode==='work'?'Stay in your flow':'Take a breath'}</span></div>
          </div>)
}

export default function Pomodoro() {
  const [t, setTimerConfig] = useState(timerStore.get)
  useEffect(() => timerStore.subscribe(next => setTimerConfig(previous =>
    previous.mode === next.mode && previous.running === next.running && previous.sessions === next.sessions && previous.workMins === next.workMins && previous.brkMins === next.brkMins && previous.alarmType === next.alarmType ? previous : next
  )), [])
  const {sound,change:handleSound}=useAmbient()
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(t.workMins)
  const [customBrk,  setCustomBrk]  = useState(t.brkMins)
  const [aiLoading,  setAiLoading]  = useState(false)
  const [aiTip,      setAiTip]      = useState<string|null>(null)
  const applyCustom = () => {
    timerStore.setDurations(customWork, customBrk); setShowCustom(false)
  }

  const askAI = async () => {
    setAiLoading(true); setAiTip(null)
    const p = (() => { try { return JSON.parse(localStorage.getItem('shh_profile')??'{}') } catch { return {} } })()
    try {
      const res = await aiFetch(API_URL + '/api/chat',{
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

  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')) { e.preventDefault(); clockStore.dispatch({type:'manual'}) } }
    window.addEventListener('keydown',handle)
    return () => window.removeEventListener('keydown',handle)
  }, [])
  return <>
      <div className="page-scroll"><section className="focus-page">
        <div className="focus-heading"><div><h1 className="page-title">Time to <em className="title-accent">focus.</em></h1><p className="page-subtitle">One thing at a time. You're doing enough.</p></div><button className="ui-button" onClick={()=>clockStore.dispatch({type:'manual'})}><ExpandIcon />Full screen</button></div>
        <div className="focus-card soft-card">
          <div className="focus-toolbar">
          <div className="mode-segment">{(['work','break'] as TimerMode[]).map(m=><button key={m} aria-pressed={t.mode===m} onClick={()=>timerStore.switchMode(m)}>{m==='work'?`Focus · ${t.workMins} min`:`Break · ${t.brkMins} min`}</button>)}</div>
        <aside className="focus-custom" aria-label="Custom timer">
          {/* Custom */}
          <div style={{ background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,padding:'14px 16px',marginBottom:10 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <div style={{ fontSize:9,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)' }}>Custom timer</div>
              <div style={{ display:'flex',gap:8 }}>
                <button aria-expanded={showCustom} aria-controls="custom-timer-fields" onClick={()=>setShowCustom(s=>!s)} style={{ padding:'4px 11px',borderRadius:999,fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',background:'var(--bg-pill)',border:'0.5px solid var(--border)',color:'var(--text-2)',touchAction:'manipulation' }}>{showCustom?'Hide settings':'Set time'}</button>
                <button aria-label="Suggest timer durations with AI" onClick={askAI} disabled={aiLoading} style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 11px',borderRadius:999,fontSize:11,cursor:aiLoading?'default':'pointer',fontFamily:'var(--font-body)',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',opacity:aiLoading?.6:1,touchAction:'manipulation' }}>
                  <Icon name="ask" size={9} />
                  {aiLoading?'Thinking…':'Suggest with AI'}
                </button>
              </div>
            </div>
            {aiTip&&<div style={{ fontSize:12,color:'var(--text-2)',marginTop:10,lineHeight:1.5,fontStyle:'italic' }}>"{aiTip}"</div>}
            {showCustom&&(
              <div id="custom-timer-fields" style={{ display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:12 }}>
                <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)' }}>
                  Focus <input type="number" inputMode="numeric" enterKeyHint="done" min={1} max={120} value={customWork} onChange={e=>setCustomWork(Number(e.target.value))} style={{ width:50,padding:'5px 7px',fontSize:13,textAlign:'center' }}/> m
                </label>
                <label style={{ display:'flex',alignItems:'center',gap:8,fontSize:13,color:'var(--text-2)' }}>
                  Break <input type="number" inputMode="numeric" enterKeyHint="done" min={1} max={60} value={customBrk} onChange={e=>setCustomBrk(Number(e.target.value))} style={{ width:44,padding:'5px 7px',fontSize:13,textAlign:'center' }}/> m
                </label>
                <button onClick={applyCustom} style={{ padding:'6px 15px',borderRadius:999,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',color:'var(--accent)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>Apply</button>
              </div>
            )}
          </div>

        </aside>
          </div>
          <FocusClock />
          <div className="focus-controls"><button className="ui-button primary" onClick={timerStore.toggle}>{t.running?<PauseIcon />:<PlayIcon />}{t.running?'Pause':'Start'} session</button><button className="round-button" aria-label="Reset timer" onClick={timerStore.reset}><ResetIcon /></button></div>
          <p className="focus-session-count">{plural(t.sessions, 'focus session')} completed</p>
          <div className="ambient-row">{[{k:'rain',n:'Rain'},{k:'forest',n:'Forest'},{k:'cafe',n:'Café'},{k:'white',n:'White noise'}].map(({k,n})=><button className="ui-button" key={k} aria-pressed={sound===k} onClick={()=>handleSound(k)}><Icon name={k} size={18} />{n}</button>)}<button className="round-button" aria-label="Mute ambient sound" onClick={()=>handleSound(null)}><Icon name="mute" size={18} /></button></div>
          <div className="alarm-row"><span className="eyebrow">End alarm</span>{(['bell','chime','beep'] as const).map(v=><button className="ui-button" key={v} aria-pressed={t.alarmType===v} onClick={()=>timerStore.setAlarmType(v)}><Icon name="bell" size={16} />{v[0].toUpperCase()+v.slice(1)}</button>)}</div>
        </div>
      </section></div>
    </>
}
