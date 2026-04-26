import { useState, useEffect, useRef } from 'react'
import { useUser } from '../App'
import { recordStudyDay } from '../supabase'

// ── Types ──────────────────────────────────────────────────────
interface Msg  { id:string; role:'user'|'assistant'; content:string; ts:number }
interface Sess { id:string; title:string; messages:Msg[]; createdAt:number; bookCtx?:string; vibe?:string }
interface Mem  { facts:string[]; updatedAt:number }

// ── Storage ────────────────────────────────────────────────────
const SK='shh_chat_sessions', TK='shh_study_time', MK='shh_memory'
const loadS=():Sess[]  =>{ try{return JSON.parse(localStorage.getItem(SK)??'[]')}catch{return[]} }
const saveS=(s:Sess[]) =>{ try{localStorage.setItem(SK,JSON.stringify(s.slice(-30)))}catch{} }
const loadM=():Mem     =>{ try{return JSON.parse(localStorage.getItem(MK)??'{"facts":[],"updatedAt":0}')}catch{return{facts:[],updatedAt:0}} }
const saveM=(m:Mem)    =>{ try{localStorage.setItem(MK,JSON.stringify(m))}catch{} }
const getProf=()       =>{ try{return JSON.parse(localStorage.getItem('shh_profile')??'{}')}catch{return{}} }

function addTime(secs:number) {
  const d=new Date().toISOString().split('T')[0]
  try {
    const t=JSON.parse(localStorage.getItem(TK)??'{}'); t[d]=(t[d]??0)+secs
    const keys=Object.keys(t).sort().slice(-30), r:Record<string,number>={}
    keys.forEach(k=>r[k]=t[k]); localStorage.setItem(TK,JSON.stringify(r))
  } catch {}
}

function getReadCtx() {
  try {
    const live=JSON.parse(localStorage.getItem('shh_reading_ctx')??'null')
    if(live?.title) return live
    const books=JSON.parse(localStorage.getItem('shh_books')??'[]')
    return [...books].filter((b:any)=>b.currentPage>1).sort((a:any,b:any)=>b.addedAt-a.addedAt)[0]??null
  } catch { return null }
}

// ── Memory — background extraction ────────────────────────────
async function updateMem(userMsg:string, aiReply:string) {
  const cur=loadM(); if(!userMsg.trim()||!aiReply.trim()) return
  try {
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:
`Extract 0–3 NEW study facts (learning style, struggles, goals, book preferences). Known: ${cur.facts.length?cur.facts.map(f=>`- ${f}`).join('\n'):'none'}
Exchange — Student: ${userMsg.slice(0,200)} | AI: ${aiReply.slice(0,200)}
Reply ONLY with JSON array (empty if nothing new): ["fact 1","fact 2"]`}]})
    })
    const data=await res.json()
    const fresh:string[]=JSON.parse((data.content??[]).map((c:any)=>c.text??'').join('').replace(/```json|```/g,'').trim())
    if(!fresh.length) return
    const merged=[...cur.facts]
    fresh.forEach(f=>{if(!merged.some(e=>e.toLowerCase().includes(f.toLowerCase().slice(0,20))))merged.push(f)})
    saveM({facts:merged.slice(-12),updatedAt:Date.now()})
  } catch {}
}

// ── Vibe ───────────────────────────────────────────────────────
const VIBES:Record<string,{sys:string;hi:(n:string)=>string;starts:string[]}> = {
  gentle:  {sys:'Warm, patient, encouraging. Celebrate wins. Soft check-ins. Never rush.',
            hi:n=>`Hey ${n} 🌱 No pressure — what's on your mind?`,
            starts:["I'm struggling","Explain gently","I feel stuck","Encourage me"]},
  balanced:{sys:'Warm but focused. Mix encouragement with gentle accountability. Ask follow-ups.',
            hi:n=>`Hey ${n}! What are we working on?`,
            starts:["Explain what I just read","Quiz me","Help me plan","What should I focus on?"]},
  strict:  {sys:'Direct, results-focused. Short sentences. Push back on vague answers. No fluff.',
            hi:n=>`${n}. What are we working on?`,
            starts:["Test me hard","What did I get wrong?","Give me a challenge","Push me"]},
  chill:   {sys:'Relaxed, casual, pressure-free. Smart friend. Occasional emoji.',
            hi:n=>`Hey ${n} 👋 What's up?`,
            starts:["Simple explanation","Short version","What matters here?","Talk me through it"]},
}
const BADGES:Record<string,{emoji:string;label:string;color:string}> = {
  gentle:  {emoji:'🌱',label:'Gentle',  color:'#4ade80'},
  balanced:{emoji:'⚡',label:'Balanced',color:'var(--accent)'},
  strict:  {emoji:'🎯',label:'Strict',  color:'#f97316'},
  chill:   {emoji:'🌊',label:'Chill',   color:'#38bdf8'},
}

