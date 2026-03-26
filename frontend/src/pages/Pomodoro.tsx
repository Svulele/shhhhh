import { useState, useEffect, useRef } from 'react'

const FOCUS = 25 * 60
const BREAK = 5 * 60

export default function Pomodoro() {
  const [seconds, setSeconds] = useState(FOCUS)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [sessions, setSessions] = useState(0)
  const interval = useRef<any>(null)

  useEffect(() => {
    if (running) {
      interval.current = setInterval(() => {
        setSeconds(s => {
          if (s <= 1) {
            clearInterval(interval.current)
            setRunning(false)
            if (mode === 'focus') {
              setSessions(n => n + 1)
              setMode('break')
              return BREAK
            } else {
              setMode('focus')
              return FOCUS
            }
          }
          return s - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval.current)
  }, [running, mode])

  const total = mode === 'focus' ? FOCUS : BREAK
  const pct = ((total - seconds) / total) * 100
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  const circ = 2 * Math.PI * 116

  const reset = () => {
    clearInterval(interval.current)
    setRunning(false)
    setSeconds(FOCUS)
    setMode('focus')
  }

  return (
    <div>
      <div className="page-title">Focus Timer</div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
        {/* Ring */}
        <div style={{ position: 'relative', width: 260, height: 260, marginBottom: 32 }}>
          <svg width="260" height="260" viewBox="0 0 260 260" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="130" cy="130" r="116" fill="none" stroke="#1a1a26" strokeWidth="8" />
            <circle cx="130" cy="130" r="116" fill="none"
              stroke={mode === 'focus' ? '#7c6af7' : '#4ecdc4'}
              strokeWidth="8" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2 }}>{m}:{s}</div>
            <div style={{ fontSize: 12, color: '#555570', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
              {mode === 'focus' ? 'FOCUS' : 'BREAK'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <button className="btn btn-outline" onClick={reset}>↺ Reset</button>
          <button className="btn btn-primary" onClick={() => setRunning(r => !r)}>
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button className="btn btn-outline" onClick={() => { clearInterval(interval.current); setRunning(false); setSeconds(BREAK); setMode('break') }}>
            ☕ Break
          </button>
        </div>

        {/* Session dots */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: i < sessions % 4 ? '#f97b6b' : i === sessions % 4 ? '#7c6af7' : '#1a1a26', border: '2px solid', borderColor: i < sessions % 4 ? '#f97b6b' : i === sessions % 4 ? '#7c6af7' : '#2a2a3a', transition: 'all 0.3s' }} />
          ))}
        </div>

        <div className="card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 13, color: '#555570', marginBottom: 8 }}>Sessions completed today</div>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#7c6af7' }}>{sessions}</div>
        </div>
      </div>
    </div>
  )
}