import { aiFetch, API_URL } from '../api'
import { memo, useCallback, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import useModalFocus from '../components/useModalFocus'
import WindowItem from '../components/WindowItem'
import { useUser } from '../App'
import { recordStudyDay } from '../supabase'
import MessageContent from '../components/MessageContent'
import Icon from '../components/Icon'
const extractReadingPages: typeof import('./Library').extractReadingPages = async (...args) => (await import('./Library')).extractReadingPages(...args)
import { sourcePrompt, type ReadingContext, type SourcePage } from '../readingContext'

// ── Types ──────────────────────────────────────────────────────
interface Msg  { id:string; role:'user'|'assistant'; content:string; ts:number }
interface Sess { id:string; title:string; messages:Msg[]; createdAt:number; bookCtx?:string; vibe?:string; readingContext?:ReadingContext | null }
interface Mem  { facts:string[]; updatedAt:number }

// ── Storage ────────────────────────────────────────────────────
const SK='shh_chat_sessions', TK='shh_study_time', MK='shh_memory'
const loadS=():Sess[]  =>{ try{return JSON.parse(localStorage.getItem(SK)??'[]')}catch{return[]} }
const saveS=(s:Sess[]) =>{ try{localStorage.setItem(SK,JSON.stringify(s.slice(-30)))}catch{ /* storage unavailable */ } }
const loadM=():Mem     =>{ try{return JSON.parse(localStorage.getItem(MK)??'{"facts":[],"updatedAt":0}')}catch{return{facts:[],updatedAt:0}} }
const saveM=(m:Mem)    =>{ try{localStorage.setItem(MK,JSON.stringify(m))}catch{ /* storage unavailable */ } }
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
    return null
  } catch { return null }
}

// ── Vibe ───────────────────────────────────────────────────────
const VIBES:Record<string,{sys:string;hi:(n:string)=>string;starts:string[]}> = {
  gentle:  {sys:'Warm, patient, encouraging. Celebrate wins. Soft check-ins. Never rush.',
            hi:n=>`Hey ${n} No pressure — what's on your mind?`,
            starts:["I'm struggling","Explain gently","I feel stuck","Encourage me"]},
  balanced:{sys:'Warm but focused. Mix encouragement with gentle accountability. Ask follow-ups.',
            hi:n=>`Hey ${n}! What are we working on?`,
            starts:["Explain what I just read","Quiz me","Help me plan","What should I focus on?"]},
  strict:  {sys:'Direct, results-focused. Short sentences. Push back on vague answers. No fluff.',
            hi:n=>`${n}. What are we working on?`,
            starts:["Test me hard","What did I get wrong?","Give me a challenge","Push me"]},
  chill:   {sys:'Relaxed, casual, pressure-free. Smart friend. Occasional emoji.',
            hi:n=>`Hey ${n} What's up?`,
            starts:["Simple explanation","Short version","What matters here?","Talk me through it"]},
}
const BADGES:Record<string,{label:string;color:string}> = {
  gentle:  {label:'Gentle',  color:'var(--green)'},
  balanced:{label:'Balanced',color:'var(--accent)'},
  strict:  {label:'Strict',  color:'var(--amber)'},
  chill:   {label:'Chill',   color:'var(--accent)'},
}

// ── System prompt ──────────────────────────────────────────────
async function buildSys(rc:ReadingContext | null, fromPage: number, toPage: number) {
  const p=getProf(), vibe=p.vibe??'balanced', v=VIBES[vibe]??VIBES.balanced
  let prompt=`You are Shhhhh, an AI study buddy. ${p.name?`User: ${p.name}.`:''} Vibe: ${vibe}.
PERSONALITY: ${v.sys}
Be concise. Do not invent facts about the student, exams, reading history or book content. Use simple Markdown for lists, emphasis and code. Ask for the source if reading context is absent.`
  if(rc) {
    const context: ReadingContext = {...rc,fromPage,toPage}
    const { extractReadingPages } = await import('./Library')
    prompt += '\n' + sourcePrompt(context, await extractReadingPages(context))
  } else {
    prompt += '\nNo PDF source is selected. For questions about reading, ask the student to open their PDF in the library first. Do not guess its contents.'
  }
  return prompt
}

