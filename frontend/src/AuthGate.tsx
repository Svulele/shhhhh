import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, recordStudyDay } from './supabase'

export { recordStudyDay } from './supabase'

interface AuthGateProps {
  children: (user: User, doSignOut: () => Promise<void>) => ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const doSignOut = async () => {
    await supabase.auth.signOut()
  }

  const signInWithGoogle = async () => {
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setMessage(error.message)
      setBusy(false)
    }
  }

  const signInWithEmail = async () => {
    setBusy(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (!error) {
      setBusy(false)
      return
    }

    const fallback = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (fallback.error) setMessage(fallback.error.message)
    else setMessage('Account created. You can sign in now.')
    setBusy(false)
  }

  const continueWithoutAccount = () => {
    localStorage.setItem('shh_skip_auth', '1')
    window.location.reload()
  }

  useEffect(() => {
    if (!session?.user) return
    recordStudyDay(session.user.id).catch(console.warn)
  }, [session])

  if (loading) {
    return (
      <div className="onboard-wrap">
        <div className="onboard-card">
          <p className="onboard-q">Loading…</p>
        </div>
      </div>
    )
  }

  if (session?.user) return <>{children(session.user, doSignOut)}</>

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>
          Beta access
        </p>
        <p className="onboard-q">Sign in to sync your progress</p>
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24, fontWeight: 300, lineHeight: 1.6 }}>
          Use Google or email/password. You can also continue without an account and keep everything local.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-primary" onClick={signInWithGoogle} disabled={busy}>
            Continue with Google
          </button>

          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            style={{ width: '100%', padding: '14px 16px' }}
          />
          <input
            value={password}
            onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            style={{ width: '100%', padding: '14px 16px' }}
          />

          <button className="btn btn-primary" onClick={signInWithEmail} disabled={busy || !email.trim() || password.length < 6}>
            Sign in with email
          </button>

          <button className="btn btn-ghost" onClick={continueWithoutAccount} disabled={busy}>
            Continue without account
          </button>
        </div>

        {message && (
          <p style={{ color: '#f0b35d', fontSize: 13, marginTop: 14 }}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
