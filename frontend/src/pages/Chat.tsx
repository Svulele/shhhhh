import { useState, useEffect, useRef } from 'react'
import { useUser } from '../App'
import { recordStudyDay } from '../supabase'

// ── Types ─────────────────────────────────────────────────────
interface Message { id: string; role: 'user'|'assistant'; content: string; ts: number }
interface Session  { id: string; title: string; messages: Message[]; createdAt: number; bookCtx?: string; vibe?: string }

// ── Storage ───────────────────────────────────────────────────
const SKEY  = 'shh_chat_sessions'
const TKEY  = 'shh_study_time'
const loadS = (): Session[] => { try { return JSON.parse(localStorage.getItem(SKEY) ?? '[]') } catch { return [] } }
const saveS = (s: Session[]) => { try { localStorage.setItem(SKEY, JSON.stringify(s.slice(-30))) } catch {} }

// ── Study time tracking ───────────────────────────────────────
// Accumulates seconds spent in chat per day
function addStudyTime(secs: number) {
  const today = new Date().toISOString().split('T')[0]
  try {
    const data = JSON.parse(localStorage.getItem(TKEY) ?? '{}')
    data[today] = (data[today] ?? 0) + secs
    // Keep last 30 days only
    const keys = Object.keys(data).sort().slice(-30)
    const trimmed: Record<string,number> = {}
    keys.forEach(k => { trimmed[k] = data[k] })
    localStorage.setItem(TKEY, JSON.stringify(trimmed))
  } catch {}
}

// ── Profile reader — always fresh ────────────────────────────
const getProfile = () => { try { return JSON.parse(localStorage.getItem('shh_profile') ?? '{}') } catch { return {} } }

// ── Vibe system — LIVE, re-read every message ─────────────────
// Each vibe changes: tone, how it opens replies, how it pushes back, what it celebrates
const VIBE_CONFIG: Record<string, {
  system: string
  greeting: (name: string) => string
  starters: string[]
}> = {
  gentle: {
    system: `Your tone is warm, gentle and deeply patient. You celebrate every small win enthusiastically. You never criticise — if someone is struggling, you reframe it positively. You use encouraging language like "that's a great question", "you're doing really well", "no rush at all". You ask soft check-in questions like "how are you feeling about this?" You never push or pressure. Think: the kindest teacher you ever had.`,
    greeting: (n) => `Hey ${n} 🌱 I'm here whenever you're ready. No pressure at all — what's on your mind?`,
    starters: ['I\'m struggling with something, can you help?', 'Can you explain this gently?', 'I feel stuck — where do I start?', 'Can you encourage me?'],
  },
  balanced: {
    system: `Your tone is warm but focused. You balance encouragement with gentle accountability. You celebrate progress AND remind them of their goals when they drift. You ask follow-up questions to deepen understanding. You're like a trusted study partner — supportive but honest. If they're not making progress, you'll kindly point it out. Think: a good friend who also happens to be your tutor.`,
    greeting: (n) => `Hey ${n}! Ready to get into it? What are we working on today?`,
    starters: ['Explain what I just read', 'Quiz me on this topic', 'Help me make a study plan', 'What should I focus on?'],
  },
  strict: {
    system: `Your tone is direct, no-nonsense and results-focused. You skip pleasantries and get straight to the point. You push back if answers are vague or incomplete — "that's not precise enough, try again." You set clear expectations. You track whether they're meeting their goals and call it out if not. You use short, sharp sentences. No fluff. No over-praising. Think: a demanding but fair coach who genuinely wants them to succeed.`,
    greeting: (n) => `${n}. What are we working on? Let's not waste time.`,
    starters: ['Test me — no easy questions', 'Give me a hard problem to solve', 'Tell me exactly what I got wrong', 'Push me harder'],
  },
  chill: {
    system: `Your tone is relaxed, casual and pressure-free. You're like a friend who happens to know a lot. You use informal language, the occasional emoji, and you don't mind going off-topic briefly. You never make the user feel bad about not studying. If they want to chat, you chat. If they want to study, you help them study. Think: smart friend on the couch next to you.`,
    greeting: (n) => `Hey ${n} 👋 What's up? Studying, chilling, or somewhere in between?`,
    starters: ['Explain this like I\'m half asleep', 'Can we just talk through this casually?', 'Give me the short version', 'What\'s actually important here?'],
  },
}

