import { useState, useEffect, useRef } from 'react'

// ── Ambient audio ─────────────────────────────────────────────
let _ctx: AudioContext | null = null
let _nodes: AudioNode[] = []
let _currentSound: string | null = null

function stopAmbient() {
  _nodes.forEach(n => { try { (n as any).stop?.(); n.disconnect() } catch {} })
  _nodes = []; _currentSound = null
}

async function playAmbient(type: string) {
  if (_currentSound === type) return
  stopAmbient(); _currentSound = type
  try {
    if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    else if (_ctx.state === 'suspended') await _ctx.resume()
    else if (_ctx.state === 'closed') _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _ctx
    const len = ctx.sampleRate * 4
    const nb  = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) { const d = nb.getChannelData(c); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1 }
    const S = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; return s }
    const G = (v: number) => { const g = ctx.createGain(); g.gain.value = v; g.connect(ctx.destination); return g }
    const F = (t: BiquadFilterType, f: number) => { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; return x }
    if (type === 'white') { const s = S(), g = G(0.1); s.connect(g); s.start(); _nodes.push(s, g) }
    if (type === 'rain') {
      const s1 = S(), hp = F('highpass', 1200), lp = F('lowpass', 10000), g1 = G(0.22)
      s1.connect(hp); hp.connect(lp); lp.connect(g1); s1.start(); _nodes.push(s1, hp, lp, g1)
      const s2 = S(), lp2 = F('lowpass', 160), g2 = G(0.06); s2.connect(lp2); lp2.connect(g2); s2.start(); _nodes.push(s2, lp2, g2)
    }
    if (type === 'forest') {
      const s = S(), bp = F('bandpass', 480), g = G(0.08)
      const lfo = ctx.createOscillator(), lg = ctx.createGain()
      lfo.frequency.value = 0.25; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain)
      s.connect(bp); bp.connect(g); s.start(); lfo.start(); _nodes.push(s, bp, g, lfo, lg)
    }
    if (type === 'cafe') {
      const s1 = S(), b1 = F('bandpass', 680), g1 = G(0.07); s1.connect(b1); b1.connect(g1); s1.start(); _nodes.push(s1, b1, g1)
      const s2 = S(), b2 = F('bandpass', 1250), g2 = G(0.045); s2.connect(b2); b2.connect(g2); s2.start(); _nodes.push(s2, b2, g2)
    }
  } catch (e) { console.warn('Ambient:', e) }
}

// ── Alarm ─────────────────────────────────────────────────────
let _alarmCtx: AudioContext | null = null

function playAlarm(type: 'bell' | 'chime' | 'beep' = 'bell', onDone?: () => void) {
  try {
    _alarmCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _alarmCtx
    const ring = (delay: number, freq: number, freq2: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      if (type === 'beep') {
        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
        gain.gain.setValueAtTime(vol * 0.3, ctx.currentTime + delay)
        gain.gain.setValueAtTime(0, ctx.currentTime + delay + dur)
      } else if (type === 'chime') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + delay + dur * 0.3)
        gain.gain.setValueAtTime(vol, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur)
      } else {
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
        osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + delay + dur)
        gain.gain.setValueAtTime(vol, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur)
      }
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur + 0.05)
    }
    if (type === 'beep') { ring(0, 880, 880, 0.12, 0.6); ring(0.2, 880, 880, 0.12, 0.6); ring(0.4, 1050, 1050, 0.18, 0.6) }
    else if (type === 'chime') { ring(0, 523, 523, 1.2, 0.45); ring(0.8, 659, 659, 1.2, 0.38); ring(1.6, 784, 784, 1.4, 0.32) }
    else { ring(0, 880, 440, 1.8, 0.5); ring(2.2, 880, 440, 1.8, 0.4); ring(4.4, 880, 330, 2.0, 0.35) }
    if (onDone) setTimeout(onDone, type === 'beep' ? 900 : type === 'chime' ? 3500 : 7000)
  } catch {}
}

function stopAlarm() { try { _alarmCtx?.close(); _alarmCtx = null } catch {} }

// ── Types ─────────────────────────────────────────────────────
interface SessionLog { mode: 'work' | 'break'; mins: number; ts: number }

