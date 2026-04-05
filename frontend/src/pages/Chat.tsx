import { useState, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Message {
  id: string; role: 'user'|'assistant'; content: string; ts: number
}
interface Session {
  id: string; title: string; messages: Message[]; createdAt: number; bookCtx?: string
}

// ── Storage ───────────────────────────────────────────────────
const KEY = 'shh_chat_sessions'
const load  = (): Session[] => { try { return JSON.parse(localStorage.getItem(KEY)?? '[]') } catch { return [] } }
const save  = (s: Session[]) => { try { localStorage.setItem(KEY, JSON.stringify(s.slice(-20))) } catch {} }
const prof  = () => { try { return JSON.parse(localStorage.getItem('shh_profile')?? '{}') } catch { return {} } }

// ── Personality / vibe system prompts ─────────────────────────
const VIBE_PROMPTS: Record<string, string> = {
  gentle:   'You are warm, patient and encouraging. Celebrate every small win. Never rush or judge. Use soft, supportive language.',
  balanced: 'You are supportive but focused. Keep the user on track while being kind. Mix encouragement with gentle accountability.',
  strict:   'You are direct and results-focused. No fluff or over-praising. Keep responses tight and action-oriented. Hold the user accountable.',
  chill:    'You are a relaxed, friendly study companion. Keep it casual and pressure-free. Use a conversational tone.',
}

function buildSystem(bookCtx?: string, recap?: any): string {
  const p      = prof()
  const vibe   = VIBE_PROMPTS[p.vibe] ?? VIBE_PROMPTS.balanced
  const name   = p.name   ? `The user's name is ${p.name}.` : ''
  const goals  = p.goals?.length ? `Their study goals: ${p.goals.join(', ')}.` : ''
  let sys = `You are Shhhhh, an AI study buddy. ${vibe} ${name} ${goals}
You're not just an assistant — you're a companion. You remember context within this conversation, ask follow-up questions, and guide the user like a friend who genuinely cares about their progress.
Keep responses concise. Use markdown for lists and code when helpful.`
  if (bookCtx) sys += `\n\nThe user is currently reading: ${bookCtx}.`
  if (recap)   sys += `\n\nRecent session: pages ${recap.fromPage}–${recap.toPage}. Summary: ${recap.summary?.join(' ')}`
  return sys.trim()
}

// ── AI call with simulated streaming ─────────────────────────
async function callAI(
  messages: Message[], system: string,
  onChunk: (t: string) => void, onDone: () => void, onErr: (e: string) => void
) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1024, system,
        messages: messages.map(m=>({role:m.role,content:m.content})),
      })
    })
    const data = await res.json()
    if (data.error) {
      const msg = data.error.message ?? ''
      if (msg.match(/credit|billing|quota/i)) onErr('You\'ve reached your API usage limit. Visit console.anthropic.com to top up.')
      else onErr(`API error: ${msg}`)
      return
    }
    const text = (data.content??[]).map((c:any)=>c.text??'').join('')
    const words = text.split(' ')
    for (let i=0; i<words.length; i++) {
      await new Promise(r=>setTimeout(r,16))
      onChunk((i===0?'':' ')+words[i])
    }
    onDone()
  } catch (e: any) {
    onErr(e?.message?.includes('fetch') ? 'Network error — check your connection.' : `Error: ${e?.message}`)
  }
}

// ── Text-to-speech ────────────────────────────────────────────
function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/[#*`]/g,''))
  u.rate = 1.05; u.pitch = 1; u.volume = 1
  window.speechSynthesis.speak(u)
}

// ── Voice input ───────────────────────────────────────────────
function useVoiceInput(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)

  const toggle = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Speech recognition not supported in this browser.'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const rec = new SR()
    rec.lang = 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1
    rec.onresult = (e: any) => { onResult(e.results[0][0].transcript); setListening(false) }
    rec.onerror  = () => setListening(false)
    rec.onend    = () => setListening(false)
    rec.start(); recRef.current = rec; setListening(true)
  }
  return { listening, toggle }
}