// ── AI call ────────────────────────────────────────────────────
async function callAI(msgs:Msg[],sys:string,onChunk:(t:string)=>void,onDone:()=>void,onErr:(e:string)=>void, signal: AbortSignal) {
  try {
    const res=await aiFetch(API_URL + '/api/chat',{
      method:'POST',signal: AbortSignal.any([signal, AbortSignal.timeout(90000)]),headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'openrouter/auto',max_tokens:1024,system:sys,messages:msgs.slice(-16).map(m=>({role:m.role,content:m.content}))})
    })
    const data=await res.json().catch(()=>({detail:'The AI server could not complete your request. Please try again shortly.'}))
    if(!res.ok){
      const msg = data.detail ?? data.error?.message ?? 'AI backend error.'
      onErr(String(msg).match(/user not found|authentication|401/i) ? 'AI key is not working. Please update the OpenRouter key.' : String(msg))
      return
    }
    if(data.error){onErr(data.error.message?.match(/credit|billing|quota/i)?'API limit reached.':data.error.message);return}
    const text=data.choices?.[0]?.message?.content ?? (data.content??[]).map((c:any)=>c.text??'').join('')
    if(!text.trim()){onErr('AI returned an empty response.');return}
    if (signal.aborted) return
    onChunk(text)
    onDone()
  } catch(e:any){if(signal.aborted)return;onErr(e?.name==='TimeoutError'?'The AI server took too long to respond. Please try again.':e?.message?.includes('fetch')?'Could not reach the AI server. Check your connection and try again shortly.':`Error: ${e?.message}`)}
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
  useEffect(() => () => { ref.current?.abort(); if(ref.current) { ref.current.onresult=null; ref.current.onerror=null; ref.current.onend=null } }, [])
  return {listening:on,toggle}
}