// ── AI call ───────────────────────────────────────────────────
async function callAI(
  msgs: Message[],
  onChunk: (t: string) => void,
  onDone: () => void,
  onErr: (e: string) => void
) {
  try {
    const profile = getProfile()
    const userMessage = msgs[msgs.length - 1]?.content ?? ''
    
    const res = await fetch('http://localhost:8000/api/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        personality: profile.vibe ?? 'balanced',
        material_context: '',
        user_name: profile.name ?? 'Student'
      })
    })
    
    if (!res.ok) {
      const data = await res.json()
      onErr(data.detail || `API error: ${res.status}`)
      return
    }
    
    const data = await res.json()
    const text = data.reply ?? ''
    
    // Simulate streaming word by word
    const words = text.split(' ')
    for (let i = 0; i < words.length; i++) {
      await new Promise(r => setTimeout(r, 14))
      onChunk((i === 0 ? '' : ' ') + words[i])
    }
    onDone()
  } catch (e: any) {
    onErr(e?.message?.includes('fetch') ? 'Network error — check your connection.' : `Error: ${e?.message}`)
  }
}

// ── Speech ────────────────────────────────────────────────────
function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[#*`_~]/g, ''))
  u.rate = 1.05; u.pitch = 1; window.speechSynthesis.speak(u)
}

function useVoice(onResult: (t: string) => void) {
  const [listening, setL] = useState(false)
  const ref = useRef<any>(null)
  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported in this browser.'); return }
    if (listening) { ref.current?.stop(); setL(false); return }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false
    r.onresult = (e: any) => { onResult(e.results[0][0].transcript); setL(false) }
    r.onerror = () => setL(false); r.onend = () => setL(false)
    r.start(); ref.current = r; setL(true)
  }
  return { listening, toggle }
}

// ── Vibe badge ────────────────────────────────────────────────
const VIBE_BADGE: Record<string, { emoji: string; label: string; color: string }> = {
  gentle:   { emoji: '🌱', label: 'Gentle',   color: '#4ade80' },
  balanced: { emoji: '⚡', label: 'Balanced',  color: 'var(--accent)' },
  strict:   { emoji: '🎯', label: 'Strict',    color: '#f97316' },
  chill:    { emoji: '🌊', label: 'Chill',     color: '#38bdf8' },
}

// ── Message bubble ────────────────────────────────────────────
function Bubble({ msg, streaming, onSpeak }: { msg: Message; streaming?: boolean; onSpeak: () => void }) {
  const isUser = msg.role === 'user'
  const lines  = msg.content.split('\n')

  const renderLine = (line: string, i: number) => {
    // Handle bullet points
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <li key={i} style={{ marginBottom: 3, paddingLeft: 4 }}>{line.slice(2)}</li>
    }
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return (
      <p key={i} style={{ margin: i > 0 ? '5px 0 0' : '0', lineHeight: 1.7, wordBreak: 'break-word' }}>
        {parts.map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) return <strong key={j} style={{ fontWeight: 600 }}>{p.slice(2, -2)}</strong>
          if (p.startsWith('`')  && p.endsWith('`'))  return <code key={j} style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{p.slice(1, -1)}</code>
          return p
        })}
        {streaming && i === lines.length - 1 && (
          <span style={{ display: 'inline-block', width: 6, height: 14, background: 'var(--accent)', borderRadius: 2, marginLeft: 3, animation: 'pulse 1s ease-in-out infinite', verticalAlign: 'middle' }} />
        )}
      </p>
    )
  }

  const hasBullets = lines.some(l => l.startsWith('- ') || l.startsWith('• '))

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14, gap: 8, alignItems: 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10" /></svg>
        </div>
      )}
      <div style={{
        maxWidth: '72%', padding: '12px 16px', fontSize: 14, color: 'var(--text-1)', fontWeight: 300,
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        background: isUser ? 'var(--accent-soft)' : 'var(--bg-card)',
        border: `0.5px solid ${isUser ? 'var(--border-active)' : 'var(--border)'}`,
      }}>
        {hasBullets
          ? <ul style={{ paddingLeft: 16, margin: 0 }}>{lines.map(renderLine)}</ul>
          : lines.map(renderLine)
        }
      </div>
      {!isUser && !streaming && (
        <button onClick={onSpeak} title="Read aloud"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center', marginTop: 6, flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      )}
    </div>
  )
}

