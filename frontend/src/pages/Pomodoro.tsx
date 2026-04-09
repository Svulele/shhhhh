import { useState, useEffect, useRef } from 'react'
import { API_BASE_URL } from '../config'

let _actx: AudioContext | null = null
let _nodes: AudioNode[] = []

function stopAmb() {
  _nodes.forEach(n => { try { (n as any).stop?.(); n.disconnect() } catch {} })
  _nodes = []
}

async function playAmb(type: string) {
  stopAmb()
  try {
    if (!_actx) _actx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (_actx.state === 'suspended') await _actx.resume()
    const ctx = _actx
    const len = ctx.sampleRate * 4
    const nb  = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = nb.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    const S = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; return s }
    const G = (v: number) => { const g = ctx.createGain(); g.gain.value = v; g.connect(ctx.destination); return g }
    const F = (t: BiquadFilterType, f: number) => { const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = f; return x }
    if (type === 'white') { const s = S(), g = G(0.09); s.connect(g); s.start(); _nodes.push(s, g) }
    if (type === 'rain')  { const s1=S(),hp=F('highpass',1200),lp=F('lowpass',10000),g1=G(0.2); s1.connect(hp);hp.connect(lp);lp.connect(g1);s1.start(); const s2=S(),lp2=F('lowpass',160),g2=G(0.05); s2.connect(lp2);lp2.connect(g2);s2.start(); _nodes.push(s1,hp,lp,g1,s2,lp2,g2) }
    if (type === 'forest'){ const s=S(),bp=F('bandpass',480),g=G(0.07),lfo=ctx.createOscillator(),lg=ctx.createGain(); lfo.frequency.value=0.22;lg.gain.value=0.04;lfo.connect(lg);lg.connect(g.gain);s.connect(bp);bp.connect(g);s.start();lfo.start(); _nodes.push(s,bp,g,lfo,lg) }
    if (type === 'cafe')  { const s1=S(),b1=F('bandpass',680),g1=G(0.06); s1.connect(b1);b1.connect(g1);s1.start(); const s2=S(),b2=F('bandpass',1250),g2=G(0.04); s2.connect(b2);b2.connect(g2);s2.start(); _nodes.push(s1,b1,g1,s2,b2,g2) }
  } catch (e) {
    console.warn('Ambient:', e)
  }
}

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
    osc.start(); osc.stop(ctx.currentTime + 1.8)
  } catch {}
}

interface SessionLog { mode: 'work'|'break'; mins: number; ts: number }

