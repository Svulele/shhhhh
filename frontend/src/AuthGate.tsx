import { useState, useEffect, useRef } from 'react'
import { supabase, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, syncProfile, recordStudyDay, getStreak } from './supabase'
import type { User } from '@supabase/supabase-js'

export { recordStudyDay, getStreak }

interface Props { children: (user: User, doSignOut: () => void) => React.ReactNode }

// ── Loading screen — cinematic, matches the app's dark aesthetic ─
function LoadingScreen({ message }: { message: string }) {
  const [phase, setPhase] = useState(0)
  // Phase 0: logo entrance, Phase 1: text in, Phase 2: particles
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400)
    const t2 = setTimeout(() => setPhase(2), 800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  // 6 floating accent particles
  const particles = [
    { x: '20%', y: '25%', size: 5, dur: 3.2, delay: 0    },
    { x: '75%', y: '18%', size: 3, dur: 4.1, delay: 0.6  },
    { x: '85%', y: '60%', size: 4, dur: 3.6, delay: 1.2  },
    { x: '12%', y: '68%', size: 6, dur: 4.8, delay: 0.3  },
    { x: '60%', y: '78%', size: 3, dur: 3.9, delay: 0.9  },
    { x: '45%', y: '12%', size: 4, dur: 4.4, delay: 1.5  },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, overflow: 'hidden',
    }}>
      {/* Deep background gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(80,100,220,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* Ambient orbs — same as body but more intense for loading feel */}
      <div style={{ position:'absolute', width:800, height:800, borderRadius:'50%', background:'radial-gradient(circle,rgba(80,120,220,0.15) 0%,transparent 70%)', top:-250, right:-200, filter:'blur(80px)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(130,90,210,0.12) 0%,transparent 70%)', bottom:-150, left:-150, filter:'blur(80px)', pointerEvents:'none' }}/>

      {/* Floating particles */}
      {phase >= 2 && particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y,
          width: p.size, height: p.size, borderRadius: '50%',
          background: i % 2 === 0 ? 'var(--accent)' : '#b07ef7',
          opacity: 0.5,
          animation: `particleFloat ${p.dur}s ease-in-out infinite`,
          animationDelay: `${p.delay}s`,
          filter: 'blur(0.5px)',
          boxShadow: `0 0 ${p.size * 2}px var(--accent-glow)`,
        }}/>
      ))}

      {/* ── Logo ── */}
      <div style={{
        position: 'relative', marginBottom: 44, zIndex: 1,
        animation: 'logoEntrance 0.7s var(--ease-out) both',
      }}>
        {/* Expanding ring 1 */}
        <div style={{
          position: 'absolute', inset: -20, borderRadius: '50%',
          border: '1px solid var(--border-active)',
          animation: 'ringExpand 2.4s ease-out infinite',
          animationDelay: '0.2s',
        }}/>
        {/* Expanding ring 2 */}
        <div style={{
          position: 'absolute', inset: -20, borderRadius: '50%',
          border: '0.5px solid rgba(99,140,245,0.25)',
          animation: 'ringExpand 2.4s ease-out infinite',
          animationDelay: '1.4s',
        }}/>
        {/* Static glow ring */}
        <div style={{
          position: 'absolute', inset: -12, borderRadius: '50%',
          border: '1px solid rgba(99,140,245,0.2)',
          boxShadow: '0 0 24px rgba(99,140,245,0.15), inset 0 0 24px rgba(99,140,245,0.05)',
        }}/>

        {/* Logo tile */}
        <div style={{
          width: 72, height: 72, borderRadius: 22,
          background: 'linear-gradient(135deg, var(--accent) 0%, #7b6cf6 50%, #b07ef7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.12) inset, 0 16px 48px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.3)',
          animation: 'logoBreath 3s ease-in-out infinite',
          animationDelay: '0.8s',
          position: 'relative', zIndex: 1,
        }}>
          {/* Open book with spark — represents focused study */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            {/* Book left page */}
            <path d="M18 28V11C15 9.5 10 9 6 10.5V27.5C10 26 15 26.5 18 28Z"
              fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
            {/* Book right page */}
            <path d="M18 28V11C21 9.5 26 9 30 10.5V27.5C26 26 21 26.5 18 28Z"
              fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
            {/* Spine */}
            <line x1="18" y1="11" x2="18" y2="28" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
            {/* Spark / star above */}
            <circle cx="26" cy="6" r="1.5" fill="white" opacity="0.9"/>
            <line x1="26" y1="3" x2="26" y2="4.2" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            <line x1="26" y1="7.8" x2="26" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            <line x1="23" y1="6" x2="24.2" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            <line x1="27.8" y1="6" x2="29" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            <line x1="24.1" y1="4.1" x2="24.9" y2="4.9" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
            <line x1="27.1" y1="7.1" x2="27.9" y2="7.9" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
          </svg>
        </div>
      </div>

      {/* ── App name ── */}
      {phase >= 1 && (
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 28,
          letterSpacing: '-0.5px', color: 'var(--text-1)',
          marginBottom: 10, zIndex: 1,
          animation: 'textReveal 0.55s var(--ease-out) both',
        }}>
          Shhhhh
        </div>
      )}

      {/* ── Status message ── */}
      {phase >= 1 && (
        <div style={{
          fontSize: 13, color: 'var(--text-3)', fontWeight: 300,
          letterSpacing: '0.2px', zIndex: 1,
          animation: 'textReveal 0.55s var(--ease-out) 0.1s both',
          minHeight: 20,
        }}>
          {message}
        </div>
      )}

      {/* ── Dots loader ── */}
      {phase >= 1 && (
        <div style={{ display: 'flex', gap: 7, marginTop: 32, zIndex: 1 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent)',
              animation: 'pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
              boxShadow: '0 0 8px var(--accent-glow)',
            }}/>
          ))}
        </div>
      )}

      {/* ── Bottom progress sweep ── */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--text-4)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '45%',
          background: 'linear-gradient(90deg, transparent, var(--accent), #b07ef7, transparent)',
          animation: 'loadSweep 1.6s ease-in-out infinite',
          boxShadow: '0 0 12px var(--accent-glow)',
        }}/>
      </div>
    </div>
  )
}

