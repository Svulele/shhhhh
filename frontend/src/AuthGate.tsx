import { useState, useEffect } from 'react'
import { supabase, isCloudModeEnabled, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, syncProfile, recordStudyDay, getStreak } from './supabase'
import type { User } from '@supabase/supabase-js'

export { recordStudyDay, getStreak }

interface AuthGateProps {
  children: (user: User, doSignOut: () => Promise<void>) => React.ReactNode
}

// ── Loading screen — shown after sign-in while profile syncs ──
function LoadingScreen({ message }: { message: string }) {
  const [dots, setDots] = useState('.')

  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '.' : d + '.'), 500)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,var(--orb-1) 0%,transparent 70%)', top: -150, right: -100, filter: 'blur(90px)', pointerEvents: 'none', animation: 'orbFloat 6s ease-in-out infinite' }} />
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,var(--orb-2) 0%,transparent 70%)', bottom: 0, left: -80, filter: 'blur(90px)', pointerEvents: 'none', animation: 'orbFloat 8s ease-in-out infinite reverse' }} />

      {/* Logo mark — animated */}
      <div style={{ position: 'relative', marginBottom: 40 }}>
        {/* Pulsing ring */}
        <div style={{
          position: 'absolute', inset: -16,
          borderRadius: '50%',
          border: '1px solid var(--border-active)',
          animation: 'ringPulse 2s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: -28,
          borderRadius: '50%',
          border: '0.5px solid var(--border)',
          animation: 'ringPulse 2s ease-in-out infinite',
          animationDelay: '0.4s',
        }} />
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg,var(--accent),#7b6cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px var(--accent-glow)',
          animation: 'logoBreath 3s ease-in-out infinite',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 26,
            fontStyle: 'italic', color: 'white', letterSpacing: '-0.5px',
          }}>Sh</span>
        </div>
      </div>

      {/* Message */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 22,
        letterSpacing: '-0.4px', color: 'var(--text-1)',
        marginBottom: 10, textAlign: 'center',
        animation: 'fadeUp .6s ease both',
      }}>
        Getting things ready
      </div>
      <div style={{
        fontSize: 13, color: 'var(--text-3)', fontWeight: 300,
        animation: 'fadeUp .6s ease both', animationDelay: '.1s',
        minWidth: 200, textAlign: 'center',
      }}>
        {message}{dots}
      </div>

      {/* Bottom progress bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 2, background: 'var(--text-4)',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg,var(--accent),#b07ef7)',
          animation: 'loadBar 2s ease-in-out infinite',
        }} />
      </div>

      <style>{`
        @keyframes ringPulse {
          0%,100% { opacity: .3; transform: scale(1); }
          50%      { opacity: .7; transform: scale(1.04); }
        }
        @keyframes logoBreath {
          0%,100% { transform: scale(1); box-shadow: 0 8px 32px var(--accent-glow); }
          50%      { transform: scale(1.04); box-shadow: 0 12px 40px var(--accent-glow); }
        }
        @keyframes orbFloat {
          0%,100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loadBar {
          0%   { width: 0%; margin-left: 0; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  )
}

export default function AuthGate({ children }: AuthGateProps) {
  const [user,     setUser]     = useState<User | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState('Signing you in')
  const [mode,     setMode]     = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      if (u) {
        handleUserReady(u)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      if (u && !user) handleUserReady(u)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleUserReady = async (u: User) => {
    setSyncing(true)
    setSyncMsg('Loading your profile')

    try {
      setSyncMsg('Syncing your profile')
      await syncProfile(u.id)

      setSyncMsg('Counting your streak')
      // Small artificial pause so the loading screen feels intentional
      await new Promise(r => setTimeout(r, 600))

      setSyncMsg('Almost there')
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.warn('Sync error:', e)
    }

    setUser(u)
    setSyncing(false)
    setLoading(false)
  }

  const handleEmail = async () => {
    if (!isCloudModeEnabled) {
      setError('Cloud sign-in is unavailable right now. Use local-only mode below.')
      return
    }
    if (!email.trim() || !password.trim()) { setError('Please enter email and password.'); return }
    setBusy(true); setError(null)
    try {
      if (mode === 'login') await signInWithEmail(email, password)
      else await signUpWithEmail(email, password)
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.')
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    if (!isCloudModeEnabled) {
      setError('Cloud sign-in is unavailable right now. Use local-only mode below.')
      return
    }
    setBusy(true); setError(null)
    try { await signInWithGoogle() }
    catch (e: any) { setError(e.message); setBusy(false) }
  }

  const doSignOut = async () => { await signOut(); setUser(null) }

  // Loading check on startup
  if (loading && !syncing) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s ease-in-out infinite' }} />
    </div>
  )

  // Beautiful loading screen after sign-in
  if (syncing) return <LoadingScreen message={syncMsg} />

  // App is ready and user is logged in
  if (user) return <>{children(user, doSignOut)}</>

  // ── Auth screen ────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Orbs */}
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,var(--orb-1) 0%,transparent 70%)', top: -150, right: -100, filter: 'blur(90px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,var(--orb-2) 0%,transparent 70%)', bottom: 0, left: -80, filter: 'blur(90px)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--bg-card)',
        border: '0.5px solid var(--border)', borderRadius: 28,
        padding: '40px 36px 36px', position: 'relative', zIndex: 1,
        animation: 'pageUp .4s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        {/* Logo + tagline */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontStyle: 'italic', color: 'var(--text-1)', marginBottom: 4 }}>Shhhhh</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 300 }}>
            {mode === 'login' ? 'Welcome back. Ready to learn?' : 'Your study buddy is waiting.'}
          </div>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={busy || !isCloudModeEnabled} style={{
          width: '100%', padding: 12, borderRadius: 12,
          border: '0.5px solid var(--border)', background: 'var(--bg-card)',
          color: 'var(--text-1)', fontSize: 14, fontWeight: 500,
          cursor: busy || !isCloudModeEnabled ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          marginBottom: 16, transition: 'all .2s', opacity: busy || !isCloudModeEnabled ? 0.6 : 1,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
        </div>

        {/* Email + password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            style={{ borderRadius: 10 }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            style={{ borderRadius: 10 }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10, lineHeight: 1.5 }}>{error}</div>
        )}

        {!isCloudModeEnabled && (
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5, textAlign: 'center' }}>
            Cloud sync is temporarily unavailable. You can still use the app in local-only mode.
          </div>
        )}

        <button onClick={handleEmail} disabled={busy || !isCloudModeEnabled} style={{
          width: '100%', padding: 12, borderRadius: 12,
          background: 'linear-gradient(135deg,var(--accent),#7b6cf6)',
          border: 'none', color: 'white', fontSize: 14, fontWeight: 500,
          cursor: busy || !isCloudModeEnabled ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
          boxShadow: '0 4px 18px var(--accent-glow)', opacity: busy || !isCloudModeEnabled ? 0.6 : 1,
          transition: 'all .2s', marginBottom: 16,
        }}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>

        {/* Toggle mode */}
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have one? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button onClick={() => { localStorage.setItem('shh_skip_auth', '1'); window.location.reload() }}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-body)' }}>
            Continue without account
          </button>
        </div>
      </div>
    </div>
  )
}