// ── System prompt ──────────────────────────────────────────────
function buildSys(material:any) {
  const p=getProf(), vibe=p.vibe??'balanced', v=VIBES[vibe]??VIBES.balanced, mem=loadM()
  const rc=material?.book
    ?{title:material.book.title,author:material.book.author,currentPage:material.book.currentPage,totalPages:material.book.totalPages}
    :getReadCtx()
  let s=`You are Shhhhh, an AI study buddy. ${p.name?`User: ${p.name}.`:''} ${p.goals?.length?`Goals: ${p.goals.join(', ')}.`:''} Vibe: ${vibe}.
PERSONALITY: ${v.sys}
RULES: Never ask "what are you studying?" — you know from context. Reference book content directly. Be a companion. Stay in ${vibe} vibe. Concise. Use markdown for lists/code.`
  if(mem.facts.length) s+=`\nKNOWN ABOUT THIS STUDENT:\n${mem.facts.map(f=>`- ${f}`).join('\n')}\n(Use naturally, don't recite.)`
  if(rc){const pct=rc.totalPages>0?Math.round(rc.currentPage/rc.totalPages*100):0; s+=`\nCURRENT READING: "${rc.title}" by ${rc.author} — page ${rc.currentPage}/${rc.totalPages} (${pct}%). Pages ~${Math.max(1,rc.currentPage-15)}–${rc.currentPage} just read. Use your knowledge of this book to answer.`}
  if(material?.recap) s+=`\nJUST FINISHED: pages ${material.recap.fromPage}–${material.recap.toPage}. Summary: ${material.recap.summary?.join(' ')}`
  return s.trim()
}

// ── AI call ────────────────────────────────────────────────────
async function callAI(msgs:Msg[],sys:string,onChunk:(t:string)=>void,onDone:()=>void,onErr:(e:string)=>void) {
  try {
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1024,system:sys,messages:msgs.map(m=>({role:m.role,content:m.content}))})
    })
    const data=await res.json()
    if(data.error){onErr(data.error.message?.match(/credit|billing|quota/i)?'API limit reached.':data.error.message);return}
    const text=(data.content??[]).map((c:any)=>c.text??'').join('')
    const words=text.split(' ')
    for(let i=0;i<words.length;i++){await new Promise(r=>setTimeout(r,14));onChunk((i===0?'':' ')+words[i])}
    onDone()
  } catch(e:any){onErr(e?.message?.includes('fetch')?'Network error.':`Error: ${e?.message}`)}
}