export default function Pomodoro() {
  const [mode, setMode]       = useState<'work'|'break'>('work')
  const [workMins, setWorkMins] = useState(25)
  const [brkMins, setBrkMins]   = useState(5)
  const [left, setLeft]         = useState(25 * 60)
  const [running, setRunning]   = useState(false)
  const [sessions, setSessions] = useState(0)
  const [log, setLog]           = useState<SessionLog[]>([])
  const [sound, setSound]       = useState<string|null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customWork, setCustomWork] = useState(25)
  const [customBrk, setCustomBrk]   = useState(5)
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiTip, setAiTip]           = useState<string|null>(null)

  const ivRef    = useRef<ReturnType<typeof setInterval>|null>(null)

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
            setRunning(false); playBell()
            if (mode === 'work') {
              setSessions(n => n + 1)
              setLog(prev => [...prev, { mode:'work', mins:workMins, ts:Date.now() }])
              setMode('break'); setLeft(brkMins * 60)
            } else {
              setMode('work'); setLeft(workMins * 60)
            }
            return 0
          }
          return l - 1
        })
      }, 1000)
    }
    return () => { if (ivRef.current) clearInterval(ivRef.current) }
  }, [running, mode, workMins, brkMins])

  useEffect(() => () => stopAmb(), [])

  const switchMode = (m: 'work'|'break') => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setMode(m); setLeft(m === 'work' ? workMins * 60 : brkMins * 60)
  }

  const reset = () => {
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode === 'work' ? workMins * 60 : brkMins * 60)
  }

  const handleSound = async (k: string | null) => {
    if (!k || k === sound) {
      stopAmb()
      setSound(null)
      return
    }
    setSound(k)
    await playAmb(k)
  }

  const applyCustom = () => {
    const w = Math.max(1, Math.min(120, customWork))
    const b = Math.max(1, Math.min(60, customBrk))
    setWorkMins(w); setBrkMins(b)
    clearInterval(ivRef.current!); ivRef.current = null
    setRunning(false); setLeft(mode === 'work' ? w * 60 : b * 60)
    setShowCustom(false)
  }

  const askAI = async () => {
    setAiLoading(true); setAiTip(null)
    const profile = JSON.parse(localStorage.getItem('shh_profile') ?? '{}')
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Study goals: ${profile.goals?.join(', ') || 'general study'}. Vibe: ${profile.vibe || 'balanced'}. Sessions today: ${sessions}. Suggest optimal Pomodoro focus and break times. Respond ONLY with JSON: {"work":25,"break":5,"tip":"one encouraging sentence"}`,
          personality: 'friendly',
          user_name: profile.name || 'Friend',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Request failed')
      const text = data.reply ?? ''
      const p    = JSON.parse(text.replace(/```json|```/g, '').trim())
      setCustomWork(p.work); setCustomBrk(p.break)
      setAiTip(p.tip); setShowCustom(true)
    } catch { setAiTip('Could not reach AI. Set your own times below.'); setShowCustom(true) }
    setAiLoading(false)
  }

  const accentColor = mode === 'work' ? 'var(--accent)' : 'var(--green)'
  const strokeDash  = `${(pct / 100) * circ} ${circ}`

  const soundBtns = [
    { k: 'rain',   l: '🌧', title: 'Rain'   },
    { k: 'forest', l: '🌿', title: 'Forest' },
    { k: 'cafe',   l: '☕', title: 'Café'   },
    { k: 'white',  l: '〰', title: 'White noise' },
  ]

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div style={{ padding: '36px clamp(20px,4vw,56px) 120px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, letterSpacing: '-1px', color: 'var(--text-1)', marginBottom: 4 }}>Focus</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 40 }}>Deep work, one session at a time</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'start' }}>

        {/* ── Left — timer ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['work','break'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                style={{ padding: '7px 20px', borderRadius: 999, fontSize: 13, fontWeight: 400, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .2s',
                  background: mode === m ? 'var(--bg-pill)' : 'transparent',
                  border: `0.5px solid ${mode === m ? 'var(--border-top)' : 'var(--border)'}`,
                  color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
                }}>
                {m === 'work' ? 'Focus' : 'Break'}
              </button>
            ))}
          </div>

          {/* Ring timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 24, padding: '40px 40px 32px' }}>
            <div style={{ position: 'relative', width: 200, height: 200 }}>
              <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="var(--text-4)" strokeWidth="8"/>
                <circle cx="100" cy="100" r="90" fill="none" stroke={accentColor}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={strokeDash}
                  style={{ transition: running ? 'stroke-dasharray 1s linear' : 'none', filter: `drop-shadow(0 0 8px ${accentColor}60)` }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 46, letterSpacing: '-2px', color: 'var(--timer-color)', lineHeight: 1 }}>
                  {mm}<span style={{ opacity: 0.35, fontSize: '0.8em' }}>:</span>{ss}
                </div>
                <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginTop: 6 }}>
                  {mode === 'work' ? 'focus' : 'break'}
                </div>
              </div>
            </div>

            {/* Controls — compact row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={reset}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ctrl-color)', transition: 'opacity .2s' }}
                title="Reset">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              </button>
              <button onClick={() => setRunning(r => !r)}
                style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${mode==='work'?'var(--accent), #7b6cf6':'var(--green), #4ab8d0'})`, boxShadow: `0 6px 24px ${accentColor}50`, transition: 'all .22s cubic-bezier(.34,1.56,.64,1)' }}>
                {running
                  ? <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </button>
              {/* Sessions count badge */}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-pill)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-1)', lineHeight: 1 }}>{sessions}</span>
                <span style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 1 }}>done</span>
              </div>
            </div>

            {/* Ambient */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 16, borderTop: '0.5px solid var(--border)', width: '100%', justifyContent: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-3)', marginRight: 6 }}>Ambient</span>
              {soundBtns.map(({ k, l, title }) => (
                <button key={k} title={title} onClick={() => handleSound(k)}
                  style={{ width: 36, height: 36, borderRadius: 10, border: 'none', fontSize: 15, cursor: 'pointer', transition: 'all .18s', background: sound === k ? 'var(--accent-soft)' : 'var(--bg-pill)', transform: sound === k ? 'scale(1.08)' : 'scale(1)' }}>
                  {l}
                </button>
              ))}
              {sound && (
                <button onClick={() => handleSound(null)} title="Stop"
                  style={{ width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-3)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Custom timer + AI suggestion */}
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showCustom || aiTip ? 14 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>Timer settings</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowCustom(s => !s)}
                  style={{ padding: '5px 14px', borderRadius: 999, border: '0.5px solid var(--border)', background: showCustom ? 'var(--bg-pill)' : 'transparent', color: showCustom ? 'var(--text-1)' : 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Custom
                </button>
                <button onClick={askAI} disabled={aiLoading}
                  style={{ padding: '5px 14px', borderRadius: 999, border: '0.5px solid var(--border-active)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, cursor: aiLoading ? 'default' : 'pointer', fontFamily: 'var(--font-body)', opacity: aiLoading ? 0.6 : 1 }}>
                  {aiLoading ? '…' : '✦ Ask AI'}
                </button>
              </div>
            </div>
            {aiTip && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 12, fontStyle: 'italic', lineHeight: 1.5 }}>{aiTip}</div>}
            {showCustom && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  Focus
                  <input type="number" min={1} max={120} value={customWork} onChange={e => setCustomWork(Number(e.target.value))}
                    style={{ width: 56, padding: '6px 8px', fontSize: 13, textAlign: 'center' }}/>
                  min
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                  Break
                  <input type="number" min={1} max={60} value={customBrk} onChange={e => setCustomBrk(Number(e.target.value))}
                    style={{ width: 48, padding: '6px 8px', fontSize: 13, textAlign: 'center' }}/>
                  min
                </div>
                <button onClick={applyCustom}
                  style={{ padding: '7px 18px', borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', border: 'none', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Apply
                </button>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Current: {workMins}m focus / {brkMins}m break</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right — session log ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>Today's sessions</div>
            {log.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>No sessions yet. Start your first focus block.</p>
              : log.slice().reverse().map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.mode === 'work' ? 'var(--accent)' : 'var(--green)', flexShrink: 0 }}/>
                  <span style={{ fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{s.mode === 'work' ? 'Focus' : 'Break'} — {s.mins}m</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{formatTime(s.ts)}</span>
                </div>
              ))
            }
          </div>

          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 18, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 }}>Stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Sessions', value: String(sessions), color: 'var(--accent)' },
                { label: 'Focus time', value: `${sessions * workMins}m`, color: 'var(--green)' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.5px', color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips based on vibe */}
          <div style={{ background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)', borderRadius: 18, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>Buddy tip</div>
            <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, fontWeight: 300 }}>
              {sessions === 0
                ? "Start your first session — even 5 minutes builds momentum."
                : sessions < 3
                ? `${sessions} session${sessions>1?'s':''} done. You're building something real. Keep it up.`
                : `${sessions} sessions today — that's a great day. Consider a longer break.`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
