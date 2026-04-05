import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  bookContext?: string
}

// ── Storage ───────────────────────────────────────────────────
const SESSIONS_KEY = 'shh_chat_sessions'
const loadSessions = (): ChatSession[] => { try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]') } catch { return [] } }
const saveSessions = (s: ChatSession[]) => { try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(s.slice(-20))) } catch {} }

const loadProfile = () => { try { return JSON.parse(localStorage.getItem('shh_profile') ?? '{}') } catch { return {} } }

// ── AI models by provider ──────────────────────────────────────
const AI_MODELS: Record<string, string> = {
  claude:  'claude-sonnet-4-20250514',
  gpt4:    'claude-sonnet-4-20250514', // fallback to claude for now
  gemini:  'claude-sonnet-4-20250514',
  llama:   'claude-sonnet-4-20250514',
}

// ── Send message to Anthropic ─────────────────────────────────
async function sendToAI(
  messages: Message[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (e: string) => void
) {
  try {
    const profile = loadProfile()
    const model   = AI_MODELS[profile.ai ?? 'claude'] ?? 'claude-sonnet-4-20250514'

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    const data = await res.json()

    if (data.error) {
      const msg = data.error.message ?? 'Unknown API error'
      if (msg.includes('credit') || msg.includes('billing') || msg.includes('quota')) {
        onError('You\'ve reached your API usage limit. Check your Anthropic billing at console.anthropic.com.')
      } else {
        onError(`API error: ${msg}`)
      }
      return
    }

    const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
    // Simulate streaming by chunking
    const words = text.split(' ')
    for (let i = 0; i < words.length; i++) {
      await new Promise(r => setTimeout(r, 18))
      onChunk((i === 0 ? '' : ' ') + words[i])
    }
    onDone()
  } catch (e: any) {
    onError(e?.message?.includes('fetch') ? 'Network error — check your connection.' : `Something went wrong: ${e?.message ?? 'unknown error'}`)
  }
}

// ── Build system prompt ───────────────────────────────────────
function buildSystem(bookContext?: string, recap?: any): string {
  const profile = loadProfile()
  const name  = profile.name ? `The user's name is ${profile.name}.` : ''
  const goals = profile.goals?.length ? `Their study goals: ${profile.goals.join(', ')}.` : ''

  let base = `You are a helpful, warm study assistant called Shhhhh. ${name} ${goals}
Keep responses clear and concise. Use markdown for code and lists when helpful. Be encouraging but not sycophantic.`

  if (bookContext) {
    base += `\n\nThe user is currently reading: ${bookContext}.`
  }
  if (recap) {
    base += `\n\nThey just finished a reading session covering pages ${recap.fromPage}–${recap.toPage}.
Session summary: ${recap.summary?.join(' ')}
Use this context when they ask questions about what they read.`
  }
  return base.trim()
}

// ── Message bubble ────────────────────────────────────────────
function Bubble({ msg, isStreaming }: { msg: Message; isStreaming?: boolean }) {
  const isUser = msg.role === 'user'

  // Simple markdown: bold, code blocks, inline code
  const renderContent = (text: string) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      // Code block (simple)
      if (line.startsWith('```')) return <div key={i} style={{ fontFamily:'var(--font-mono,monospace)', fontSize:12, background:'var(--bg)', padding:'2px 8px', borderRadius:6, color:'var(--text-2)' }}>{line.replace(/```/g,'')}</div>
      // Bold
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      return (
        <p key={i} style={{ margin:i>0?'4px 0 0':'0', lineHeight:1.65 }}>
          {parts.map((p, j) =>
            p.startsWith('**') ? <strong key={j} style={{ fontWeight:500 }}>{p.slice(2,-2)}</strong> : p
          )}
        </p>
      )
    })
  }

  return (
    <div style={{ display:'flex', justifyContent:isUser?'flex-end':'flex-start', marginBottom:12, animation:'toastIn .25s ease both' }}>
      {!isUser && (
        <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),#7b6cf6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginRight:10, marginTop:2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
        </div>
      )}
      <div style={{
        maxWidth:'72%', padding:'12px 16px', borderRadius:isUser?'18px 4px 18px 18px':'4px 18px 18px 18px',
        background:isUser?'var(--accent-soft)':'var(--bg-card)',
        border:`0.5px solid ${isUser?'var(--border-active)':'var(--border)'}`,
        fontSize:14, color:'var(--text-1)', fontWeight:300,
      }}>
        {renderContent(msg.content)}
        {isStreaming && <span style={{ display:'inline-block', width:6, height:14, background:'var(--accent)', borderRadius:2, marginLeft:4, animation:'pulse 1s ease-in-out infinite', verticalAlign:'middle' }}/>}
      </div>
    </div>
  )
}

// ── Suggested starters ────────────────────────────────────────
const STARTERS = [
  'Explain the main concept I just read',
  'Quiz me on what I covered',
  'Summarise the key takeaways',
  'How does this connect to real life?',
]

// ── Main Chat ─────────────────────────────────────────────────
export default function Chat({ material }: { material: any }) {
  const profile = loadProfile()
  const bookContext = material?.book ? `${material.book.title} by ${material.book.author}` : undefined
  const recap       = material?.recap
  const initQuestion = material?.question as string | undefined

  const systemPrompt = buildSystem(bookContext, recap)

  const [sessions, setSessions]       = useState<ChatSession[]>(loadSessions)
  const [activeId, setActiveId]       = useState<string|null>(null)
  const [messages, setMessages]       = useState<Message[]>([])
  const [input, setInput]             = useState(initQuestion ?? '')
  const [streaming, setStreaming]     = useState(false)
  const [streamingId, setStreamingId] = useState<string|null>(null)
  const [error, setError]             = useState<string|null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Auto-send the initial question from recap
  useEffect(() => {
    if (initQuestion) {
      setTimeout(() => sendMessage(initQuestion), 300)
    }
  }, [])

  // Scroll to bottom on new message
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  // Persist sessions
  useEffect(() => { saveSessions(sessions) }, [sessions])

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus() }, [])

  const newSession = (): ChatSession => ({
    id: Date.now().toString(),
    title: bookContext ? `Chat about ${material.book.title}` : 'New chat',
    messages: [], createdAt: Date.now(),
    bookContext,
  })

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    setInput(''); setError(null)

    const userMsg: Message = { id: Date.now().toString(), role:'user', content, ts: Date.now() }
    const updatedMsgs = [...messages, userMsg]
    setMessages(updatedMsgs)

    // Ensure we have an active session
    let sid = activeId
    if (!sid) {
      const s = newSession()
      s.messages = updatedMsgs
      setSessions(prev => [s, ...prev])
      setActiveId(s.id)
      sid = s.id
    }

    // Streaming assistant reply
    const aiId  = (Date.now() + 1).toString()
    const aiMsg: Message = { id: aiId, role:'assistant', content:'', ts: Date.now() }
    setMessages(m => [...m, aiMsg])
    setStreaming(true); setStreamingId(aiId)

    let fullText = ''
    await sendToAI(
      updatedMsgs,
      systemPrompt,
      chunk => {
        fullText += chunk
        setMessages(m => m.map(msg => msg.id === aiId ? {...msg, content: fullText} : msg))
      },
      () => {
        setStreaming(false); setStreamingId(null)
        const finalMsgs = [...updatedMsgs, {...aiMsg, content: fullText}]
        setMessages(finalMsgs)
        setSessions(prev => prev.map(s => s.id === sid ? {...s, messages: finalMsgs, title: content.slice(0,40)} : s))
      },
      err => {
        setStreaming(false); setStreamingId(null)
        setError(err)
        setMessages(m => m.filter(msg => msg.id !== aiId))
      }
    )
  }

  const loadSession = (s: ChatSession) => {
    setActiveId(s.id); setMessages(s.messages); setShowHistory(false)
  }

  const clearChat = () => {
    const s = newSession()
    setSessions(prev => [s, ...prev])
    setActiveId(s.id); setMessages([]); setError(null)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 0px)', position:'relative' }}>

      {/* Topbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 24px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-card)', backdropFilter:'blur(12px)', flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, letterSpacing:'-0.5px', color:'var(--text-1)' }}>
            {bookContext ? `Chat — ${material.book.title}` : 'Ask the AI'}
          </div>
          {bookContext && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>Book context active</div>}
        </div>
        <button onClick={()=>setShowHistory(h=>!h)}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:999, border:'0.5px solid var(--border)', background:showHistory?'var(--accent-soft)':'var(--bg-card)', color:showHistory?'var(--accent)':'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .18s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/></svg>
          History
        </button>
        <button onClick={clearChat}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .18s' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New chat
        </button>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* History sidebar */}
        {showHistory && (
          <div style={{ width:260, borderRight:'0.5px solid var(--border)', background:'var(--bg-card)', display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ padding:'16px 16px 10px', fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase', color:'var(--text-3)' }}>Recent chats</div>
            <div style={{ flex:1, overflowY:'auto', padding:'0 8px 16px' }}>
              {sessions.length === 0 && <p style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'20px 8px' }}>No chats yet.</p>}
              {sessions.map(s => (
                <button key={s.id} onClick={()=>loadSession(s)}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:activeId===s.id?'var(--accent-soft)':'transparent', border:`0.5px solid ${activeId===s.id?'var(--border-active)':'transparent'}`, textAlign:'left', cursor:'pointer', marginBottom:4, transition:'all .18s' }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.title}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{s.messages.length} messages</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ flex:1, overflowY:'auto', padding:'24px 24px 8px' }}>

            {/* Empty state */}
            {isEmpty && (
              <div style={{ maxWidth:480, margin:'0 auto', paddingTop:40 }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:24, letterSpacing:'-0.5px', color:'var(--text-1)', marginBottom:8 }}>
                  {profile.name ? `Hey ${profile.name.split(' ')[0]}, what's on your mind?` : 'What do you want to explore?'}
                </div>
                {bookContext && (
                  <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:28, fontWeight:300, lineHeight:1.6 }}>
                    I have context about <span style={{ color:'var(--accent)' }}>{bookContext}</span> — ask me anything about it.
                  </div>
                )}
                {/* Recap questions as tappable cards */}
                {recap?.questions && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase', color:'var(--text-3)', marginBottom:12 }}>From your session</div>
                    {recap.questions.map((q: string, i: number) => (
                      <button key={i} onClick={()=>sendMessage(q)}
                        style={{ width:'100%', padding:'12px 16px', borderRadius:14, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', marginBottom:8, fontSize:13, color:'var(--text-1)', lineHeight:1.5, textAlign:'left', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, fontFamily:'var(--font-body)', fontWeight:300, transition:'all .18s' }}>
                        {q}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
                {/* General starters */}
                {!recap && (
                  <div>
                    <div style={{ fontSize:10, letterSpacing:'2.5px', textTransform:'uppercase', color:'var(--text-3)', marginBottom:12 }}>Try asking</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {STARTERS.map((s, i) => (
                        <button key={i} onClick={()=>sendMessage(s)}
                          style={{ padding:'12px 14px', borderRadius:14, background:'var(--bg-card)', border:'0.5px solid var(--border)', fontSize:13, color:'var(--text-2)', lineHeight:1.45, textAlign:'left', cursor:'pointer', fontFamily:'var(--font-body)', fontWeight:300, transition:'all .18s' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            {messages.map(msg => (
              <Bubble key={msg.id} msg={msg} isStreaming={streaming && msg.id === streamingId}/>
            ))}

            {/* Error */}
            {error && (
              <div style={{ margin:'12px 0', padding:'12px 16px', borderRadius:14, background:'rgba(239,68,68,0.08)', border:'0.5px solid rgba(239,68,68,0.2)', fontSize:13, color:'#fca5a5', lineHeight:1.6 }}>
                {error}
                <button onClick={()=>setError(null)} style={{ display:'block', marginTop:8, fontSize:12, color:'var(--text-3)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', padding:0 }}>Dismiss</button>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{ padding:'12px 24px 80px', borderTop:'0.5px solid var(--border)', background:'var(--bg-card)', backdropFilter:'blur(12px)', flexShrink:0 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
                placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
                rows={1} disabled={streaming}
                style={{ flex:1, minHeight:44, maxHeight:140, resize:'none', fontSize:14, fontWeight:300, borderRadius:14, padding:'12px 16px', lineHeight:1.5, overflow:'auto' }}/>
              <button onClick={()=>sendMessage()} disabled={!input.trim()||streaming}
                style={{ width:44, height:44, flexShrink:0, borderRadius:'50%', background:'linear-gradient(135deg,var(--accent),#7b6cf6)', border:'none', cursor:(!input.trim()||streaming)?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px var(--accent-glow)', opacity:(!input.trim()||streaming)?0.4:1, transition:'all .2s' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