const speak=(t:string)=>{
  if(!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u=new SpeechSynthesisUtterance(t.replace(/[#*`_~]/g,''))
  u.rate=1.05; window.speechSynthesis.speak(u)
}

function useVoice(onResult:(t:string)=>void) {
  const [on,setOn]=useState(false), ref=useRef<any>(null)
  const toggle=()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
    if(!SR){alert('Speech not supported.');return}
    if(on){ref.current?.stop();setOn(false);return}
    const r=new SR(); r.lang='en-US'; r.interimResults=false
    r.onresult=(e:any)=>{onResult(e.results[0][0].transcript);setOn(false)}
    r.onerror=()=>setOn(false); r.onend=()=>setOn(false)
    r.start(); ref.current=r; setOn(true)
  }
  return {listening:on,toggle}
}

// ── Bubble ─────────────────────────────────────────────────────
function Bubble({msg,streaming,onSpeak}:{msg:Msg;streaming?:boolean;onSpeak:()=>void}) {
  const isUser=msg.role==='user', lines=msg.content.split('\n')
  const hasBullets=lines.some(l=>l.startsWith('- ')||l.startsWith('• '))
  const renderLine=(line:string,i:number)=>{
    if(line.startsWith('- ')||line.startsWith('• ')) return <li key={i} style={{marginBottom:3,paddingLeft:4}}>{line.slice(2)}</li>
    const parts=line.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
    return (
      <p key={i} style={{margin:i>0?'5px 0 0':'0',lineHeight:1.7,wordBreak:'break-word'}}>
        {parts.map((p,j)=>{
          if(p.startsWith('**')&&p.endsWith('**')) return <strong key={j} style={{fontWeight:600}}>{p.slice(2,-2)}</strong>
          if(p.startsWith('`')&&p.endsWith('`'))   return <code key={j} style={{fontFamily:'monospace',fontSize:12,background:'var(--bg)',padding:'1px 5px',borderRadius:4}}>{p.slice(1,-1)}</code>
          return p
        })}
        {streaming&&i===lines.length-1&&<span style={{display:'inline-block',width:6,height:14,background:'var(--accent)',borderRadius:2,marginLeft:3,animation:'pulse 1s ease-in-out infinite',verticalAlign:'middle'}}/>}
      </p>
    )
  }
  return (
    <div style={{display:'flex',justifyContent:isUser?'flex-end':'flex-start',marginBottom:14,gap:8,alignItems:'flex-start'}}>
      {!isUser&&<div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/></svg>
      </div>}
      <div style={{maxWidth:'72%',padding:'12px 16px',fontSize:14,color:'var(--text-1)',fontWeight:300,borderRadius:isUser?'18px 4px 18px 18px':'4px 18px 18px 18px',background:isUser?'var(--accent-soft)':'var(--bg-card)',border:`0.5px solid ${isUser?'var(--border-active)':'var(--border)'}`}}>
        {hasBullets?<ul style={{paddingLeft:16,margin:0}}>{lines.map(renderLine)}</ul>:lines.map(renderLine)}
      </div>
      {!isUser&&!streaming&&(
        <button onClick={onSpeak} title="Read aloud" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:4,display:'flex',alignItems:'center',marginTop:6,flexShrink:0,transition:'color .2s'}}
          onMouseEnter={e=>(e.currentTarget.style.color='var(--text-2)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--text-3)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
      )}
    </div>
  )
}

// ── Memory badge ───────────────────────────────────────────────
function MemBadge() {
  const [open,setOpen]=useState(false), mem=loadM()
  if(!mem.facts.length) return null
  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:999,border:`0.5px solid ${open?'var(--border-active)':'var(--border)'}`,background:open?'var(--accent-soft)':'var(--bg-card)',color:open?'var(--accent)':'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/></svg>
        {mem.facts.length}
      </button>
      {open&&(
        <div style={{position:'absolute',top:'100%',right:0,marginTop:6,width:260,background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:14,padding:'12px 14px',boxShadow:'0 8px 24px rgba(0,0,0,.18)',backdropFilter:'blur(16px)',zIndex:50,animation:'scaleIn .2s var(--ease-out) both'}}>
          <div style={{fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>What I remember</div>
          {mem.facts.map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,marginBottom:7}}>
              <div style={{width:4,height:4,borderRadius:'50%',background:'var(--accent)',marginTop:6,flexShrink:0}}/>
              <span style={{fontSize:12,color:'var(--text-2)',fontWeight:300,lineHeight:1.55}}>{f}</span>
            </div>
          ))}
          <button onClick={()=>{saveM({facts:[],updatedAt:0});setOpen(false)}} style={{marginTop:8,fontSize:11,color:'#f87171',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',padding:0}}>
            Clear memory
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
export default function Chat({material}:{material:any}) {
  const {user}=useUser()
  const [sessions, setSessions] = useState<Sess[]>(loadS)
  const [activeId, setActiveId] = useState<string|null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input,    setInput]    = useState(material?.question??'')
  const [streaming,setStreaming]= useState(false)
  const [streamId, setStreamId] = useState<string|null>(null)
  const [error,    setError]    = useState<string|null>(null)
  const [showHist, setShowHist] = useState(false)
  const [curVibe,  setCurVibe]  = useState(()=>getProf().vibe??'balanced')
  const bottomRef=useRef<HTMLDivElement>(null), inputRef=useRef<HTMLTextAreaElement>(null), t0=useRef(Date.now())
  const {listening,toggle:toggleVoice}=useVoice(t=>{setInput(t);setTimeout(()=>sendMsg(t),200)})

  useEffect(()=>{
    t0.current=Date.now()
    if(user) recordStudyDay(user.id).catch(()=>{})
    return ()=>{const s=Math.round((Date.now()-t0.current)/1000);if(s>10)addTime(s)}
  },[])
  useEffect(()=>{if(material?.question)setTimeout(()=>sendMsg(material.question),400)},[])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages])
  useEffect(()=>{saveS(sessions)},[sessions])
  useEffect(()=>{inputRef.current?.focus()},[])
  useEffect(()=>{const iv=setInterval(()=>setCurVibe(getProf().vibe??'balanced'),2000);return ()=>clearInterval(iv)},[])

  const badge=BADGES[curVibe]??BADGES.balanced, cfg=VIBES[curVibe]??VIBES.balanced, p=getProf()
  const rc=material?.book?{title:material.book.title,author:material.book.author,currentPage:material.book.currentPage}:getReadCtx()
  const newS=():Sess=>({id:Date.now().toString(),title:rc?`Chat — ${rc.title}`:'New chat',messages:[],createdAt:Date.now(),bookCtx:rc?.title,vibe:curVibe})

  const sendMsg=async(text?:string)=>{
    const content=(text??input).trim(); if(!content||streaming) return
    setInput(''); setError(null)
    const sys=buildSys(material)
    const userMsg:Msg={id:Date.now().toString(),role:'user',content,ts:Date.now()}
    const updated=[...messages,userMsg]; setMessages(updated)
    let sid=activeId
    if(!sid){const s=newS();s.messages=updated;setSessions(p=>[s,...p]);setActiveId(s.id);sid=s.id}
    const aiId=(Date.now()+1).toString(), aiMsg:Msg={id:aiId,role:'assistant',content:'',ts:Date.now()}
    setMessages(m=>[...m,aiMsg]); setStreaming(true); setStreamId(aiId)
    let full=''
    await callAI(updated,sys,
      chunk=>{full+=chunk;setMessages(m=>m.map(x=>x.id===aiId?{...x,content:full}:x))},
      ()=>{
        setStreaming(false);setStreamId(null)
        const fin=[...updated,{...aiMsg,content:full}];setMessages(fin)
        setSessions(prev=>prev.map(s=>s.id===sid?{...s,messages:fin,title:content.slice(0,40)}:s))
        updateMem(content,full)
      },
      err=>{setStreaming(false);setStreamId(null);setError(err);setMessages(m=>m.filter(x=>x.id!==aiId))}
    )
  }

  const isEmpty=messages.length===0

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>

      {/* Topbar */}
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'11px clamp(14px,3vw,32px)',borderBottom:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(12px)',flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:18,letterSpacing:'-0.4px',color:'var(--text-1)'}}>Ask the AI</div>
          {rc&&<div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
            <span style={{fontSize:10,color:'var(--accent)',fontWeight:500}}>{rc.title} · p.{rc.currentPage}</span>
          </div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:999,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:11,color:badge.color,flexShrink:0}}>
          <span>{badge.emoji}</span><span style={{fontWeight:500}}>{badge.label}</span>
        </div>
        <MemBadge/>
        <button onClick={()=>setShowHist(h=>!h)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 11px',borderRadius:999,border:`0.5px solid ${showHist?'var(--border-active)':'var(--border)'}`,background:showHist?'var(--accent-soft)':'var(--bg-card)',color:showHist?'var(--accent)':'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',flexShrink:0,transition:'all .18s'}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> History
        </button>
        <button onClick={()=>{const s=newS();setSessions(p=>[s,...p]);setActiveId(s.id);setMessages([]);setError(null)}} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 11px',borderRadius:999,border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',flexShrink:0,transition:'all .18s'}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New
        </button>
      </div>

      {/* Body */}
      <div style={{display:'flex',flex:1,minHeight:0,overflow:'hidden'}}>
        {showHist&&(
          <div style={{width:240,borderRight:'0.5px solid var(--border)',background:'var(--bg-card)',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
            <div style={{padding:'12px 16px 6px',fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)'}}>Recent chats</div>
            <div style={{flex:1,overflowY:'auto',padding:'0 8px 80px'}}>
              {!sessions.length&&<p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',padding:'20px 8px'}}>No chats yet.</p>}
              {sessions.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:4,marginBottom:4}}>
                  <button onClick={()=>{setActiveId(s.id);setMessages(s.messages);setShowHist(false)}} style={{flex:1,padding:'10px 12px',borderRadius:10,background:activeId===s.id?'var(--accent-soft)':'transparent',border:`0.5px solid ${activeId===s.id?'var(--border-active)':'transparent'}`,textAlign:'left',cursor:'pointer',transition:'all .18s',fontFamily:'var(--font-body)',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                    <div style={{fontSize:11,color:'var(--text-3)',marginTop:2,display:'flex',gap:6}}>
                      <span>{s.messages.length} msgs</span>
                      {s.vibe&&<span style={{color:BADGES[s.vibe]?.color}}>{BADGES[s.vibe]?.emoji}</span>}
                    </div>
                  </button>
                  <button onClick={()=>{
                    setSessions(p=>p.filter(x=>x.id!==s.id))
                    if(activeId===s.id){setActiveId(null);setMessages([])}
                  }} title="Delete" style={{width:26,height:26,borderRadius:8,border:'none',background:'transparent',color:'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .18s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,.1)';e.currentTarget.style.color='#f87171'}}
                    onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text-3)'}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,minWidth:0}}>
          <div style={{flex:1,overflowY:'auto',padding:'20px clamp(14px,3vw,36px) 8px'}}>
            {isEmpty&&(
              <div style={{maxWidth:500,margin:'0 auto',paddingTop:28}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:21,letterSpacing:'-0.4px',color:'var(--text-1)',marginBottom:6}}>
                  {cfg.hi(p.name?.split(' ')[0]||'there')}
                </div>
                {rc&&<div style={{fontSize:13,color:'var(--text-3)',marginBottom:22,fontWeight:300,lineHeight:1.6}}>
                  On <span style={{color:'var(--accent)'}}>p.{rc.currentPage}</span> of <span style={{color:'var(--accent)'}}>{rc.title}</span> — ask me anything about it.
                </div>}
                {material?.recap?.questions&&(
                  <div style={{marginBottom:18}}>
                    <div style={{fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>From your session</div>
                    {material.recap.questions.map((q:string,i:number)=>(
                      <button key={i} onClick={()=>sendMsg(q)} style={{width:'100%',padding:'11px 14px',borderRadius:12,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',marginBottom:8,fontSize:13,color:'var(--text-1)',lineHeight:1.5,textAlign:'left',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontFamily:'var(--font-body)',fontWeight:300,transition:'all .18s'}}>
                        {q}<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
                {!material?.recap&&(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {cfg.starts.map((s,i)=>(
                      <button key={i} onClick={()=>sendMsg(s)} style={{padding:'11px 13px',borderRadius:12,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:13,color:'var(--text-2)',lineHeight:1.45,textAlign:'left',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:300,transition:'all .18s'}}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map(msg=><Bubble key={msg.id} msg={msg} streaming={streaming&&msg.id===streamId} onSpeak={()=>speak(msg.content)}/>)}
            {error&&(
              <div style={{margin:'12px 0',padding:'12px 16px',borderRadius:12,background:'rgba(239,68,68,.08)',border:'0.5px solid rgba(239,68,68,.2)',fontSize:13,color:'#fca5a5',lineHeight:1.6}}>
                {error}<button onClick={()=>setError(null)} style={{display:'block',marginTop:8,fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'var(--font-body)'}}>Dismiss</button>
              </div>
            )}
            <div ref={bottomRef} style={{height:1}}/>
          </div>

          {/* Input */}
          <div style={{borderTop:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(16px)',flexShrink:0,padding:'10px clamp(14px,3vw,36px) 80px'}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end',maxWidth:720,margin:'0 auto'}}>
              <button onClick={toggleVoice} title={listening?'Stop':'Speak'} style={{width:40,height:40,flexShrink:0,borderRadius:'50%',border:`1px solid ${listening?'var(--border-active)':'var(--border)'}`,background:listening?'var(--accent-soft)':'var(--bg-card)',color:listening?'var(--accent)':'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()}}} placeholder={listening?'Listening…':`Ask ${badge.emoji} anything… (Enter to send)`} rows={1} disabled={streaming||listening} style={{flex:1,minHeight:40,maxHeight:120,resize:'none',fontSize:14,fontWeight:300,borderRadius:12,padding:'10px 14px',lineHeight:1.5}}/>
              <button onClick={()=>sendMsg()} disabled={!input.trim()||streaming} style={{width:40,height:40,flexShrink:0,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',cursor:(!input.trim()||streaming)?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px var(--accent-glow)',opacity:(!input.trim()||streaming)?0.4:1,transition:'all .2s'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}