// ── Feature list for landing ──────────────────────────────────
const FEATURES = [
  { e:'📚', t:'Read any PDF',       d:'Upload a textbook. Switch to clean reader mode. Your place is always saved.' },
  { e:'🤖', t:'AI that knows you',  d:'Your buddy remembers what you struggle with and adapts to your style over time.' },
  { e:'🃏', t:'Auto flashcards',    d:'Finish a reading session and cards are generated from what you just read.' },
  { e:'⏱',  t:'Focus timer',        d:'Pomodoro with ambient sounds. Rain, forest, café, or white noise.' },
  { e:'🔥', t:'Daily streaks',      d:'Study every day. Your streak syncs across all your devices.' },
  { e:'📅', t:'Your daily plan',    d:'AI builds a personalised study plan each morning based on where you are.' },
]

// ── Landing page ──────────────────────────────────────────────
function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,var(--orb-1) 0%,transparent 70%)', top:-200, right:-150, filter:'blur(100px)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,var(--orb-2) 0%,transparent 70%)', bottom:-100, left:-100, filter:'blur(100px)', pointerEvents:'none' }}/>

      <div style={{ maxWidth:800, margin:'0 auto', padding:'0 clamp(20px,5vw,48px) 80px', position:'relative', zIndex:1 }}>
        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 0 0' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontStyle:'italic', color:'var(--text-1)' }}>Shhhhh</div>
          <button onClick={onStart} style={{ padding:'8px 20px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
            Sign in
          </button>
        </div>

        {/* Hero */}
        <div style={{ textAlign:'center', padding:'72px 0 56px' }}>
          <div style={{ display:'inline-flex', width:72, height:72, borderRadius:20, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', alignItems:'center', justifyContent:'center', boxShadow:'0 12px 48px var(--accent-glow)', marginBottom:32 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M18 28V11C15 9.5 10 9 6 10.5V27.5C10 26 15 26.5 18 28Z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
              <path d="M18 28V11C21 9.5 26 9 30 10.5V27.5C26 26 21 26.5 18 28Z" fill="rgba(255,255,255,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
              <line x1="18" y1="11" x2="18" y2="28" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
              <circle cx="26" cy="6" r="1.5" fill="white" opacity="0.9"/>
              <line x1="26" y1="3" x2="26" y2="4.2" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
              <line x1="26" y1="7.8" x2="26" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
              <line x1="23" y1="6" x2="24.2" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
              <line x1="27.8" y1="6" x2="29" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            </svg>
          </div>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(34px,6vw,62px)', letterSpacing:'-2px', color:'var(--text-1)', lineHeight:1.08, marginBottom:20 }}>
            Your AI study buddy.<br/>
            <em style={{ fontStyle:'italic', color:'var(--accent)' }}>Personalised for you.</em>
          </h1>
          <p style={{ fontSize:'clamp(14px,1.8vw,17px)', color:'var(--text-3)', fontWeight:300, lineHeight:1.75, maxWidth:480, margin:'0 auto 40px' }}>
            Not just a chatbot. Shhhhh reads with you, quizzes you, builds your flashcards, and keeps you on track — every single day.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={onStart} style={{ padding:'14px 32px', borderRadius:999, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 6px 24px var(--accent-glow)', transition:'all .2s' }}>
              Get started free →
            </button>
            <button onClick={onStart} style={{ padding:'14px 24px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontSize:15, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s' }}>
              Sign in
            </button>
          </div>
          <p style={{ fontSize:11, color:'var(--text-3)', marginTop:14, fontWeight:300 }}>Free during beta · No credit card needed</p>
        </div>

        {/* Feature grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:12, marginBottom:56 }}>
          {FEATURES.map(f => (
            <div key={f.t} style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:18, padding:'20px 20px 18px' }}>
              <div style={{ fontSize:24, marginBottom:10 }}>{f.e}</div>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', marginBottom:5 }}>{f.t}</div>
              <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:300, lineHeight:1.6 }}>{f.d}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign:'center', background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:24, padding:'40px 32px' }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:'clamp(20px,3vw,28px)', letterSpacing:'-0.5px', color:'var(--text-1)', marginBottom:10 }}>
            Ready to study smarter?
          </div>
          <p style={{ fontSize:13, color:'var(--text-3)', fontWeight:300, marginBottom:24 }}>
            Join the beta. Free. Your feedback shapes what gets built next.
          </p>
          <button onClick={onStart} style={{ padding:'12px 36px', borderRadius:999, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 18px var(--accent-glow)', transition:'all .2s' }}>
            Start now — it's free
          </button>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'var(--text-3)', marginTop:28, fontWeight:300 }}>
          Built with ❤️ · Powered by Claude · Your data stays on your device
        </p>
      </div>
    </div>
  )
}

// ── Auth form ─────────────────────────────────────────────────
function AuthForm({ onBack }: { onBack: () => void }) {
  const [mode,  setMode]  = useState<'login'|'signup'|'confirm'>('signup')
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')
  const [err,   setErr]   = useState<string|null>(null)
  const [busy,  setBusy]  = useState(false)

  const go = async () => {
    if (!email.trim() || !pass.trim()) { setErr('Please enter your email and password.'); return }
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setBusy(true); setErr(null)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, pass)
        // onAuthStateChange will handle navigating to app
      } else {
        const data = await signUpWithEmail(email, pass)
        // If Supabase requires email confirmation, session will be null
        if (data?.user && !data?.session) {
          // Email confirmation required — show message, don't stay stuck
          setErr(null)
          setBusy(false)
          setMode('confirm' as any)
          return
        }
        // If no confirmation required, onAuthStateChange handles the rest
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Something went wrong.'
      // Make Supabase errors human-readable
      if (msg.includes('Invalid login credentials')) setErr('Wrong email or password.')
      else if (msg.includes('Email not confirmed')) setErr('Please check your email and click the confirmation link first.')
      else if (msg.includes('already registered')) setErr('An account with this email already exists. Try signing in instead.')
      else setErr(msg)
      setBusy(false)
    }
    // Safety net — if still busy after 8s, release the button
    setTimeout(() => setBusy(false), 8000)
  }

  const google = async () => {
    setBusy(true); setErr(null)
    try { await signInWithGoogle() }
    catch (e: any) { setErr(e.message); setBusy(false) }
  }

  // Email confirmation screen — shown after sign-up when Supabase requires email verification
  if (mode === 'confirm') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:400, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:28, padding:'40px 32px', textAlign:'center', animation:'pageUp .4s var(--ease-out) both' }}>
        <div style={{ fontSize:48, marginBottom:20 }}>📬</div>
        <div style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--text-1)', marginBottom:10 }}>Check your email</div>
        <p style={{ fontSize:13, color:'var(--text-3)', fontWeight:300, lineHeight:1.75, marginBottom:28 }}>
          We sent a confirmation link to <strong style={{ color:'var(--text-2)', fontWeight:500 }}>{email}</strong>.<br/>Click it to activate your account, then come back and sign in.
        </p>
        <button onClick={()=>setMode('login')} style={{ padding:'11px 28px', borderRadius:999, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 18px var(--accent-glow)' }}>
          Go to sign in →
        </button>
        <div style={{ marginTop:14 }}>
          <button onClick={onBack} style={{ fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)' }}>Back to home</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:24, background:'var(--bg)', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,var(--orb-1) 0%,transparent 70%)', top:-150, right:-100, filter:'blur(90px)', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,var(--orb-2) 0%,transparent 70%)', bottom:0, left:-80, filter:'blur(90px)', pointerEvents:'none' }}/>
      <div style={{ width:'100%', maxWidth:400, background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:28, padding:'36px 32px 32px', position:'relative', zIndex:1, animation:'pageUp .4s var(--ease-out) both' }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', marginBottom:20, padding:0, transition:'color .2s' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'inline-flex', width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 24px var(--accent-glow)', marginBottom:12 }}>
            <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
              <path d="M18 28V11C15 9.5 10 9 6 10.5V27.5C10 26 15 26.5 18 28Z" fill="rgba(255,255,255,0.9)"/>
              <path d="M18 28V11C21 9.5 26 9 30 10.5V27.5C26 26 21 26.5 18 28Z" fill="rgba(255,255,255,0.7)"/>
              <line x1="18" y1="11" x2="18" y2="28" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
              <circle cx="26" cy="6" r="1.5" fill="white" opacity="0.9"/>
              <line x1="26" y1="3" x2="26" y2="4.2" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="26" y1="7.8" x2="26" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="23" y1="6" x2="24.2" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="27.8" y1="6" x2="29" y2="6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontStyle:'italic', color:'var(--text-1)', marginBottom:5 }}>Shhhhh</div>
          <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:300 }}>
            {mode === 'login' ? 'Welcome back. Ready to learn?' : 'Create your free account.'}
          </div>
        </div>
        <button onClick={google} disabled={busy} style={{ width:'100%', padding:12, borderRadius:12, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-1)', fontSize:14, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14, opacity:busy?0.6:1, transition:'all .2s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <div style={{ flex:1, height:'0.5px', background:'var(--border)' }}/><span style={{ fontSize:11, color:'var(--text-3)' }}>or</span><div style={{ flex:1, height:'0.5px', background:'var(--border)' }}/>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} style={{ borderRadius:10 }}/>
          <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} style={{ borderRadius:10 }}/>
        </div>
        {err && <div style={{ fontSize:12, color:'#f87171', marginBottom:10, lineHeight:1.5 }}>{err}</div>}
        <button onClick={go} disabled={busy} style={{ width:'100%', padding:12, borderRadius:12, background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', color:'white', fontSize:14, fontWeight:500, cursor:busy?'default':'pointer', fontFamily:'var(--font-body)', boxShadow:'0 4px 18px var(--accent-glow)', opacity:busy?0.6:1, transition:'all .2s', marginBottom:14 }}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <div style={{ textAlign:'center', fontSize:13, color:'var(--text-3)', marginBottom:10 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <button onClick={()=>{setMode(m=>m==='login'?'signup':'login');setErr(null)}} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:13, fontFamily:'var(--font-body)', fontWeight:500 }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>
        <div style={{ textAlign:'center' }}>
          <button onClick={()=>{localStorage.setItem('shh_skip_auth','1');window.location.reload()}} style={{ background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:12, fontFamily:'var(--font-body)' }}>
            Continue without account
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main AuthGate ─────────────────────────────────────────────
// Keys that belong to a specific user — cleared on sign-out / account switch
// Keys intentionally NOT cleared: shh_theme (UX preference, not user data)
const USER_KEYS = [
  'shh_profile', 'shh_books', 'shh_notes', 'shh_chat_sessions',
  'shh_flashcards', 'shh_memory', 'shh_reading_ctx', 'shh_session',
  'shh_streak', 'shh_study_time', 'shh_quote_state', 'shh_tour_done',
  'shh_tour_pending', 'shh_skip_auth', 'shh_daily_plan',
]

function clearUserData() {
  USER_KEYS.forEach(k => localStorage.removeItem(k))
}

export default function AuthGate({ children }: Props) {
  const [user,      setUser]      = useState<User|null>(null)
  const [screen,    setScreen]    = useState<'landing'|'auth'|'loading'|'app'>('landing')
  const [msg,       setMsg]       = useState('Signing you in')
  // Track which user ID is currently loaded so we detect account switches
  const currentUid = useRef<string|null>(null)

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      if (u) handleReady(u)
      // No session → stay on landing (don't call handleReady with null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null

      if (event === 'SIGNED_OUT' || !u) {
        // Wipe everything and go back to landing
        clearUserData()
        currentUid.current = null
        setUser(null)
        setScreen('landing')
        return
      }

      // If the user ID changed (account switch) — clear old data first
      if (currentUid.current && currentUid.current !== u.id) {
        clearUserData()
      }

      // Only load if this is a new sign-in (not already showing this user's app)
      if (currentUid.current !== u.id) {
        handleReady(u)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReady = async (u: User) => {
    currentUid.current = u.id
    setScreen('loading')
    const steps = ['Loading your profile', 'Syncing your streak', 'Almost there']
    for (const s of steps) {
      setMsg(s)
      await new Promise(r => setTimeout(r, s === 'Almost there' ? 300 : 550))
    }
    try { await syncProfile(u.id) } catch {}
    setUser(u)
    setScreen('app')
    if (!localStorage.getItem('shh_tour_done')) {
      localStorage.setItem('shh_tour_pending', '1')
    }
  }

  const doSignOut = async () => {
    // Clear all user data BEFORE signing out so the new session starts clean
    clearUserData()
    currentUid.current = null
    await signOut()
    setUser(null)
    setScreen('landing')
  }

  if (screen === 'loading') return <LoadingScreen message={msg}/>
  if (screen === 'app' && user) return <>{children(user, doSignOut)}</>
  if (screen === 'auth') return <AuthForm onBack={()=>setScreen('landing')}/>
  return <Landing onStart={()=>setScreen('auth')}/>
}