// ── Bubble ────────────────────────────────────────────────────
function Bubble({ msg, isStreaming, onSpeak }: { msg: Message; isStreaming?: boolean; onSpeak: () => void }) {
  const isUser = msg.role === 'user'
  const lines  = msg.content.split('\n')

  const renderLine = (line: string, i: number) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return (
      <p key={i} style={{margin:i>0?'4px 0 0':'0',lineHeight:1.65,wordBreak:'break-word'}}>
        {parts.map((p,j) => {
          if (p.startsWith('**') && p.endsWith('**')) return <strong key={j} style={{fontWeight:500}}>{p.slice(2,-2)}</strong>
          if (p.startsWith('`')  && p.endsWith('`'))  return <code key={j} style={{fontFamily:'monospace',fontSize:12,background:'var(--bg)',padding:'1px 5px',borderRadius:4}}>{p.slice(1,-1)}</code>
          return p
        })}
        {isStreaming && i===lines.length-1 && <span style={{display:'inline-block',width:6,height:14,background:'var(--accent)',borderRadius:2,marginLeft:3,animation:'pulse 1s ease-in-out infinite',verticalAlign:'middle'}}/>}
      </p>
    )
  }

  return (
    <div style={{display:'flex',justifyContent:isUser?'flex-end':'flex-start',marginBottom:12,gap:8,alignItems:'flex-start'}}>
      {!isUser && (
        <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/></svg>
        </div>
      )}
      <div style={{maxWidth:'72%',padding:'12px 16px',fontSize:14,color:'var(--text-1)',fontWeight:300,
        borderRadius:isUser?'18px 4px 18px 18px':'4px 18px 18px 18px',
        background:isUser?'var(--accent-soft)':'var(--bg-card)',
        border:`0.5px solid ${isUser?'var(--border-active)':'var(--border)'}`,
      }}>
        {lines.map(renderLine)}
      </div>
      {!isUser && !isStreaming && (
        <button onClick={onSpeak} title="Read aloud"
          style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:4,display:'flex',alignItems:'center',marginTop:6,flexShrink:0,transition:'color .2s'}}
          onMouseEnter={e=>(e.currentTarget.style.color='var(--text-2)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-3)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
      )}
    </div>
  )
}

const STARTERS = ['Explain the main concept I read','Quiz me on what I studied','Help me make a study plan','What should I focus on today?']