// ── Main Chat ─────────────────────────────────────────────────
export default function Chat({ material }: { material: any }) {
  const { user }  = useUser()
  const bookCtx   = material?.book ? `${material.book.title} by ${material.book.author}` : undefined
  const recap     = material?.recap
  const initQ     = material?.question as string | undefined

  // Profile is read fresh on every send — vibe changes take effect immediately
  const [sessions,  setSessions]  = useState<Session[]>(loadS)
  const [activeId,  setActiveId]  = useState<string | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState(initQ ?? '')
  const [streaming, setStreaming] = useState(false)
  const [streamId,  setStreamId]  = useState<string | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [showHist,  setShowHist]  = useState(false)
  const [currentVibe, setCurrentVibe] = useState(() => getProfile().vibe ?? 'balanced')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const sessionStart = useRef<number>(Date.now())

  const { listening, toggle: toggleVoice } = useVoice(t => {
    setInput(t)
    setTimeout(() => sendMsg(t), 200)
  })

  // Track time spent in chat
  useEffect(() => {
    sessionStart.current = Date.now()
    if (user) recordStudyDay(user.id).catch(console.warn)
    return () => {
      const secs = Math.round((Date.now() - sessionStart.current) / 1000)
      if (secs > 10) addStudyTime(secs)
    }
  }, [])

  useEffect(() => { if (initQ) setTimeout(() => sendMsg(initQ), 400) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { saveS(sessions) }, [sessions])
  useEffect(() => { inputRef.current?.focus() }, [])

  // Keep vibe badge in sync with profile changes
  useEffect(() => {
    const iv = setInterval(() => {
      const v = getProfile().vibe ?? 'balanced'
      setCurrentVibe(v)
    }, 2000)
    return () => clearInterval(iv)
  }, [])

  const vibe   = currentVibe
  const vibeCfg = VIBE_CONFIG[vibe] ?? VIBE_CONFIG.balanced
  const badge  = VIBE_BADGE[vibe] ?? VIBE_BADGE.balanced
  const p      = getProfile()

  const newSess = (): Session => ({
    id: Date.now().toString(),
    title: bookCtx ? `Chat — ${material?.book?.title}` : 'New chat',
    messages: [], createdAt: Date.now(), bookCtx, vibe,
  })

  const sendMsg = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    setInput(''); setError(null)

    // Re-read profile EVERY send so vibe/name/goals are always current
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, ts: Date.now() }
    const updated = [...messages, userMsg]
    setMessages(updated)

    let sid = activeId
    if (!sid) {
      const s = newSess(); s.messages = updated
      setSessions(prev => [s, ...prev]); setActiveId(s.id); sid = s.id
    }

    const aiId  = (Date.now() + 1).toString()
    const aiMsg: Message = { id: aiId, role: 'assistant', content: '', ts: Date.now() }
    setMessages(m => [...m, aiMsg])
    setStreaming(true); setStreamId(aiId)

    let full = ''
    await callAI(
      updated,
      chunk => { full += chunk; setMessages(m => m.map(x => x.id === aiId ? { ...x, content: full } : x)) },
      () => {
        setStreaming(false); setStreamId(null)
        const fin = [...updated, { ...aiMsg, content: full }]
        setMessages(fin)
        setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: fin, title: content.slice(0, 40) } : s))
      },
      err => {
        setStreaming(false); setStreamId(null); setError(err)
        setMessages(m => m.filter(x => x.id !== aiId))
      }
    )
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px clamp(16px,3vw,36px)', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-card)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, letterSpacing: '-0.4px', color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bookCtx ? `Chat — ${material.book.title}` : 'Ask the AI'}
          </div>
          {bookCtx && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Book context loaded</div>}
        </div>

        {/* Live vibe badge — shows current personality */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: 'var(--bg-card)', border: '0.5px solid var(--border)', fontSize: 11, color: badge.color, flexShrink: 0 }}>
          <span>{badge.emoji}</span>
          <span style={{ fontWeight: 500 }}>{badge.label}</span>
        </div>

        <button onClick={() => setShowHist(h => !h)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, border: `0.5px solid ${showHist ? 'var(--border-active)' : 'var(--border)'}`, background: showHist ? 'var(--accent-soft)' : 'var(--bg-card)', color: showHist ? 'var(--accent)' : 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0, transition: 'all .18s' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          History
        </button>
        <button onClick={() => { const s = newSess(); setSessions(prev => [s, ...prev]); setActiveId(s.id); setMessages([]); setError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0, transition: 'all .18s' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* History sidebar */}
        {showHist && (
          <div style={{ width: 240, borderRight: '0.5px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px 6px', fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)' }}>Recent chats</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 80px' }}>
              {sessions.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '20px 8px' }}>No chats yet.</p>}
              {sessions.map(s => (
                <button key={s.id} onClick={() => { setActiveId(s.id); setMessages(s.messages); setShowHist(false) }}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: activeId === s.id ? 'var(--accent-soft)' : 'transparent', border: `0.5px solid ${activeId === s.id ? 'var(--border-active)' : 'transparent'}`, textAlign: 'left', cursor: 'pointer', marginBottom: 4, transition: 'all .18s', fontFamily: 'var(--font-body)' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{s.messages.length} messages</span>
                    {s.vibe && <span style={{ color: VIBE_BADGE[s.vibe]?.color }}>{VIBE_BADGE[s.vibe]?.emoji}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages + input */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>

          {/* Messages scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px clamp(16px,3vw,40px) 8px' }}>
            {isEmpty && (
              <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 32 }}>
                {/* Vibe greeting */}
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.4px', color: 'var(--text-1)', marginBottom: 6 }}>
                  {vibeCfg.greeting(p.name?.split(' ')[0] || 'there')}
                </div>
                {bookCtx && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24, fontWeight: 300, lineHeight: 1.6 }}>
                    I have context about <span style={{ color: 'var(--accent)' }}>{bookCtx}</span> — ask me anything about it.
                  </div>
                )}

                {/* Recap questions */}
                {recap?.questions && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>From your session</div>
                    {recap.questions.map((q: string, i: number) => (
                      <button key={i} onClick={() => sendMsg(q)}
                        style={{ width: '100%', padding: '12px 16px', borderRadius: 12, background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)', marginBottom: 8, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.5, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontFamily: 'var(--font-body)', fontWeight: 300, transition: 'all .18s' }}>
                        {q}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))}
                  </div>
                )}

                {/* Vibe-specific starters */}
                {!recap && (
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10 }}>Try asking</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {vibeCfg.starters.map((s, i) => (
                        <button key={i} onClick={() => sendMsg(s)}
                          style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--bg-card)', border: '0.5px solid var(--border)', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 300, transition: 'all .18s' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {messages.map(msg => (
              <Bubble key={msg.id} msg={msg} streaming={streaming && msg.id === streamId} onSpeak={() => speak(msg.content)} />
            ))}

            {error && (
              <div style={{ margin: '12px 0', padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,.08)', border: '0.5px solid rgba(239,68,68,.2)', fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
                {error}
                <button onClick={() => setError(null)} style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>Dismiss</button>
              </div>
            )}
            <div ref={bottomRef} style={{ height: 1 }} />
          </div>

          {/* Input bar */}
          <div style={{ borderTop: '0.5px solid var(--border)', background: 'var(--bg-card)', backdropFilter: 'blur(16px)', flexShrink: 0, padding: '10px clamp(16px,3vw,40px) 80px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 760, margin: '0 auto' }}>
              <button onClick={toggleVoice} title={listening ? 'Stop' : 'Speak'}
                style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: `1px solid ${listening ? 'var(--border-active)' : 'var(--border)'}`, background: listening ? 'var(--accent-soft)' : 'var(--bg-card)', color: listening ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
                placeholder={listening ? 'Listening…' : `Ask ${badge.emoji} anything… (Enter to send)`}
                rows={1}
                disabled={streaming || listening}
                style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: 'none', fontSize: 14, fontWeight: 300, borderRadius: 12, padding: '10px 14px', lineHeight: 1.5 }}
              />
              <button onClick={() => sendMsg()} disabled={!input.trim() || streaming}
                style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', border: 'none', cursor: (!input.trim() || streaming) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px var(--accent-glow)', opacity: (!input.trim() || streaming) ? 0.4 : 1, transition: 'all .2s' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}