// ── Bubble ─────────────────────────────────────────────────────
function Bubble({msg,streaming}:{msg:Msg;streaming?:boolean}) {
  const isUser=msg.role==='user'
  return (
    <div className="chat-bubble-row" style={{display:'flex',justifyContent:isUser?'flex-end':'flex-start',marginBottom:14,gap:8,alignItems:'flex-start'}}>
      {!isUser&&<div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}>
        <Icon name="ask" size={11} />
      </div>}
      <div className="chat-bubble" style={{maxWidth:'min(88%, 820px)',minWidth:0,padding:'12px 16px',fontSize:14,color:'var(--text-1)',fontWeight:300,borderRadius:isUser?'18px 4px 18px 18px':'4px 18px 18px 18px',background:isUser?'var(--accent-soft)':'var(--bg-card)',border:`0.5px solid ${isUser?'var(--border-active)':'var(--border)'}`}}>
        <MessageContent text={msg.content}/>
      </div>
      {!isUser&&!streaming&&(
        <button className="capability-hover-1"  onClick={()=>speak(msg.content)} aria-label="Read answer aloud" title="Read aloud" style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',padding:4,display:'flex',alignItems:'center',marginTop:6,flexShrink:0,transition:'color .2s'}}
           >
          <Icon name="speaker" size={13} />
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
      <button onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px',borderRadius:999,border:`0.5px solid ${open?'var(--border-active)':'var(--border)'}`,background:open?'var(--accent-soft)':'var(--bg-card)',color:open?'var(--accent)':'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
        <Icon name="memory" size={11} />
        {mem.facts.length}
      </button>
      {open&&(
        <div style={{position:'absolute',top:'100%',right:0,marginTop:6,width:260,background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:14,padding:'12px 14px',boxShadow:'0 8px 24px rgba(0,0,0,.18)',backdropFilter:'blur(16px)',zIndex:50,animation:'scaleIn .2s var(--ease-out) both'}}>
          <div style={{fontSize:10,letterSpacing:'2px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:10}}>What I remember</div>
          {mem.facts.map((f,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:7}}>
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


const MessageList = memo(function MessageList({messages,streaming,streamId}:{messages:Msg[];streaming:boolean;streamId:string|null}) {
  return <>{messages.map(msg=><WindowItem key={msg.id} enabled={messages.length>40}><Bubble msg={msg} streaming={streaming&&msg.id===streamId}/></WindowItem>)}</>
})
function ChatComposer({initial,onSend,streaming,draftKey}:{initial:string;onSend:(text:string)=>Promise<boolean>;streaming:boolean;draftKey:string}) {
  const [input,setInput]=useState(()=>{try{return sessionStorage.getItem(draftKey)??initial}catch{return initial}})
  const inputRef=useRef<HTMLTextAreaElement>(null)
  const submit=async (text=input)=>{if(await onSend(text)){setInput('');try{sessionStorage.removeItem(draftKey)}catch{ /* storage unavailable */ }}}
  const {listening,toggle:toggleVoice}=useVoice(text=>{setInput(text);void submit(text)})
  useEffect(()=>{if(matchMedia('(hover:hover) and (pointer:fine)').matches)inputRef.current?.focus()},[])
  const change=(value:string)=>{setInput(value);try{sessionStorage.setItem(draftKey,value)}catch{ /* storage unavailable */ }}
  return (<div className="chat-composer" style={{borderTop:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(16px)',flexShrink:0,padding:'12px clamp(14px,3vw,36px)'}}>
            <div style={{display:'flex',gap:8,alignItems:'flex-end',maxWidth:720,margin:'0 auto'}}>
              <button aria-label={listening?'Stop voice input':'Start voice input'} onClick={toggleVoice} title={listening?'Stop':'Speak'} style={{width:40,height:40,flexShrink:0,borderRadius:'50%',border:`1px solid ${listening?'var(--border-active)':'var(--border)'}`,background:listening?'var(--accent-soft)':'var(--bg-card)',color:listening?'var(--accent)':'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s'}}>
                <Icon name="microphone" size={14} />
              </button>
              <textarea aria-label="Ask a study question" ref={inputRef} value={input} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder={listening?'Listening…':'Ask a question…'} rows={1} disabled={streaming||listening} style={{flex:1,minHeight:40,maxHeight:120,resize:'none',fontSize:14,fontWeight:300,borderRadius:12,padding:'10px 14px',lineHeight:1.5}}/>
              <button aria-label="Send question" onClick={()=>submit()} disabled={!input.trim()||streaming} style={{width:40,height:40,flexShrink:0,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',cursor:(!input.trim()||streaming)?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px var(--accent-glow)',opacity:(!input.trim()||streaming)?0.4:1,transition:'all .2s'}}>
                <Icon name="send" size={14} />
              </button>
            </div>
          </div>)
}

// ── Main ───────────────────────────────────────────────────────
export default function Chat({material}:{material:any}) {
  const {user}=useUser()
  const [sessions, setSessions] = useState<Sess[]>(loadS)
  const [restoredSession] = useState(()=>material?.question ? undefined : loadS().find(s=>s.id===sessionStorage.getItem('shh_active_chat')))
  const [activeId, setActiveId] = useState<string|null>(restoredSession?.id??null)
  const [messages, setMessages] = useState<Msg[]>(restoredSession?.messages??[])
  const [streaming,setStreaming]= useState(false)
  const [streamId, setStreamId] = useState<string|null>(null)
  const [error,    setError]    = useState<string|null>(null)
  const [showHist, setShowHist] = useState(false)
  const [curVibe,  setCurVibe]  = useState(()=>getProf().vibe??'balanced')
  const [thinking, setThinking] = useState(false)
  const [readingContext,setReadingContext]=useState<ReadingContext | null>(()=>restoredSession?.readingContext ?? getReadCtx() ?? (material?.book ? {bookId:material.book.id,title:material.book.title,currentPage:material.book.currentPage,totalPages:material.book.totalPages,fromPage:material?.recap?.fromPage ?? material.book.currentPage,toPage:material?.recap?.toPage ?? material.book.currentPage} : null))
  const initialContext = readingContext
  const [fromPage,setFromPage] = useState<number>(()=>initialContext?.fromPage ?? material?.recap?.fromPage ?? initialContext?.currentPage ?? 1)
  const [toPage,setToPage] = useState<number>(()=>initialContext?.toPage ?? material?.recap?.toPage ?? initialContext?.currentPage ?? 1)
  const [sourcePreview,setSourcePreview] = useState<{key:string;pages:SourcePage[]}>({key:'',pages:[]})
  const sourceKey = readingContext ? `${readingContext.bookId}:${fromPage}:${toPage}` : ''
  const sourcePages = sourcePreview.key === sourceKey ? sourcePreview.pages : []
  useEffect(() => {
    let cancelled=false
    if(!readingContext || !Number.isInteger(fromPage) || !Number.isInteger(toPage) || fromPage<1 || toPage<fromPage || toPage>readingContext.totalPages || toPage-fromPage>=20) return
    const previewTimer=setTimeout(()=>{void extractReadingPages({...readingContext,fromPage,toPage}).then(pages=>{if(!cancelled)setSourcePreview({key:sourceKey,pages})}).catch(()=>{if(!cancelled)setSourcePreview({key:sourceKey,pages:[]})})},180)
    return ()=>{cancelled=true;clearTimeout(previewTimer)}
  }, [readingContext,fromPage,toPage,sourceKey])
  const pending = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(()=>()=>{ controller.current?.abort(); window.speechSynthesis?.cancel() },[])
  const t0 = useRef<number>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null), historyRef = useRef<HTMLDivElement>(null)
  const [contextOpen,setContextOpen]=useState(false)
  useModalFocus(sheetRef,contextOpen,()=>setContextOpen(false))
  useModalFocus(historyRef,showHist,()=>setShowHist(false))

  useEffect(()=>{
    t0.current=Date.now()
    if(user) recordStudyDay(user.id).catch(()=>{})
    return ()=>{const s=Math.round((Date.now()-t0.current)/1000);if(s>10)addTime(s)}
  },[])
  useEffect(()=>{if(!material?.question)return;const id=setTimeout(()=>sendMsg(material.question),400);return()=>clearTimeout(id)},[])
  useEffect(()=>{const el=messagesRef.current;if(el)el.scrollTop=messages.length?el.scrollHeight:0},[messages,thinking])
  useEffect(()=>{const vv=visualViewport;let frame=0;const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const el=messagesRef.current;if(el)el.scrollTop=el.scrollHeight})};vv?.addEventListener('resize',resize,{passive:true});return()=>{vv?.removeEventListener('resize',resize);cancelAnimationFrame(frame)}},[])
  useEffect(()=>{saveS(sessions)},[sessions])
  useEffect(()=>{if(activeId)sessionStorage.setItem('shh_active_chat',activeId);else sessionStorage.removeItem('shh_active_chat')},[activeId])
  useEffect(()=>{const sync=()=>setCurVibe(getProf().vibe??'balanced');window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[])

  const badge=BADGES[curVibe]??BADGES.balanced, cfg=VIBES[curVibe]??VIBES.balanced, p=getProf()
  const rc=readingContext
  const newS=():Sess=>({id:Date.now().toString(),title:rc?`Chat — ${rc.title}`:'New chat',messages:[],createdAt:Date.now(),bookCtx:rc?.title,vibe:curVibe,readingContext:rc ? {...rc,fromPage,toPage} : null})

  const sendMsg=async(text:string)=>{
    const content=text.trim(); if(!content||pending.current) return false
    pending.current=true; setStreaming(true);setThinking(true)
    controller.current=new AbortController()
    let sys:string
    try { sys=await buildSys(readingContext,fromPage,toPage) } catch(error) {
      setError(error instanceof Error ? error.message : 'Could not read the selected pages.');setStreaming(false);setThinking(false);pending.current=false;return false
    }
    if(controller.current.signal.aborted){pending.current=false;return false}
    setError(null)
    const userMsg:Msg={id:Date.now().toString(),role:'user',content,ts:Date.now()}
    const updated=[...messages,userMsg]; setMessages(updated)
    let sid=activeId
    if(!sid){const s=newS();s.messages=updated;setSessions(p=>[s,...p]);setActiveId(s.id);sid=s.id}
    setSessions(prev=>prev.map(s=>s.id===sid?{...s,messages:updated}:s))
    const aiId=(Date.now()+1).toString(), aiMsg:Msg={id:aiId,role:'assistant',content:'',ts:Date.now()}
    setMessages(m=>[...m,aiMsg]); setStreaming(true); setStreamId(aiId); setThinking(true)
    let full=''
    void callAI(updated,sys,
      chunk=>{
        full+=chunk
        setThinking(false)
        setMessages(m=>m.map(x=>x.id===aiId?{...x,content:full}:x))
      },
      ()=>{
        setStreaming(false);setStreamId(null);setThinking(false)
        const fin=[...updated,{...aiMsg,content:full}];setMessages(fin)
        setSessions(prev=>prev.map(s=>s.id===sid?{...s,messages:fin,title:content.slice(0,40),readingContext:rc ? {...rc,fromPage,toPage} : null}:s))
        pending.current=false
      },
      err=>{pending.current=false;setStreaming(false);setStreamId(null);setThinking(false);setError(err);setMessages(m=>m.filter(x=>x.id!==aiId))},
      controller.current.signal
    )
    return true
  }

  const sendRef=useRef(sendMsg)
  useEffect(()=>{sendRef.current=sendMsg})
  const submitMessage=useCallback((text:string)=>sendRef.current(text),[])
  const isEmpty=messages.length===0

  const contextContents = <>
{rc && <div className="reading-range">
        <span>PDF pages</span>
        <label>From <span className="chat-page-stepper"><button aria-label="Decrease first PDF page" disabled={streaming||fromPage<=1} onClick={()=>setFromPage(p=>Math.max(1,p-1))}>−</button><input aria-label="First PDF page" inputMode="numeric" type="number" min={1} max={rc.totalPages} value={Number.isNaN(fromPage)?'':fromPage} disabled={streaming} onChange={e=>setFromPage(e.target.valueAsNumber)}/><button aria-label="Increase first PDF page" disabled={streaming||fromPage>=rc.totalPages} onClick={()=>setFromPage(p=>Math.min(rc.totalPages,p+1))}>+</button></span></label>
        <label>To <span className="chat-page-stepper"><button aria-label="Decrease last PDF page" disabled={streaming||toPage<=fromPage} onClick={()=>setToPage(p=>Math.max(fromPage,p-1))}>−</button><input aria-label="Last PDF page" inputMode="numeric" type="number" min={fromPage} max={rc.totalPages} value={Number.isNaN(toPage)?'':toPage} disabled={streaming} onChange={e=>setToPage(e.target.valueAsNumber)}/><button aria-label="Increase last PDF page" disabled={streaming||toPage>=rc.totalPages} onClick={()=>setToPage(p=>Math.min(rc.totalPages,p+1))}>+</button></span></label>
        <span className="reading-range-note">Only this selection is sent to the AI provider. Page numbers refer to the PDF.</span>
      </div>}

      {rc && sourcePages.length>0 && <details className="chat-sources"><summary>Selected source · PDF pages {fromPage}–{toPage}</summary><div>{sourcePages.filter(p=>p.page>=fromPage&&p.page<=toPage).map(p=><article key={p.page}><span className="source-page">Page {p.page}</span><p>{p.text.slice(0,500)}{p.text.length>500?'…':''}</p></article>)}</div></details>}
  </>
  return (
    <section className="chat-page" style={{display:'flex',flexDirection:'column',flex:1,minHeight:0,overflow:'hidden'}}>

      {/* Topbar */}
      <div className="chat-header" style={{display:'flex',alignItems:'center',gap:8,padding:'11px clamp(14px,3vw,32px)',borderBottom:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(12px)',flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <h1 className="page-title">Ask <em className="title-accent">AI.</em></h1>
          {rc&&<div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)',flexShrink:0}}/>
            <span style={{fontSize:10,color:'var(--accent)',fontWeight:500}}>{rc.title} · PDF pages {fromPage}–{toPage}</span>
          </div>}
        </div>
        <button className="chat-context-chip" onClick={()=>setContextOpen(true)}>{rc?`PDF p.${fromPage}-${toPage}`:'No PDF'}</button>
        <button className="chat-options-button" aria-label="Chat options" onClick={()=>setContextOpen(true)}>···</button>
        <div className="chat-desktop-actions">
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 10px',borderRadius:999,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:11,color:badge.color,flexShrink:0}}>
          <Icon name="ask" size={15} /><span style={{fontWeight:500}}>{badge.label}</span>
        </div>
        <MemBadge/>
        <button onClick={()=>setShowHist(h=>!h)} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 11px',borderRadius:999,border:`0.5px solid ${showHist?'var(--border-active)':'var(--border)'}`,background:showHist?'var(--accent-soft)':'var(--bg-card)',color:showHist?'var(--accent)':'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',flexShrink:0,transition:'all .18s'}}>
          <Icon name="focus" size={11} /> History
        </button>
        <button disabled={streaming} onClick={()=>{const live=getReadCtx();setReadingContext(live);setFromPage(live?.fromPage??live?.currentPage??1);setToPage(live?.toPage??live?.currentPage??1);const s=newS();s.readingContext=live;setSessions(p=>[s,...p]);setActiveId(s.id);setMessages([]);setError(null)}} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 11px',borderRadius:999,border:'0.5px solid var(--border)',background:'var(--bg-card)',color:'var(--text-2)',fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',flexShrink:0,transition:'all .18s'}}>
          <Icon name="plus" size={11} /> New
        </button>
        </div>
      </div>

      <div className="chat-context-desktop">{contextContents}</div>
      {contextOpen&&createPortal(<div className="chat-context-scrim" onClick={()=>setContextOpen(false)}><div ref={sheetRef} role="dialog" aria-modal="true" aria-label="Chat context and options" className="chat-context-sheet" onClick={e=>e.stopPropagation()}><div className="reader-panel-heading"><h2>Context & options</h2><button aria-label="Close chat context" onClick={()=>setContextOpen(false)}><Icon name="close" size={16}/></button></div><div className="chat-sheet-actions"><button onClick={()=>{setContextOpen(false);window.dispatchEvent(new CustomEvent('shh:goto',{detail:'settings'}))}}>{badge.label} style</button><button onClick={()=>{setContextOpen(false);setShowHist(true)}}>History</button><button disabled={streaming} onClick={()=>{const live=getReadCtx();setReadingContext(live);setFromPage(live?.fromPage??live?.currentPage??1);setToPage(live?.toPage??live?.currentPage??1);setActiveId(null);setMessages([]);setError(null);setContextOpen(false)}}>New chat</button></div>{rc?<><p>{rc.title}</p>{contextContents}</>:<p>Open a PDF in Library to select pages. Only selected text is sent to the AI provider.</p>}</div></div>,document.body)}
      {/* Body */}
      <div style={{display:'flex',flex:1,minHeight:0,overflow:'hidden'}}>
        {showHist&&(
          <div ref={historyRef} role="dialog" aria-label="Chat history" className="chat-history" style={{width:240,borderRight:'0.5px solid var(--border)',background:'var(--bg-card)',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
            <div style={{padding:'12px 16px 6px',fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)'}}>Recent chats <button aria-label="Close chat history" onClick={()=>setShowHist(false)}>×</button></div>
            <div style={{flex:1,overflowY:'auto',padding:'0 8px 80px'}}>
              {!sessions.length&&<p style={{fontSize:12,color:'var(--text-3)',textAlign:'center',padding:'20px 8px'}}>No chats yet.</p>}
              {sessions.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <button disabled={streaming} onClick={()=>{setActiveId(s.id);setMessages(s.messages);setReadingContext(s.readingContext??null);setFromPage(s.readingContext?.fromPage??1);setToPage(s.readingContext?.toPage??1);setShowHist(false)}} style={{flex:1,padding:'10px 12px',borderRadius:10,background:activeId===s.id?'var(--accent-soft)':'transparent',border:`0.5px solid ${activeId===s.id?'var(--border-active)':'transparent'}`,textAlign:'left',cursor:'pointer',transition:'all .18s',fontFamily:'var(--font-body)',minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.title}</div>
                    <div style={{fontSize:11,color:'var(--text-3)',marginTop:2,display:'flex',gap:8}}>
                      <span>{s.messages.length} msgs</span>
                      {s.vibe&&<span style={{color:BADGES[s.vibe]?.color}}>{BADGES[s.vibe]?.label}</span>}
                    </div>
                  </button>
                  <button className="capability-hover-2"  onClick={()=>{
                    setSessions(p=>p.filter(x=>x.id!==s.id))
                    if(activeId===s.id){setActiveId(null);setMessages([])}
                  }} title="Delete" style={{width:26,height:26,borderRadius:8,border:'none',background:'transparent',color:'var(--text-3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .18s'}}

                    >
                    <Icon name="trash" size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,minWidth:0}}>
          <div ref={messagesRef} className="chat-messages" style={{flex:1,overflowY:'auto',padding:'20px clamp(14px,3vw,36px) 8px'}}>
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
                        {q}<Icon name="chevron" size={13} style={{flexShrink:0,color:'var(--accent)'}} />
                      </button>
                    ))}
                  </div>
                )}
                {!material?.recap&&(
                  <div className="chat-quick-chips" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {cfg.starts.map((s,i)=>(
                      <button key={i} onClick={()=>sendMsg(s)} style={{padding:'11px 13px',borderRadius:12,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:13,color:'var(--text-2)',lineHeight:1.45,textAlign:'left',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:300,transition:'all .18s'}}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <MessageList messages={messages} streaming={streaming} streamId={streamId}/>
            {error&&(
              <div style={{margin:'12px 0',padding:'12px 16px',borderRadius:12,background:'rgba(239,68,68,.08)',border:'0.5px solid rgba(239,68,68,.2)',fontSize:13,color:'#fca5a5',lineHeight:1.6}}>
                {error}<button onClick={()=>setError(null)} style={{display:'block',marginTop:8,fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'var(--font-body)'}}>Dismiss</button>
              </div>
            )}
            {thinking&&(
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,animation:'fadeUp .2s var(--ease-out) both'}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon name="ask" size={11} />
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderRadius:'4px 18px 18px 18px',background:'var(--bg-card)',border:'0.5px solid var(--border)'}}>
                  {[0,1,2].map(i=>(
                    <div key={i} style={{width:6,height:6,borderRadius:'50%',background:'var(--text-3)',animation:'pulse 1.2s ease-in-out infinite',animationDelay:`${i*0.2}s`}}/>
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{height:1}}/>
          </div>

          <ChatComposer initial={material?.question??''} onSend={submitMessage} streaming={streaming} draftKey="shh_chat_draft"/>
        </div>
      </div>
    </section>
  )
}
