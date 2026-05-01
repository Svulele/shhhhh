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

// ── Alarm — 3 rings, satisfying and dismissable ───────────────
let _alarmCtx: AudioContext | null = null

function playAlarm(type: 'bell' | 'chime' | 'beep' = 'bell', onDone?: () => void) {
  try {
    _alarmCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = _alarmCtx
    const ring = (delay: number, freq: number, freq2: number, dur: number, vol: number) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
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
        // bell — default
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay)
        osc.frequency.exponentialRampToValueAtTime(freq2, ctx.currentTime + delay + dur)
        gain.gain.setValueAtTime(vol, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur)
      }
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + dur + 0.05)
    }

    // 3 rings with slight gap between — bell: 880→440, chime: ascending, beep: three short
    if (type === 'beep') {
      ring(0,   880, 880, 0.12, 0.6)
      ring(0.2, 880, 880, 0.12, 0.6)
      ring(0.4, 1050, 1050, 0.18, 0.6)
    } else if (type === 'chime') {
      ring(0,   523, 523, 1.2, 0.45)
      ring(0.8, 659, 659, 1.2, 0.38)
      ring(1.6, 784, 784, 1.4, 0.32)
    } else {
      ring(0,   880, 440, 1.8, 0.5)
      ring(2.2, 880, 440, 1.8, 0.4)
      ring(4.4, 880, 330, 2.0, 0.35)
    }

    if (onDone) setTimeout(onDone, type === 'beep' ? 900 : type === 'chime' ? 3500 : 7000)
  } catch {}
}

function stopAlarm() {
  try { _alarmCtx?.close(); _alarmCtx = null } catch {}
}