// ── Main Chat ─────────────────────────────────────────────────
export default function Chat({ material }: { material: any }) {
  const bookCtx    = material?.book ? `${material.book.title} by ${material.book.author}` : undefined
  const recap      = material?.recap
  const initQ      = material?.question as string|undefined
  const system     = buildSystem(bookCtx, recap)

  const [sessions, setSessions]     = useState<Session[]>(load)
  const [activeId, setActiveId]     = useState<string|null>(null)
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState(initQ ?? '')
  const [streaming, setStreaming]   = useState(false)
  const [streamId, setStreamId]     = useState<string|null>(null)
  const [error, setError]           = useState<string|null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const { listening, toggle: toggleVoice } = useVoiceInput(t => { setInput(t); setTimeout(()=>sendMsg(t), 200) })

  useEffect(() => { if (initQ) setTimeout(()=>sendMsg(initQ),300) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages])
  useEffect(() => { save(sessions) }, [sessions])
  useEffect(() => { inputRef.current?.focus() }, [])

  const newSess = (): Session => ({ id:Date.now().toString(), title:bookCtx?`Chat — ${material?.book?.title}`:'New chat', messages:[], createdAt:Date.now(), bookCtx })

  const sendMsg = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    setInput(''); setError(null)

    const userMsg: Message = { id:Date.now().toString(), role:'user', content, ts:Date.now() }
    const updated = [...messages, userMsg]
    setMessages(updated)

    let sid = activeId
    if (!sid) {
      const s = newSess(); s.messages = updated
      setSessions(prev=>[s,...prev]); setActiveId(s.id); sid = s.id
    }

    const aiId  = (Date.now()+1).toString()
    const aiMsg: Message = { id:aiId, role:'assistant', content:'', ts:Date.now() }
    setMessages(m=>[...m,aiMsg]); setStreaming(true); setStreamId(aiId)

    let full = ''
    await callAI(updated, system,
      chunk => { full+=chunk; setMessages(m=>m.map(x=>x.id===aiId?{...x,content:full}:x)) },
      ()    => {
        setStreaming(false); setStreamId(null)
        const final = [...updated, {...aiMsg,content:full}]
        setMessages(final)
        setSessions(prev=>prev.map(s=>s.id===sid?{...s,messages:final,title:content.slice(0,40)}:s))
      },
      err   => { setStreaming(false); setStreamId(null); setError(err); setMessages(m=>m.filter(x=>x.id!==aiId)) }
    )
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  const clearChat = () => {
    const s = newSess()
    setSessions(prev=>[s,...prev]); setActiveId(s.id); setMessages([]); setError(null)
  }

  const isEmpty = messages.length === 0

  return (
    /* Full bleed — uses entire viewport width, no left margin */
    <div style={{display:'flex',flexDirection:'column',height:'100vh',width:'100%',overflow:'hidden'}}>

      {/* Topbar */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px clamp(16px,3vw,40px)',borderBottom:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(12px)',flexShrink:0,zIndex:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:20,letterSpacing:'-0.5px',color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {bookCtx ? `Chat — ${material.book.title}` : 'Ask the AI'}
          </div>
          {bookCtx && <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>Book context loaded</div>}
        </div>
        <button onClick={()=>setShowHistory(h=>!h)}
          style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,border:`0.5px solid ${showHistory?'var(--border-active)':'var(--border)'}`,background:showHistory?'var(--accent-soft)':'var(--bg-card)',color:showHistory?'var(--accent)':'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          History
        </button>
        <button onClick={clearChat}
          style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:999,border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New
        </button>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden',width:'100%'}}>

        {/* History panel */}
        {showHistory && (
          <div style={{width:250,borderRight:'0.5px solid var(--border)',background:'var(--bg-card)',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
            <div style={{padding:'14px 16px 8px',fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)'}}>Recent</div>
            <div style={{flex:1,overflowY:'auto',padding:'0 8px 16px'}}>
              {sessions.length===0 && <p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',padding:'20px 8px'}}>No chats yet.</p>}
              {sessions.map(s=>(
                <button key={s.id} onClick={()=>{setActiveId(s.id);setMessages(s.messages);setShowHistory(false)}}
                  style={{width:'100%',padding:'10px 12px',borderRadius:10,background:activeId===s.id?'var(--accent-soft)':'transparent',border:`0.5px solid ${activeId===s.id?'var(--border-active)':'transparent'}`,textAlign:'left',cursor:'pointer',marginBottom:4,transition:'all .18s',fontFamily:'var(--font-body)'}}>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                  <div style={{fontSize:11,color:'var(--text-3)',marginTop:2}}>{s.messages.length} messages</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages area — max-width centred, no left bleed issue */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
          <div style={{flex:1,overflowY:'auto',padding:'24px clamp(16px,3vw,40px) 8px'}}>

            {isEmpty && (
              <div style={{maxWidth:520,margin:'0 auto',paddingTop:40}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:24,letterSpacing:'-0.5px',color:'var(--text-1)',marginBottom:8}}>
                  {prof().name ? `Hey ${prof().name.split(' ')[0]}, what's on your mind?` : 'What do you want to explore?'}
                </div>
                {bookCtx && <div style={{fontSize:13,color:'var(--text-3)',marginBottom:28,fontWeight:300,lineHeight:1.6}}>I have context about <span style={{color:'var(--accent)'}}>{bookCtx}</span> — ask me anything about it.</div>}
                {recap?.questions && (
                  <div style={{marginBottom:24}}>
                    <div style={{fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>From your session</div>
                    {recap.questions.map((q:string,i:number)=>(
                      <button key={i} onClick={()=>sendMsg(q)}
                        style={{width:'100%',padding:'12px 16px',borderRadius:14,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',marginBottom:8,fontSize:13,color:'var(--text-1)',lineHeight:1.5,textAlign:'left',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontFamily:'var(--font-body)',fontWeight:300,transition:'all .18s'}}>
                        {q}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
                {!recap && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {STARTERS.map((s,i)=>(
                      <button key={i} onClick={()=>sendMsg(s)}
                        style={{padding:'12px 14px',borderRadius:14,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:13,color:'var(--text-2)',lineHeight:1.45,textAlign:'left',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:300,transition:'all .18s'}}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map(msg=>(
              <Bubble key={msg.id} msg={msg} isStreaming={streaming&&msg.id===streamId}
                onSpeak={()=>speak(msg.content)}/>
            ))}

            {error && (
              <div style={{margin:'12px 0',padding:'12px 16px',borderRadius:14,background:'rgba(239,68,68,.08)',border:'0.5px solid rgba(239,68,68,.2)',fontSize:13,color:'#fca5a5',lineHeight:1.6}}>
                {error}
                <button onClick={()=>setError(null)} style={{display:'block',marginTop:8,fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',padding:0}}>Dismiss</button>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Input bar */}
          <div style={{padding:'12px clamp(16px,3vw,40px) 80px',borderTop:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(12px)',flexShrink:0}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end',maxWidth:800,margin:'0 auto'}}>
              {/* Voice button */}
              <button onClick={toggleVoice} title={listening?'Stop listening':'Speak'}
                style={{width:44,height:44,flexShrink:0,borderRadius:'50%',border:`1px solid ${listening?'var(--border-active)':'var(--border)'}`,background:listening?'var(--accent-soft)':'var(--bg-card)',color:listening?'var(--accent)':'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',animation:listening?'pulse 1.2s ease-in-out infinite':'none'}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>

              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={listening?'Listening…':'Ask anything… (Enter to send)'}
                rows={1} disabled={streaming||listening}
                style={{flex:1,minHeight:44,maxHeight:140,resize:'none',fontSize:14,fontWeight:300,borderRadius:14,padding:'12px 16px',lineHeight:1.5,overflow:'auto'}}/>

              <button onClick={()=>sendMsg()} disabled={!input.trim()||streaming}
                style={{width:44,height:44,flexShrink:0,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',cursor:(!input.trim()||streaming)?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px var(--accent-glow)',opacity:(!input.trim()||streaming)?0.4:1,transition:'all .2s'}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}