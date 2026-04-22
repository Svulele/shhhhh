import { useEffect, useRef, useState } from 'react'

export interface Profile {
  name: string
  ai: string
  vibe: string
  goals: string[]
  location: string
  lat: number | null
  lon: number | null
  onboarded: boolean
}

const AI_OPTS = [
  { id: 'claude', label: 'Claude', sub: 'Anthropic' },
  { id: 'gpt4', label: 'GPT-4', sub: 'OpenAI' },
  { id: 'gemini', label: 'Gemini', sub: 'Google' },
  { id: 'llama', label: 'LLaMA', sub: 'Open source' },
]

const GOAL_OPTS = ['Exams', 'Research', 'Personal growth', 'Language', 'Coding', 'Creative writing']

const VIBES = [
  { id: 'gentle', e: '🌱', label: 'Gentle', desc: 'Warm, patient, never judges.' },
  { id: 'balanced', e: '⚡', label: 'Balanced', desc: 'Supportive but keeps you accountable.' },
  { id: 'strict', e: '🎯', label: 'Strict', desc: 'Direct and results-focused. No fluff.' },
  { id: 'chill', e: '🌊', label: 'Chill', desc: 'Laid-back study companion. No pressure.' },
]

export default function OnboardingTour({ onDone }: { onDone: (profile: Profile) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [ai, setAi] = useState('claude')
  const [vibe, setVibe] = useState('balanced')
  const [goals, setGoals] = useState<string[]>([])
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'done' | 'denied'>('idle')
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [locationName, setLocationName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step !== 0) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 200)
    return () => window.clearTimeout(timer)
  }, [step])

  const toggleGoal = (goal: string) => {
    setGoals((current) => current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal])
  }

  const canNext = [name.trim().length > 0, true, true, goals.length > 0, true][step]

  const requestLocation = () => {
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords
        setCoords({ lat, lon })
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const payload = await response.json()
          setLocationName(payload.address?.city || payload.address?.town || payload.address?.state || 'your area')
        } catch {
          setLocationName('your area')
        }
        setLocStatus('done')
      },
      () => setLocStatus('denied')
    )
  }

  const finish = () => {
    const profile: Profile = {
      name,
      ai,
      vibe,
      goals,
      location: locationName,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      onboarded: true,
    }
    localStorage.setItem('shh_profile', JSON.stringify(profile))
    onDone(profile)
  }

  const steps = ['name', 'ai', 'vibe', 'goals', 'location']

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div style={{ display: 'flex', gap: 7, marginBottom: 32 }}>
          {steps.map((_, index) => (
            <div key={index} className={`step-dot${index <= step ? ' active' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Welcome</p>
            <p className="onboard-q">What should I call you?</p>
            <input
              ref={inputRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name..."
              style={{ fontSize: 18, fontWeight: 300, padding: '14px 18px' }}
              onKeyDown={(event) => event.key === 'Enter' && canNext && setStep(1)}
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Your AI</p>
            <p className="onboard-q">Which AI will you study with?</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {AI_OPTS.map((option) => (
                <button key={option.id} className={`ai-card${ai === option.id ? ' active' : ''}`} onClick={() => setAi(option.id)}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{option.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 300 }}>{option.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Your style</p>
            <p className="onboard-q">What kind of study buddy do you want?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {VIBES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setVibe(option.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'all .2s',
                    background: vibe === option.id ? 'var(--accent-soft)' : 'var(--bg-card)',
                    border: `0.5px solid ${vibe === option.id ? 'var(--border-active)' : 'var(--border)'}`,
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{option.e}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 }}>{option.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 300 }}>{option.desc}</div>
                  </div>
                  {vibe === option.id && (
                    <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Focus areas</p>
            <p className="onboard-q">What are you studying for?</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
              {GOAL_OPTS.map((goal) => (
                <button key={goal} className={`goal-chip${goals.includes(goal) ? ' active' : ''}`} onClick={() => toggleGoal(goal)}>
                  {goal}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p style={{ fontSize: 11, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Almost there</p>
            <p className="onboard-q">Can I see your location?</p>
            <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24, fontWeight: 300, lineHeight: 1.6 }}>
              Only used for weather on your home screen. Never shared.
            </p>
            {locStatus === 'idle' && (
              <button className="btn btn-primary" onClick={requestLocation} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
                </svg>
                Share location
              </button>
            )}
            {locStatus === 'asking' && <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Asking...</p>}
            {locStatus === 'done' && <p style={{ color: 'var(--green)', fontSize: 14 }}>✓ Got it — {locationName}</p>}
            {locStatus === 'denied' && <p style={{ color: '#f87171', fontSize: 13 }}>No problem, we&apos;ll skip weather.</p>}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 32, paddingTop: 24, borderTop: '0.5px solid var(--border)' }}>
          {step > 0 && (
            <button className="btn btn-ghost" style={{ padding: '8px 18px' }} onClick={() => setStep((current) => current - 1)}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button
              className="btn btn-primary"
              style={{ opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'default' }}
              onClick={() => canNext && setStep((current) => current + 1)}
            >
              Continue
            </button>
          ) : (
            <button className="btn btn-primary" onClick={finish}>Let&apos;s go →</button>
          )}
        </div>
      </div>
    </div>
  )
}