// ── Types ─────────────────────────────────────────────────────
interface SessionLog { mode: 'work' | 'break'; mins: number; ts: number }

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
  alarmType: 'bell' | 'chime' | 'beep'; setAlarmType: (t: 'bell'|'chime'|'beep') => void
}) {
  const circ = 2 * Math.PI * 120

  // Background pulses gently when running
  const bgColor = mode === 'work'
    ? 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(80,100,240,0.18) 0%, transparent 70%)'
    : 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(40,200,140,0.15) 0%, transparent 70%)'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'var(--bg)', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .3s ease both',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', inset: 0, background: bgColor, pointerEvents: 'none', transition: 'background 1s ease' }}/>

      {/* Exit button */}
      <button onClick={onExit} title="Exit (Esc)"
        style={{ position: 'absolute', top: 24, right: 24, width: 40, height: 40, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', zIndex: 1 }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      {/* Sessions counter top-left */}
      <div style={{ position: 'absolute', top: 24, left: 28, zIndex: 1 }}>
        <div style={{ fontSize: 28, fontFamily: 'var(--font-display)', color: 'var(--text-1)', lineHeight: 1 }}>{sessions}</div>
        <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>sessions</div>
      </div>

      {/* Mode label */}
      <div style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: mode === 'work' ? 'var(--accent)' : 'var(--green)', marginBottom: 32, zIndex: 1, fontWeight: 500 }}>
        {mode === 'work' ? '● Focus' : '◎ Break'}
      </div>

      {/* Big SVG ring timer */}
      <div style={{ position: 'relative', marginBottom: 40, zIndex: 1 }}>
        <svg width="280" height="280" viewBox="0 0 280 280" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="140" cy="140" r="120" fill="none" stroke="var(--text-4)" strokeWidth="6"/>
          <circle cx="140" cy="140" r="120" fill="none"
            stroke={mode === 'work' ? 'var(--accent)' : 'var(--green)'}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct / 100)}
            style={{
              transition: running ? 'stroke-dashoffset 1s linear' : 'none',
              filter: `drop-shadow(0 0 12px ${mode === 'work' ? 'var(--accent-glow)' : 'var(--green-glow)'})`,
            }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 72, letterSpacing: '-4px', color: 'var(--timer-color)', lineHeight: 1 }}>
            {mm}<span style={{ opacity: 0.3, fontSize: 56 }}>:</span>{ss}
          </div>
        </div>
        {/* Pulse ring when running */}
        {running && (
          <div style={{ position: 'absolute', inset: -12, borderRadius: '50%', border: `1px solid ${mode === 'work' ? 'rgba(99,140,245,0.2)' : 'rgba(62,207,160,0.2)'}`, animation: 'pulse 2s ease-in-out infinite' }}/>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 40, zIndex: 1 }}>
        <button onClick={onReset}
          style={{ width: 48, height: 48, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
        </button>
        <button onClick={onPlayPause}
          style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px var(--accent-glow)', transition: 'all .2s' }}>
          {running
            ? <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            : <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          }
        </button>
        {/* Sound quick toggle */}
        <button onClick={() => onSound(sound ? null : 'rain')}
          style={{ width: 48, height: 48, borderRadius: '50%', border: `0.5px solid ${sound ? 'var(--border-active)' : 'var(--border)'}`, background: sound ? 'var(--accent-soft)' : 'var(--bg-card)', color: sound ? 'var(--accent)' : 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            {sound
              ? <><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
              : <line x1="23" y1="9" x2="17" y2="15"/>}
          </svg>
        </button>
      </div>

      {/* Bottom row — ambient + alarm type */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 1 }}>
        {/* Ambient sound pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[{k:'rain',l:'🌧'},{k:'forest',l:'🌿'},{k:'cafe',l:'☕'},{k:'white',l:'〰'}].map(({k,l}) => (
            <button key={k} onClick={() => onSound(sound === k ? null : k)}
              style={{ width: 36, height: 36, borderRadius: 10, border: `0.5px solid ${sound === k ? 'var(--border-active)' : 'var(--border)'}`, background: sound === k ? 'var(--accent-soft)' : 'var(--bg-card)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s' }}>
              {l}
            </button>
          ))}
        </div>
        {/* Alarm type selector */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginRight: 4 }}>End sound</span>
          {(['bell', 'chime', 'beep'] as const).map(t => (
            <button key={t} onClick={() => setAlarmType(t)}
              style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', border: `0.5px solid ${alarmType === t ? 'var(--border-active)' : 'var(--border)'}`, background: alarmType === t ? 'var(--accent-soft)' : 'transparent', color: alarmType === t ? 'var(--accent)' : 'var(--text-3)', transition: 'all .18s' }}>
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Alarm notification overlay ────────────────────────────────
function AlarmOverlay({ mode, onDismiss }: { mode: 'work' | 'break'; onDismiss: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn .25s ease both',
    }} onClick={onDismiss}>
      <div style={{
        textAlign: 'center', padding: '48px 56px',
        background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: 28, boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        animation: 'scaleIn .3s var(--spring) both',
        maxWidth: 360,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>
          {mode === 'work' ? '🎉' : '💪'}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.5px', color: 'var(--text-1)', marginBottom: 8 }}>
          {mode === 'work' ? 'Session complete!' : 'Break over'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 300, lineHeight: 1.6, marginBottom: 28 }}>
          {mode === 'work'
            ? 'Great work. Take a well-earned break 🌿'
            : 'Ready to focus again? You\'ve got this.'}
        </div>
        <button onClick={onDismiss}
          style={{ padding: '11px 32px', borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', border: 'none', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 4px 18px var(--accent-glow)', transition: 'all .2s' }}>
          {mode === 'work' ? 'Start break' : 'Start focus'}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 12 }}>or tap anywhere / press Enter</div>
      </div>
    </div>
  )
}

// ── Pill style helper ─────────────────────────────────────────
const pill = (active: boolean): React.CSSProperties => ({
  padding: '5px 14px', borderRadius: 999, fontSize: 12,
  border: '0.5px solid var(--border)', fontFamily: 'var(--font-body)',
  background: active ? 'var(--bg-pill)' : 'transparent',
  color: active ? 'var(--text-1)' : 'var(--text-3)',
  cursor: 'pointer', transition: 'all .18s',
})

// ── Main Pomodoro page ────────────────────────────────────────
export default function Pomodoro() {
  const [mode, setMode]             = useState<'work'|'break'>('work')
  const [workMins, setWorkMins]     = useState(25)
  const [brkMins,  setBrkMins]      = useState(5)
  const [left, setLeft]             = useState(25 * 60)
  const [running, setRunning]       = useState(false)
  const [sessions, setSessions]     = useState(0)
  const [log, setLog]               = useState<SessionLog[]>([])
  const [sound, setSound]           = useState<string|null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(25)
  const [customBrk,  setCustomBrk]  = useState(5)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiTip, setAiTip]           = useState<string|null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [alarmType, setAlarmType]   = useState<'bell'|'chime'|'beep'>('bell')
  const [showAlarm, setShowAlarm]   = useState(false)
  const [completedMode, setCompletedMode] = useState<'work'|'break'>('work')
  const ivRef = useRef<ReturnType<typeof setInterval>|null>(null)

  const total = mode === 'work' ? workMins * 60 : brkMins * 60
  const pct   = total > 0 ? ((total - left) / total) * 100 : 0
  const mm    = String(Math.floor(left / 60)).padStart(2, '0')
  const ss    = String(left % 60).padStart(2, '0')
  const circ  = 2 * Math.PI * 90

  useEffect(() => {
    if (running) {
      ivRef.current = setInterval(() => {
        setLeft(l => {
          if (l <= 1) {
            clearInterval(ivRef.current!); ivRef.current = null
            setRunning(false)
            // Fire alarm
            setCompletedMode(mode)
            playAlarm(alarmType, () => {})
            setShowAlarm(true)
            // Log session
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

  const switchMode = (m: 'work'|'break') => {
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
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 150, system: 'Reply ONLY with valid JSON.',
          messages: [{ role: 'user', content: `Study goals: ${profile.goals?.join(', ') || 'general'}, vibe: ${profile.vibe || 'balanced'}. Suggest Pomodoro minutes. JSON: {"work":25,"break":5,"tip":"one sentence"}` }] })
      })
      const data = await res.json()
      const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      setCustomWork(parsed.work ?? 25); setCustomBrk(parsed.break ?? 5)
      setAiTip(parsed.tip ?? null); setShowCustom(true)
    } catch { setAiTip('Could not reach AI. Set manually.') }
    setAiLoading(false)
  }

  const soundBtns = [
    { key: 'rain', icon: '🌧', label: 'Rain' }, { key: 'forest', icon: '🌿', label: 'Forest' },
    { key: 'cafe', icon: '☕', label: 'Café'  }, { key: 'white',  icon: '〰', label: 'White'  },
  ]

  return (
    <>
      {/* Fullscreen focus mode */}
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

      {/* Alarm overlay */}
      {showAlarm && (
        <AlarmOverlay
          mode={completedMode}
          onDismiss={() => { stopAlarm(); setShowAlarm(false) }}
        />
      )}

      <div className="page-scroll">
        <div style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(24px,4vw,48px) clamp(16px,4vw,48px) 120px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, letterSpacing: '-0.8px', color: 'var(--text-1)', marginBottom: 4 }}>Focus</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sessions} session{sessions !== 1 ? 's' : ''} today</div>
            </div>
            {/* Fullscreen entry button */}
            <button onClick={() => setFullscreen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 999, border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              Full screen
            </button>
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
            <button style={pill(mode === 'work')}  onClick={() => switchMode('work')}>Focus</button>
            <button style={pill(mode === 'break')} onClick={() => switchMode('break')}>Break</button>
          </div>

          {/* Ring timer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 36, marginBottom: 28, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="var(--text-4)" strokeWidth="7"/>
                <circle cx="100" cy="100" r="90" fill="none"
                  stroke={mode === 'work' ? 'var(--accent)' : 'var(--green)'}
                  strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
                  style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none', filter: `drop-shadow(0 0 8px ${mode === 'work' ? 'var(--accent-glow)' : 'var(--green-glow)'})` }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, letterSpacing: '-2px', color: 'var(--timer-color)', lineHeight: 1 }}>
                  {mm}<span style={{ opacity: 0.3, fontSize: 36 }}>:</span>{ss}
                </div>
                <div style={{ fontSize: 9, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 6 }}>
                  {mode === 'work' ? 'focus' : 'break'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={reset} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ctrl-color)', display: 'flex', alignItems: 'center', padding: 4 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                </button>
                <button onClick={() => setRunning(r => !r)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ctrl-fill)', display: 'flex', alignItems: 'center', padding: 4 }}>
                  {running
                    ? <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--ctrl-fill)"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    : <svg width="34" height="34" viewBox="0 0 24 24" fill="var(--ctrl-fill)"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                </button>
              </div>
              <div style={{ height: 3, background: 'var(--text-4)', borderRadius: 99, overflow: 'hidden', maxWidth: 180 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${mode==='work'?'var(--accent)':'var(--green)'},${mode==='work'?'#b07ef7':'#34d399'})`, borderRadius: 99, transition: running ? 'width 1s linear' : 'none' }}/>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{workMins}m focus · {brkMins}m break</div>
            </div>
          </div>

          {/* End alarm type */}
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>End sound</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {([
                { t: 'bell',  label: '🔔 Bell',  desc: 'Classic' },
                { t: 'chime', label: '🎵 Chime', desc: 'Ascending' },
                { t: 'beep',  label: '📳 Beep',  desc: 'Digital' },
              ] as const).map(({ t, label, desc }) => (
                <button key={t} onClick={() => setAlarmType(t)}
                  style={{ flex: 1, padding: '9px 8px', borderRadius: 12, border: `0.5px solid ${alarmType === t ? 'var(--border-active)' : 'var(--border)'}`, background: alarmType === t ? 'var(--accent-soft)' : 'transparent', color: alarmType === t ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: alarmType === t ? 500 : 300, transition: 'all .18s', textAlign: 'center' }}>
                  <div>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Ambient */}
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Ambient sound</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {soundBtns.map(({ key, icon, label }) => (
                <button key={key} onClick={() => handleSound(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .18s',
                    background: sound === key ? 'var(--accent-soft)' : 'var(--bg-pill)',
                    border: `0.5px solid ${sound === key ? 'var(--border-active)' : 'var(--border)'}`,
                    color: sound === key ? 'var(--accent)' : 'var(--text-2)' }}>
                  <span style={{ fontSize: 15 }}>{icon}</span> {label}
                  {sound === key && <span style={{ fontSize: 10, opacity: 0.6 }}>ON</span>}
                </button>
              ))}
              {sound && <button onClick={() => handleSound(null)} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', background: 'transparent', border: '0.5px solid var(--border)', color: 'var(--text-3)', transition: 'all .18s' }}>Stop</button>}
            </div>
          </div>

          {/* Custom time */}
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '16px 18px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCustom ? 14 : 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Custom timer</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={() => setShowCustom(s => !s)} style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', background: 'var(--bg-pill)', border: '0.5px solid var(--border)', color: 'var(--text-2)', transition: 'all .18s' }}>
                  {showCustom ? 'Hide' : 'Set manually'}
                </button>
                <button onClick={askAI} disabled={aiLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: aiLoading ? 'default' : 'pointer', fontFamily: 'var(--font-body)', background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)', color: 'var(--accent)', opacity: aiLoading ? 0.6 : 1, transition: 'all .18s' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
                  {aiLoading ? 'Thinking…' : 'Ask AI'}
                </button>
              </div>
            </div>
            {aiTip && <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.5, fontStyle: 'italic' }}>"{aiTip}"</div>}
            {showCustom && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  Focus <input type="number" min={1} max={120} value={customWork} onChange={e => setCustomWork(Number(e.target.value))} style={{ width: 54, padding: '6px 8px', fontSize: 13, textAlign: 'center' }}/> min
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  Break <input type="number" min={1} max={60} value={customBrk} onChange={e => setCustomBrk(Number(e.target.value))} style={{ width: 50, padding: '6px 8px', fontSize: 13, textAlign: 'center' }}/> min
                </div>
                <button onClick={applyCustom} style={{ padding: '7px 18px', borderRadius: 999, background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)', color: 'var(--accent)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Apply</button>
              </div>
            )}
          </div>

          {/* Session log */}
          {log.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Today's sessions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[...log].reverse().slice(0, 6).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-2)' }}>
                    <span style={{ color: s.mode === 'work' ? 'var(--accent)' : 'var(--green)', fontWeight: 500 }}>{s.mode === 'work' ? '● Focus' : '◎ Break'}</span>
                    <span>{s.mins} min</span>
                    <span style={{ color: 'var(--text-3)', fontSize: 11 }}>{new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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