// ── SVG icons (thin-stroke, matching app style) ───────────────
const IconReset = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
  </svg>
)
const IconPlay = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)
const IconPause = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
    <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
)
const IconExpand = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)
const IconSoundOn = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
)
const IconSoundOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
  </svg>
)

// Sound SVG icons
const SoundRainIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 15.3"/>
    <line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>
    <line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>
    <line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>
  </svg>
)
const SoundForestIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
    <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
  </svg>
)
const SoundCafeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z"/>
    <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
  </svg>
)
const SoundWhiteIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <path d="M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M12 2v2m0 16v2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
  </svg>
)

// ── Full-screen focus overlay ─────────────────────────────────
function FocusScreen({
  mm, ss, pct, mode, running, sessions, sound,
  onPlayPause, onReset, onExit, onSound,
  alarmType, setAlarmType,
}: {
  mm: string; ss: string; pct: number
  mode: 'work' | 'break'; running: boolean; sessions: number; sound: string | null
  onPlayPause: () => void; onReset: () => void; onExit: () => void
  onSound: (k: string | null) => void
  alarmType: 'bell' | 'chime' | 'beep'; setAlarmType: (t: 'bell' | 'chime' | 'beep') => void
}) {
  const circ = 2 * Math.PI * 120
  const isBreak = mode === 'break'

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .3s ease both',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'background 1s ease',
        background: isBreak
          ? 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(40,200,140,0.12) 0%, transparent 70%)'
          : 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(80,100,240,0.14) 0%, transparent 70%)',
      }}/>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 24, left: 28, zIndex: 1 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-1)', lineHeight: 1 }}>{sessions}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>sessions</div>
      </div>
      <button onClick={onExit} title="Exit (Esc)" style={{
        position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%',
        border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-3)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* Mode label */}
      <div style={{
        fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 500, marginBottom: 32, zIndex: 1,
        color: isBreak ? 'var(--green)' : 'var(--accent)',
      }}>
        {isBreak ? '◎ Break' : '● Focus'}
      </div>

      {/* Ring */}
      <div style={{ position: 'relative', marginBottom: 40, zIndex: 1 }}>
        <svg width="280" height="280" viewBox="0 0 280 280" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="140" cy="140" r="120" fill="none" stroke="var(--text-4)" strokeWidth="5"/>
          <circle cx="140" cy="140" r="120" fill="none"
            stroke={isBreak ? 'var(--green)' : 'var(--accent)'}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            style={{
              transition: running ? 'stroke-dashoffset 1s linear' : 'none',
              filter: `drop-shadow(0 0 14px ${isBreak ? 'var(--green-glow)' : 'var(--accent-glow)'})`,
            }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 72, letterSpacing: '-4px', color: 'var(--timer-color)', lineHeight: 1 }}>
            {mm}<span style={{ opacity: 0.3, fontSize: 56 }}>:</span>{ss}
          </div>
        </div>
        {running && (
          <div style={{
            position: 'absolute', inset: -12, borderRadius: '50%',
            border: `1px solid ${isBreak ? 'rgba(62,207,160,0.18)' : 'rgba(99,140,245,0.18)'}`,
            animation: 'pulse 2s ease-in-out infinite',
          }}/>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36, zIndex: 1 }}>
        <button onClick={onReset} style={{
          width: 48, height: 48, borderRadius: '50%', border: '0.5px solid var(--border)',
          background: 'var(--bg-card)', color: 'var(--text-2)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconReset />
        </button>
        <button onClick={onPlayPause} style={{
          width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: isBreak
            ? 'linear-gradient(135deg,var(--green),#2aad82)'
            : 'linear-gradient(135deg,var(--accent),#7b6cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 32px ${isBreak ? 'var(--green-glow)' : 'var(--accent-glow)'}`,
        }}>
          {running ? <IconPause /> : <IconPlay />}
        </button>
        <button onClick={() => onSound(sound ? null : 'rain')} style={{
          width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
          border: `0.5px solid ${sound ? 'var(--border-active)' : 'var(--border)'}`,
          background: sound ? 'var(--accent-soft)' : 'var(--bg-card)',
          color: sound ? 'var(--accent)' : 'var(--text-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {sound ? <IconSoundOn /> : <IconSoundOff />}
        </button>
      </div>

      {/* Bottom controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 1 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { k: 'rain', Icon: SoundRainIcon },
            { k: 'forest', Icon: SoundForestIcon },
            { k: 'cafe', Icon: SoundCafeIcon },
            { k: 'white', Icon: SoundWhiteIcon },
          ]).map(({ k, Icon }) => (
            <button key={k} onClick={() => onSound(sound === k ? null : k)} style={{
              width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
              border: `0.5px solid ${sound === k ? 'var(--border-active)' : 'var(--border)'}`,
              background: sound === k ? 'var(--accent-soft)' : 'var(--bg-card)',
              color: sound === k ? 'var(--accent)' : 'var(--text-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon />
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginRight: 4 }}>End sound</span>
          {(['bell', 'chime', 'beep'] as const).map(t => (
            <button key={t} onClick={() => setAlarmType(t)} style={{
              padding: '4px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              border: `0.5px solid ${alarmType === t ? 'var(--border-active)' : 'var(--border)'}`,
              background: alarmType === t ? 'var(--accent-soft)' : 'transparent',
              color: alarmType === t ? 'var(--accent)' : 'var(--text-3)',
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Alarm overlay ─────────────────────────────────────────────
function AlarmOverlay({ mode, onDismiss }: { mode: 'work' | 'break'; onDismiss: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (['Enter', ' ', 'Escape'].includes(e.key)) onDismiss() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .25s ease both',
    }} onClick={onDismiss}>
      <div style={{
        textAlign: 'center', padding: '44px 52px',
        background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        animation: 'scaleIn .3s var(--spring) both', maxWidth: 340,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{mode === 'work' ? '🎉' : '💪'}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.5px', color: 'var(--text-1)', marginBottom: 8 }}>
          {mode === 'work' ? 'Session complete!' : 'Break over'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 300, lineHeight: 1.6, marginBottom: 28 }}>
          {mode === 'work' ? 'Great work. Take a well-earned break 🌿' : "Ready to focus again? You've got this."}
        </div>
        <button onClick={onDismiss} style={{
          padding: '11px 32px', borderRadius: 999, border: 'none', color: 'white',
          fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
          background: 'linear-gradient(135deg,var(--accent),#7b6cf6)',
          boxShadow: '0 4px 18px var(--accent-glow)',
        }}>
          {mode === 'work' ? 'Start break' : 'Start focus'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>or tap anywhere · press Enter</div>
      </div>
    </div>
  )
}

// ── Reusable section label ────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--font-body)' }}>
    {children}
  </div>
)

// ── Panel wrapper ─────────────────────────────────────────────
const Panel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: 'var(--bg-card)', border: '0.5px solid var(--border)',
    borderRadius: 16, padding: '16px 18px', ...style,
  }}>
    {children}
  </div>
)

// ── Main Pomodoro page ────────────────────────────────────────
export default function Pomodoro() {
  const [mode, setMode]                   = useState<'work' | 'break'>('work')
  const [workMins, setWorkMins]           = useState(25)
  const [brkMins, setBrkMins]             = useState(5)
  const [left, setLeft]                   = useState(25 * 60)
  const [running, setRunning]             = useState(false)
  const [sessions, setSessions]           = useState(0)
  const [log, setLog]                     = useState<SessionLog[]>([])
  const [sound, setSound]                 = useState<string | null>(null)
  const [showCustom, setShowCustom]       = useState(false)
  const [customWork, setCustomWork]       = useState(25)
  const [customBrk, setCustomBrk]         = useState(5)
  const [aiLoading, setAiLoading]         = useState(false)
  const [aiTip, setAiTip]                 = useState<string | null>(null)
  const [fullscreen, setFullscreen]       = useState(false)
  const [alarmType, setAlarmType]         = useState<'bell' | 'chime' | 'beep'>('bell')
  const [showAlarm, setShowAlarm]         = useState(false)
  const [completedMode, setCompletedMode] = useState<'work' | 'break'>('work')
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isBreak = mode === 'break'
  const total   = isBreak ? brkMins * 60 : workMins * 60
  const pct     = total > 0 ? ((total - left) / total) * 100 : 0
  const mm      = String(Math.floor(left / 60)).padStart(2, '0')
  const ss      = String(left % 60).padStart(2, '0')
  const CIRC    = 2 * Math.PI * 96

  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setLeft(l => {
          if (l <= 1) {
            clearInterval(ivRef.current!); ivRef.current = null
            setRunning(false)
            setCompletedMode(mode)
            playAlarm(alarmType, () => {})
            setShowAlarm(true)
            const mins = mode === 'work' ? workMins : brkMins
            setLog(lg => [...lg, { mode, mins, ts: Date.now() }])
            if (mode === 'work') { setSessions(n => n + 1); setMode('break'); setLeft(brkMins * 60) }
            else { setMode('work'); setLeft(workMins * 60) }
            return 0
          }
          return l - 1
        })
      }, 1000)
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, mode, workMins, brkMins, alarmType])

  useEffect(() => () => { stopAmbient(); stopAlarm() }, [])

  const switchMode = (m: 'work' | 'break') => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setMode(m); setLeft(m === 'work' ? workMins * 60 : brkMins * 60)
  }
  const reset = () => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode === 'work' ? workMins * 60 : brkMins * 60)
  }
  const applyCustom = () => {
    const w = Math.max(1, Math.min(120, customWork)), b = Math.max(1, Math.min(60, customBrk))
    setWorkMins(w); setBrkMins(b)
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode === 'work' ? w * 60 : b * 60); setShowCustom(false)
  }
  const handleSound = async (key: string | null) => {
    if (key === null || sound === key) { stopAmbient(); setSound(null); return }
    setSound(key)
    try { await playAmbient(key) } catch { stopAmbient(); setSound(null) }
  }
  const askAI = async () => {
    setAiLoading(true); setAiTip(null)
    const profile = (() => { try { return JSON.parse(localStorage.getItem('shh_profile') ?? '{}') } catch { return {} } })()
    try {
      const res = await fetch((import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 150, system: 'Reply ONLY with valid JSON.',
          messages: [{ role: 'user', content: `Study goals: ${profile.goals?.join(', ') || 'general'}, vibe: ${profile.vibe || 'balanced'}. Suggest Pomodoro minutes. JSON: {"work":25,"break":5,"tip":"one sentence"}` }]
        })
      })
      const data = await res.json()
      const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setCustomWork(parsed.work ?? 25); setCustomBrk(parsed.break ?? 5)
      setAiTip(parsed.tip ?? null); setShowCustom(true)
    } catch { setAiTip('Could not reach AI. Set manually.') }
    setAiLoading(false)
  }

  const soundOptions = [
    { key: 'rain',   label: 'Rain',   Icon: SoundRainIcon   },
    { key: 'forest', label: 'Forest', Icon: SoundForestIcon },
    { key: 'cafe',   label: 'Café',   Icon: SoundCafeIcon   },
    { key: 'white',  label: 'White',  Icon: SoundWhiteIcon  },
  ]

  const alarmOptions = [
    { t: 'bell'  as const, label: 'Bell',  desc: 'Classic'   },
    { t: 'chime' as const, label: 'Chime', desc: 'Ascending' },
    { t: 'beep'  as const, label: 'Beep',  desc: 'Digital'   },
  ]

  // Session dots (4 per cycle)
  const dotsFull = sessions % 4
  const accentColor = isBreak ? 'var(--green)' : 'var(--accent)'
  const accentGlow  = isBreak ? 'var(--green-glow)' : 'var(--accent-glow)'
  const accentSoft  = isBreak ? 'rgba(62,207,160,0.14)' : 'var(--accent-soft)'

  return (
    <>
      {fullscreen && (
        <FocusScreen
          mm={mm} ss={ss} pct={pct} mode={mode} running={running}
          sessions={sessions} sound={sound}
          onPlayPause={() => setRunning(r => !r)}
          onReset={reset}
          onExit={() => setFullscreen(false)}
          onSound={handleSound}
          alarmType={alarmType} setAlarmType={setAlarmType}
        />
      )}
      {showAlarm && (
        <AlarmOverlay mode={completedMode} onDismiss={() => { stopAlarm(); setShowAlarm(false) }} />
      )}

      <div className="page-scroll">
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 'clamp(24px,4vw,40px) clamp(16px,4vw,40px) 120px' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.8px', color: 'var(--text-1)', lineHeight: 1 }}>Focus</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{sessions} session{sessions !== 1 ? 's' : ''} today</div>
            </div>
            <button
              onClick={() => setFullscreen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                borderRadius: 999, border: '0.5px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              <IconExpand /> Full screen
            </button>
          </div>

          {/* ── Mode tabs ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {(['work', 'break'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)} style={{
                padding: '7px 20px', borderRadius: 999, fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-body)', transition: 'all .18s',
                border: `0.5px solid ${mode === m ? (m === 'break' ? 'rgba(62,207,160,0.3)' : 'var(--border-active)') : 'var(--border)'}`,
                background: mode === m ? (m === 'break' ? 'rgba(62,207,160,0.14)' : 'var(--accent-soft)') : 'transparent',
                color: mode === m ? (m === 'break' ? 'var(--green)' : 'var(--accent)') : 'var(--text-3)',
                fontWeight: mode === m ? 500 : 400,
              }}>
                {m === 'work' ? 'Focus' : 'Break'}
              </button>
            ))}
          </div>

          {/* ── Hero timer card ── */}
          <div style={{
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: 24, padding: '36px 32px 28px', marginBottom: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Card ambient glow */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', transition: 'background 1s ease',
              background: isBreak
                ? 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(62,207,160,0.06) 0%, transparent 70%)'
                : 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,140,245,0.06) 0%, transparent 70%)',
            }}/>

            {/* SVG ring */}
            <div style={{ position: 'relative', marginBottom: 24, zIndex: 1 }}>
              <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                <circle cx="110" cy="110" r="96" fill="none" stroke="var(--text-4)" strokeWidth="5"/>
                <circle cx="110" cy="110" r="96" fill="none"
                  stroke={accentColor}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - pct / 100)}
                  style={{
                    transition: running ? 'stroke-dashoffset 1s linear' : 'none',
                    filter: `drop-shadow(0 0 10px ${accentGlow})`,
                  }}
                />
              </svg>
              {/* Timer text overlay */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 54, letterSpacing: '-3px', color: 'var(--timer-color)', lineHeight: 1 }}>
                  {mm}<span style={{ opacity: 0.3, fontSize: 44 }}>:</span>{ss}
                </div>
                <div style={{ fontSize: 9, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 6 }}>
                  {isBreak ? 'break' : 'focus'}
                </div>
              </div>
              {/* Pulse ring when running */}
              {running && (
                <div style={{
                  position: 'absolute', inset: -10, borderRadius: '50%',
                  border: `1px solid ${isBreak ? 'rgba(62,207,160,0.18)' : 'rgba(99,140,245,0.18)'}`,
                  animation: 'pulse 2s ease-in-out infinite',
                }}/>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 1 }}>
              <button onClick={reset} style={{
                width: 46, height: 46, borderRadius: '50%', border: '0.5px solid var(--border)',
                background: 'var(--bg-card)', color: 'var(--text-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconReset />
              </button>
              <button onClick={() => setRunning(r => !r)} style={{
                width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: isBreak
                  ? 'linear-gradient(135deg,var(--green),#2aad82)'
                  : 'linear-gradient(135deg,var(--accent),#7b6cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 28px ${accentGlow}`,
              }}>
                {running ? <IconPause /> : <IconPlay />}
              </button>
              <button onClick={() => handleSound(sound ? null : 'rain')} style={{
                width: 46, height: 46, borderRadius: '50%', cursor: 'pointer',
                border: `0.5px solid ${sound ? 'var(--border-active)' : 'var(--border)'}`,
                background: sound ? accentSoft : 'var(--bg-card)',
                color: sound ? accentColor : 'var(--text-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {sound ? <IconSoundOn /> : <IconSoundOff />}
              </button>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: 2, background: 'var(--text-4)', borderRadius: 99, overflow: 'hidden', marginTop: 22, zIndex: 1 }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 99,
                background: isBreak
                  ? 'linear-gradient(90deg,var(--green),#34d399)'
                  : 'linear-gradient(90deg,var(--accent),#b07ef7)',
                transition: running ? 'width 1s linear' : 'none',
              }}/>
            </div>

            {/* Session dots */}
            <div style={{ display: 'flex', gap: 5, marginTop: 14, zIndex: 1 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', transition: 'all .3s var(--spring)',
                  background: i < dotsFull ? 'var(--accent)' : 'var(--text-4)',
                  boxShadow: i < dotsFull ? '0 0 6px var(--accent-glow)' : 'none',
                }}/>
              ))}
            </div>
          </div>

          {/* ── Two-column panels ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

            {/* Ambient sound */}
            <Panel>
              <SectionLabel>Ambient</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {soundOptions.map(({ key, label, Icon }) => {
                  const active = sound === key
                  return (
                    <button key={key} onClick={() => handleSound(active ? null : key)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 4, padding: '9px 6px', borderRadius: 10, cursor: 'pointer',
                      fontFamily: 'var(--font-body)', transition: 'all .18s',
                      border: `0.5px solid ${active ? 'var(--border-active)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-soft)' : 'transparent',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: active ? 'var(--accent-soft)' : 'var(--text-4)',
                        color: active ? 'var(--accent)' : 'var(--text-2)',
                      }}>
                        <Icon />
                      </div>
                      <span style={{ fontSize: 10, color: active ? 'var(--accent)' : 'var(--text-3)', fontWeight: 300 }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            </Panel>

            {/* End alarm */}
            <Panel>
              <SectionLabel>End sound</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {alarmOptions.map(({ t, label, desc }) => {
                  const active = alarmType === t
                  return (
                    <button key={t} onClick={() => setAlarmType(t)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-body)',
                      border: `0.5px solid ${active ? 'var(--border-active)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      transition: 'all .18s', textAlign: 'left',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0, transition: 'all .18s',
                        background: active ? 'var(--accent)' : 'var(--text-4)',
                        boxShadow: active ? '0 0 6px var(--accent-glow)' : 'none',
                      }}/>
                      <span style={{ fontSize: 12, color: active ? 'var(--accent)' : 'var(--text-2)', fontWeight: active ? 500 : 400 }}>{label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 300, marginLeft: 'auto' }}>{desc}</span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          </div>

          {/* ── Custom timer ── */}
          <Panel style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel>Custom timer</SectionLabel>
              <div style={{ display: 'flex', gap: 6, marginTop: -4 }}>
                <button onClick={() => setShowCustom(s => !s)} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                  fontFamily: 'var(--font-body)', background: 'var(--bg-pill)',
                  border: '0.5px solid var(--border)', color: 'var(--text-2)',
                }}>
                  {showCustom ? 'Hide' : 'Set manually'}
                </button>
                <button onClick={askAI} disabled={aiLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  borderRadius: 999, fontSize: 11, cursor: aiLoading ? 'default' : 'pointer',
                  fontFamily: 'var(--font-body)', background: 'var(--accent-soft)',
                  border: '0.5px solid var(--border-active)', color: 'var(--accent)',
                  opacity: aiLoading ? 0.6 : 1,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  {aiLoading ? 'Thinking…' : 'Ask AI'}
                </button>
              </div>
            </div>
            {aiTip && (
              <div style={{ fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.5, marginTop: 4, marginBottom: showCustom ? 10 : 0 }}>
                "{aiTip}"
              </div>
            )}
            {showCustom && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {[
                  { label: 'Focus', val: customWork, set: setCustomWork, min: 1, max: 120 },
                  { label: 'Break', val: customBrk, set: setCustomBrk, min: 1, max: 60 },
                ].map(({ label, val, set, min, max }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)' }}>
                    {label}
                    <input type="number" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))} style={{
                      width: 52, padding: '6px 8px', fontSize: 13, textAlign: 'center',
                      background: 'var(--bg-pill)', border: '0.5px solid var(--border)',
                      borderRadius: 8, color: 'var(--text-1)', fontFamily: 'var(--font-body)',
                      outline: 'none',
                    }}/>
                    min
                  </div>
                ))}
                <button onClick={applyCustom} style={{
                  padding: '7px 18px', borderRadius: 999, background: 'var(--accent-soft)',
                  border: '0.5px solid var(--border-active)', color: 'var(--accent)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}>Apply</button>
              </div>
            )}
          </Panel>

          {/* ── Session log ── */}
          {log.length > 0 && (
            <Panel>
              <SectionLabel>Today's sessions</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[...log].reverse().slice(0, 5).map((s, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 12, color: 'var(--text-2)', padding: '7px 0',
                    borderBottom: i < Math.min(log.length, 5) - 1 ? '0.5px solid var(--text-4)' : 'none',
                  }}>
                    <span style={{ color: s.mode === 'work' ? 'var(--accent)' : 'var(--green)', fontWeight: 500 }}>
                      {s.mode === 'work' ? '● Focus' : '◎ Break'}
                    </span>
                    <span>{s.mins} min</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
                      {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}