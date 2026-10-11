import { useState, useEffect, useRef, useCallback } from 'react'
import type { Page } from '../App'

// ── Types ─────────────────────────────────────────────────────
interface Book {
  id: string; title: string; author: string
  totalPages: number; currentPage: number
  coverGradient: string; addedAt: number
}
interface Note { id: string; bookId: string; page: number; text: string; createdAt: number }
interface RecapData { bookId: string; fromPage: number; toPage: number; summary: string[]; questions: string[] }
type LibView     = 'shelf' | 'reader' | 'recap'
type ShelfFilter = 'all' | 'progress' | 'finished'
type ToastKind   = 'success' | 'error' | 'loading'

const GRADIENTS = [
  'linear-gradient(135deg,#3b4a8a,#5b3fa0)',
  'linear-gradient(135deg,#1a4a3a,#2d7a5a)',
  'linear-gradient(135deg,#6b2a1a,#a04a2a)',
  'linear-gradient(135deg,#2a3a6b,#1a5a8a)',
  'linear-gradient(135deg,#5a2a6b,#8a3a5a)',
  'linear-gradient(135deg,#1a3a1a,#3a6b2a)',
  'linear-gradient(135deg,#6b5a1a,#a08a2a)',
]

// ── Storage ───────────────────────────────────────────────────
const loadBooks = (): Book[] => { try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] } }
const saveBooks = (b: Book[]) => { try { localStorage.setItem('shh_books', JSON.stringify(b)) } catch {} }
const loadNotes = (): Note[] => { try { return JSON.parse(localStorage.getItem('shh_notes') ?? '[]') } catch { return [] } }
const saveNotes = (n: Note[]) => { try { localStorage.setItem('shh_notes', JSON.stringify(n)) } catch {} }

// ── IndexedDB ─────────────────────────────────────────────────
const DB = 'shh_pdf_db'; const ST = 'pdfs'
function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(ST)) req.result.createObjectStore(ST) }
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error)
  })
}
async function savePdf(id: string, buf: ArrayBuffer) {
  const db = await openDb(); const tx = db.transaction(ST,'readwrite')
  tx.objectStore(ST).put(buf, id)
  return new Promise<void>((res,rej) => { tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error) })
}
async function loadPdf(id: string): Promise<ArrayBuffer|null> {
  const db = await openDb(); const tx = db.transaction(ST,'readonly')
  const req = tx.objectStore(ST).get(id)
  return new Promise((res,rej) => { req.onsuccess=()=>res(req.result??null); req.onerror=()=>rej(req.error) })
}
async function deletePdf(id: string) {
  const db = await openDb(); const tx = db.transaction(ST,'readwrite'); tx.objectStore(ST).delete(id)
}

// ── pdf.js loader ─────────────────────────────────────────────
let _pdfjs: Promise<any>|null = null
function ensurePdfjs(): Promise<any> {
  if (_pdfjs) return _pdfjs
  _pdfjs = new Promise((res,rej) => {
    if ((window as any).pdfjsLib) { res((window as any).pdfjsLib); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      const lib = (window as any).pdfjsLib
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      res(lib)
    }
    s.onerror = rej; document.head.appendChild(s)
  })
  return _pdfjs
}

// ── Module-level PDF document cache ──────────────────────────
// Keyed by book ID so document never reloads on page turn
const _docCache = new Map<string, any>()

// ── PDF page renderer — stable, no reload on page change ──────
function PdfPage({ bookId, buf, pageNum, scale = 1.4, onLoad }: {
  bookId: string; buf: ArrayBuffer; pageNum: number; scale?: number; onLoad?: (n: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const taskRef   = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const lib = await ensurePdfjs()
        // Reuse cached doc — never reload for same book
        if (!_docCache.has(bookId)) {
          const doc = await lib.getDocument({ data: buf.slice(0) }).promise
          _docCache.set(bookId, doc)
          onLoad?.(doc.numPages)
        }
        const doc = _docCache.get(bookId)
        if (cancelled) return
        // Always call onLoad so totalPages stays in sync even on cache hit
        onLoad?.(doc.numPages)

        const pg = await doc.getPage(Math.max(1, Math.min(pageNum, doc.numPages)))
        if (cancelled) return

        const vp = pg.getViewport({ scale })
        const cv = canvasRef.current
        if (!cv) return
        cv.width = vp.width; cv.height = vp.height
        taskRef.current?.cancel()
        taskRef.current = pg.render({ canvasContext: cv.getContext('2d')!, viewport: vp })
        await taskRef.current.promise
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') console.warn('PDF render:', e)
      }
    })()
    return () => { cancelled = true; taskRef.current?.cancel() }
  }, [bookId, pageNum, scale]) // buf intentionally excluded — use cached doc

  return (
    <canvas ref={canvasRef} style={{
      maxWidth: '100%', borderRadius: 8,
      boxShadow: '0 4px 32px rgba(0,0,0,0.14)',
      display: 'block', margin: '0 auto',
    }} />
  )
}

// ── Ebook page — text extraction with image detection ─────────
function EbookPage({ bookId, buf, pageNum, totalPages, onLoad }: {
  bookId: string; buf: ArrayBuffer; pageNum: number; totalPages: number; onLoad?: (n: number) => void
}) {
  void totalPages
  const [items,    setItems]    = useState<{text:string;heading:boolean}[]>([])
  const [loading,  setLoading]  = useState(true)
  const [hasImages, setHasImages] = useState(false)

  // Highlight → card state
  const [sel,      setSel]      = useState<{text:string;x:number;y:number}|null>(null)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const lib = await ensurePdfjs()
        if (!_docCache.has(bookId)) {
          const doc = await lib.getDocument({ data: buf.slice(0) }).promise
          _docCache.set(bookId, doc)
          onLoad?.(doc.numPages)
        }
        const doc = _docCache.get(bookId)
        // Always report page count, even from cache
        if (!cancelled) onLoad?.(doc.numPages)

        const pg  = await doc.getPage(Math.max(1, Math.min(pageNum, doc.numPages)))
        if (cancelled) return

        const ct  = await pg.getTextContent()
        if (cancelled) return

        // Detect image-heavy pages (few text chars but has ops)
        const ops = await pg.getOperatorList()
        const imgCount = ops.fnArray.filter((f: number) => f === (window as any).pdfjsLib?.OPS?.paintImageXObject || f === 85 || f === 86).length
        const charCount = ct.items.reduce((s: number, it: any) => s + (it.str?.length ?? 0), 0)
        if (imgCount > 0 && charCount < 100) { setHasImages(true); setLoading(false); return }
        setHasImages(false)

        // Group by Y coordinate
        const lineMap = new Map<number, string[]>()
        ct.items.forEach((it: any) => {
          const y = Math.round(it.transform?.[5] ?? 0)
          if (!lineMap.has(y)) lineMap.set(y, [])
          if (it.str?.trim()) lineMap.get(y)!.push(it.str)
        })
        const lines = Array.from(lineMap.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([, ws]) => ws.join(' ').trim())
          .filter(l => l.length > 1)

        // Merge into paragraphs
        const result: {text:string;heading:boolean}[] = []
        let buf2 = ''
        for (const line of lines) {
          const isAllCaps = line.toUpperCase() === line && line.replace(/[^A-Z]/g,'').length > 2
          const hasPunct  = /[.!?,;:]$/.test(line)
          if (isAllCaps) {
            if (buf2.trim()) { result.push({text:buf2.trim(),heading:false}); buf2='' }
            result.push({text:line,heading:true})
          } else {
            buf2 += (buf2?'  ':'')+line
            if (hasPunct || (line.length < 65 && buf2.length > 80)) {
              result.push({text:buf2.trim(),heading:false}); buf2=''
            }
          }
        }
        if (buf2.trim()) result.push({text:buf2.trim(),heading:false})

        if (!cancelled) { setItems(result); setLoading(false) }
      } catch { if (!cancelled) { setItems([{text:'Could not extract text. Switch to PDF view.',heading:false}]); setLoading(false) } }
    })()
    return () => { cancelled = true }
  }, [bookId, pageNum])

  const handleMouseUp = () => {
    const s = window.getSelection(); const text = s?.toString().trim()
    if (!text || text.length < 8) { setSel(null); return }
    const rect = s?.getRangeAt(0)?.getBoundingClientRect()
    if (rect) setSel({ text, x: rect.left + rect.width/2, y: rect.top - 8 })
  }

  const saveCard = () => {
    if (!sel) return
    const card = {
      id: `hl_${Date.now()}`, bookId, bookTitle: '',
      front: `What does this mean? "${sel.text.slice(0,80)}${sel.text.length>80?'…':''}"`,
      back: sel.text, fromPage: pageNum, toPage: pageNum,
      difficulty: null, createdAt: Date.now(), nextReview: 0, interval: 1, reviewCount: 0,
    }
    try {
      const ex = JSON.parse(localStorage.getItem('shh_flashcards')?? '[]')
      localStorage.setItem('shh_flashcards', JSON.stringify([...ex, card]))
    } catch {}
    setSaved(true)
    setTimeout(() => { setSel(null); setSaved(false); window.getSelection()?.removeAllRanges() }, 1200)
  }

  const isTwoCol = typeof window !== 'undefined' && window.innerWidth >= 900

  // Image-heavy page — show notice above the text (don't block)
  // Images can't be rendered in text extraction mode; user can switch to PDF view

  return (
    <div
      style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', padding:'clamp(12px,2.5vh,32px) 0 clamp(8px,1.5vh,20px)', userSelect:'text', overflowY:'auto' }}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
    >
      {/* Selection popup */}
      {sel && (
        <div style={{
          position:'fixed', left:Math.min(sel.x, window.innerWidth-180), top:sel.y,
          transform:'translate(-50%,-100%)', zIndex:200,
          background:'var(--bg-card)', border:'0.5px solid var(--border-active)', borderRadius:999,
          padding:'7px 14px', display:'flex', alignItems:'center', gap:8,
          boxShadow:'0 8px 24px rgba(0,0,0,.25)', backdropFilter:'blur(16px)',
          animation:'toastIn .2s ease both',
        }}>
          {saved ? (
            <span style={{fontSize:12,color:'var(--green)',fontFamily:'var(--font-body)',fontWeight:500}}>✓ Card saved!</span>
          ) : (
            <>
              <button onClick={saveCard} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:500,padding:0}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                Add flashcard
              </button>
              <button onClick={()=>setSel(null)} style={{fontSize:11,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',padding:0}}>✕</button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',fontSize:13}}>Extracting text…</div>
      ) : (
        <>
          {/* Image page banner — shown when page has images (figures, diagrams) */}
          {hasImages && items.length === 0 ? (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:'32px 24px'}}>
              <div style={{width:52,height:52,borderRadius:14,background:'rgba(245,158,11,.1)',border:'0.5px solid rgba(245,158,11,.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:500,color:'var(--text-1)',marginBottom:6}}>Image-based page</div>
                <div style={{fontSize:12,color:'var(--text-3)',fontWeight:300,maxWidth:280,lineHeight:1.6}}>This page contains figures or diagrams. Switch to <strong style={{fontWeight:500,color:'var(--accent)'}}>PDF view</strong> to see them.</div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10}}>
              <p style={{color:'var(--text-3)',fontSize:13}}>No readable text. Switch to PDF view.</p>
            </div>
          ) : (
            <>
              {hasImages && (
                <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px clamp(16px,3.5vw,52px)',background:'rgba(245,158,11,.07)',borderBottom:'0.5px solid rgba(245,158,11,.18)',flexShrink:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style={{fontSize:11,color:'var(--amber)',fontWeight:300}}>Page has figures — switch to PDF view to see images alongside this text</span>
                </div>
              )}
              <div style={{
                flex:1, overflow:'hidden',
                columnCount: isTwoCol ? 2 : 1,
                columnGap: 'clamp(28px,4vw,56px)',
                columnRule: '0.5px solid var(--border)',
                padding: '0 clamp(16px,3.5vw,52px)',
              }}>
                {items.map((it,i) => it.heading ? (
                  <h2 key={i} style={{fontFamily:'var(--font-display)',fontSize:'clamp(14px,1.7vw,19px)',fontWeight:500,color:'var(--text-1)',margin:'1.5em 0 0.5em',lineHeight:1.3,letterSpacing:'-0.2px',breakAfter:'avoid',columnSpan:'all'}}>{it.text}</h2>
                ) : (
                  <p key={i} style={{fontFamily:"Georgia,'Times New Roman',serif",fontSize:'clamp(14px,1.5vw,17px)',lineHeight:1.85,color:'var(--text-1)',marginBottom:'0.8em',textAlign:'justify',opacity:0.9,breakInside:'avoid',cursor:'text'}}>{it.text}</p>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ kind, msg }: { kind: ToastKind; msg: string }) {
  const C = { success:{bg:'rgba(52,211,153,.13)',border:'rgba(52,211,153,.3)',dot:'#34d399'}, error:{bg:'rgba(239,68,68,.1)',border:'rgba(239,68,68,.25)',dot:'#f87171'}, loading:{bg:'var(--bg-card)',border:'var(--border)',dot:'var(--accent)'} }[kind]
  return (
    <div style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',zIndex:300,display:'flex',alignItems:'center',gap:10,padding:'11px 18px',borderRadius:999,background:C.bg,border:`1px solid ${C.border}`,backdropFilter:'blur(20px)',fontSize:13,color:'var(--text-1)',fontFamily:'var(--font-body)',whiteSpace:'nowrap',boxShadow:'0 8px 24px rgba(0,0,0,.16)',animation:'toastIn .3s cubic-bezier(.34,1.56,.64,1) both'}}>
      <div style={{width:7,height:7,borderRadius:'50%',background:C.dot,flexShrink:0,animation:kind==='loading'?'pulse 1.4s ease-in-out infinite':'none'}}/>
      {msg}
    </div>
  )
}

// ── Notes panel ───────────────────────────────────────────────
function NotesPanel({ book, currentPage, onClose }: { book: Book; currentPage: number; onClose: () => void }) {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes().filter(n => n.bookId === book.id))
  const [draft, setDraft] = useState('')
  const add = () => {
    if (!draft.trim()) return
    const n: Note = {id:Date.now().toString(),bookId:book.id,page:currentPage,text:draft.trim(),createdAt:Date.now()}
    const all = [...loadNotes(),n]; saveNotes(all); setNotes(all.filter(x=>x.bookId===book.id)); setDraft('')
  }
  const del = (id: string) => { const all=loadNotes().filter(n=>n.id!==id); saveNotes(all); setNotes(all.filter(n=>n.bookId===book.id)) }
  return (
    <div style={{position:'absolute',top:0,right:0,bottom:0,width:280,background:'var(--bg-card)',borderLeft:'0.5px solid var(--border)',display:'flex',flexDirection:'column',zIndex:5}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'0.5px solid var(--border)'}}>
        <span style={{fontSize:13,fontWeight:500,color:'var(--text-1)'}}>Notes</span>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:14,display:'flex',flexDirection:'column',gap:10}}>
        <div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder={`Note for p.${currentPage}…`} style={{fontSize:13,minHeight:72,resize:'none',marginBottom:8}} rows={3}/>
          <button onClick={add} style={{width:'100%',padding:8,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',borderRadius:10,color:'var(--accent)',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)'}}>Save</button>
        </div>
        {[...notes].reverse().map(n => (
          <div key={n.id} style={{background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:10,padding:'10px 12px',position:'relative'}}>
            <div style={{fontSize:10,color:'var(--text-3)',letterSpacing:1,marginBottom:4}}>p.{n.page}</div>
            <div style={{fontSize:13,color:'var(--text-1)',lineHeight:1.5,fontWeight:300,paddingRight:18}}>{n.text}</div>
            <button onClick={()=>del(n.id)} style={{position:'absolute',top:8,right:8,background:'none',border:'none',cursor:'pointer',color:'var(--text-3)'}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── AI recap ──────────────────────────────────────────────────
async function generateRecap(book: Book, fromPage: number, toPage: number): Promise<RecapData> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{ role:'user', content:`The user read "${book.title}" by ${book.author}, pages ${fromPage}–${toPage} of ${book.totalPages}. Respond ONLY with JSON:\n{"summary":["point 1","point 2","point 3"],"questions":["question 1","question 2"]}` }] })
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    const p = JSON.parse((data.content??[]).map((c:any)=>c.text??'').join('').replace(/```json|```/g,'').trim())
    return {bookId:book.id,fromPage,toPage,summary:p.summary,questions:p.questions}
  } catch {
    return {bookId:book.id,fromPage,toPage,summary:[`You covered pages ${fromPage}–${toPage}.`,'Key ideas noted.','Keep going.'],questions:['What was the main idea?','How does it connect to what came before?']}
  }
}

// ── Book card with three-dot menu ─────────────────────────────
function BookCard({ book, hasPdf, onClick, onDelete }: { book: Book; hasPdf: boolean; onClick: () => void; onDelete: () => void }) {
  const pct  = book.totalPages > 0 ? Math.round(book.currentPage/book.totalPages*100) : 0
  const done = pct >= 100
  const [hov, setHov]   = useState(false)
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [menu])
  return (
    <div style={{position:'relative'}} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <button onClick={onClick} style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,overflow:'hidden',cursor:'pointer',textAlign:'left',width:'100%',transition:'all .22s',transform:hov?'translateY(-3px)':'none',boxShadow:hov?'0 10px 32px rgba(0,0,0,.1)':'none'}}>
        <div style={{height:110,background:book.coverGradient,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(255,255,255,.5)"><path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/></svg>
          <span style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,.25)',borderRadius:6,padding:'3px 7px',fontSize:10,color:'rgba(255,255,255,.9)',fontWeight:500}}>{pct}%</span>
          {!hasPdf && <span style={{position:'absolute',bottom:8,left:8,background:'rgba(0,0,0,.4)',borderRadius:6,padding:'2px 6px',fontSize:9,color:'rgba(255,255,255,.7)'}}>re-upload needed</span>}
        </div>
        <div style={{padding:'12px 14px 14px'}}>
          <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{book.title}</div>
          <div style={{fontSize:11,color:'var(--text-3)',marginBottom:10,fontWeight:300}}>{book.author}</div>
          <div style={{height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:done?'linear-gradient(90deg,#3ecfa0,#2aad82)':'linear-gradient(90deg,var(--accent),#b07ef7)',borderRadius:99,transition:'width .8s ease'}}/>
          </div>
        </div>
      </button>
      {/* Three-dot menu */}
      <div ref={menuRef} style={{position:'absolute',top:8,right:8,zIndex:10}}>
        <button onClick={e=>{e.stopPropagation();setMenu(m=>!m)}} style={{width:26,height:26,borderRadius:'50%',background:menu?'rgba(0,0,0,.45)':hov?'rgba(0,0,0,.3)':'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:hov||menu?1:0,transition:'all .18s',color:'white'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
        {menu && (
          <div style={{position:'absolute',top:30,right:0,background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:12,padding:'4px',minWidth:130,boxShadow:'0 8px 24px rgba(0,0,0,.2)',backdropFilter:'blur(16px)',zIndex:20}}>
            <button onClick={e=>{e.stopPropagation();setMenu(false);onClick()}} style={{width:'100%',padding:'9px 14px',borderRadius:8,background:'transparent',border:'none',textAlign:'left',fontSize:13,color:'var(--text-1)',cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',gap:8}} onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-pill)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>Open
            </button>
            <button onClick={e=>{e.stopPropagation();setMenu(false);onDelete()}} style={{width:'100%',padding:'9px 14px',borderRadius:8,background:'transparent',border:'none',textAlign:'left',fontSize:13,color:'#f87171',cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',gap:8}} onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,.08)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recap card ────────────────────────────────────────────────
function RecapCard({ recap, onClose, onAsk }: { recap: RecapData; onClose: () => void; onAsk: (q?: string) => void }) {
  return (
    <div style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
      <div style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:24,padding:36,maxWidth:500,width:'100%',maxHeight:'80vh',overflowY:'auto'}}>
        <div style={{fontSize:10,letterSpacing:'3px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>Session complete</div>
        <div style={{fontFamily:'var(--font-display)',fontSize:26,letterSpacing:'-0.5px',color:'var(--text-1)',marginBottom:24,lineHeight:1.2}}>You read pages {recap.fromPage}–{recap.toPage}</div>
        <div style={{fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:12}}>What you covered</div>
        {recap.summary.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:10}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'var(--accent)',marginTop:7,flexShrink:0}}/>
            <p style={{fontSize:13,color:'var(--text-2)',lineHeight:1.6,fontWeight:300}}>{s}</p>
          </div>
        ))}
        <div style={{fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',margin:'20px 0 12px'}}>Tap to ask the AI</div>
        {recap.questions.map((q,i)=>(
          <button key={i} onClick={()=>onAsk(q)} style={{width:'100%',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',borderRadius:12,padding:'12px 14px',marginBottom:8,fontSize:13,color:'var(--text-1)',lineHeight:1.55,fontWeight:300,textAlign:'left',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,fontFamily:'var(--font-body)',transition:'all .18s'}}>
            {q}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ))}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button onClick={onClose} style={{flex:1,padding:11,borderRadius:12,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-2)'}}>Back to shelf</button>
          <button onClick={()=>onAsk()} style={{flex:1,padding:11,borderRadius:12,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',background:'linear-gradient(135deg,var(--accent),#7b6cf6)',color:'white',border:'none',boxShadow:'0 4px 16px var(--accent-glow)'}}>Open AI chat →</button>
        </div>
      </div>
    </div>
  )
}

const tabStyle = (a:boolean): React.CSSProperties => ({padding:'5px 14px',borderRadius:999,fontSize:12,cursor:'pointer',border:'0.5px solid var(--border)',fontFamily:'var(--font-body)',background:a?'var(--bg-pill)':'transparent',color:a?'var(--text-1)':'var(--text-3)',transition:'all .18s'})

// ── Main Library ──────────────────────────────────────────────
export default function Library({ setMaterial, setPage }: { setMaterial:(m:any)=>void; setPage:(p:Page)=>void }) {
  const [books,setBooks]               = useState<Book[]>(loadBooks)
  const [pdfMap,setPdfMap]             = useState<Map<string,ArrayBuffer>>(new Map())
  const [view,setView]                 = useState<LibView>('shelf')
  const [filter,setFilter]             = useState<ShelfFilter>('all')
  const [activeBook,setActiveBook]     = useState<Book|null>(null)
  const [activeBuf,setActiveBuf]       = useState<ArrayBuffer|null>(null)
  const [currentPage,setCurrentPage]   = useState(1)
  const [totalPages,setTotalPages]     = useState(1)
  const [sessionStart,setSessionStart] = useState(1)
  const [showNotes,setShowNotes]       = useState(false)
  const [readerMode,setReaderMode]     = useState<'pdf'|'ebook'>('pdf')
  const [recap,setRecap]               = useState<RecapData|null>(null)
  const [recapLoading,setRecapLoading] = useState(false)
  const [dragging,setDragging]         = useState(false)
  const [toast,setToast]               = useState<{kind:ToastKind;msg:string}|null>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(()=>{ saveBooks(books) },[books])
  useEffect(()=>{
    if(activeBook) localStorage.setItem('shh_session',JSON.stringify({bookTitle:`${activeBook.title} — ${activeBook.author}`,page:currentPage,totalPages}))
  },[activeBook,currentPage,totalPages])
  useEffect(()=>{
    books.forEach(async b=>{
      const buf = await loadPdf(b.id)
      if(buf) setPdfMap(m=>{const n=new Map(m);n.set(b.id,buf);return n})
    })
  },[])

  // Keyboard navigation in reader
  useEffect(() => {
    if (view !== 'reader') return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); updatePage(currentPage + 1) }
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); updatePage(currentPage - 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, currentPage, totalPages, activeBook])

  const showToast = (kind:ToastKind, msg:string, ttl=3500) => {
    setToast({kind,msg})
    if(toastRef.current) clearTimeout(toastRef.current)
    if(ttl>0) toastRef.current=setTimeout(()=>setToast(null),ttl)
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    if (file.type !== 'application/pdf') { showToast('error','Please upload a PDF file'); return }
    showToast('loading',`Reading ${file.name}…`,0)
    try {
      const buf = await file.arrayBuffer()
      const lib = await ensurePdfjs()
      const pdf = await lib.getDocument({data:buf.slice(0)}).promise
      const numPages: number = pdf.numPages
      const raw = file.name.replace(/\.pdf$/i,'').replace(/_/g,' ')
      const parts = raw.split(/\s*[-–]\s*/)
      const title = parts[0]?.trim()||raw; const author = parts[1]?.trim()||'Unknown author'
      const id = Date.now().toString()
      const book: Book = {id,title,author,totalPages:numPages,currentPage:1,coverGradient:GRADIENTS[Math.floor(Math.random()*GRADIENTS.length)],addedAt:Date.now()}
      await savePdf(id,buf)
      setPdfMap(m=>{const n=new Map(m);n.set(id,buf);return n})
      setBooks(prev=>[...prev,book])
      if(toastRef.current) clearTimeout(toastRef.current)
      showToast('success',`"${title}" added — ${numPages} pages`)
    } catch(e) { console.error(e); showToast('error','Could not read this PDF. Try another file.') }
  },[])

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }

  const openBook = async (book: Book) => {
    let buf = pdfMap.get(book.id) ?? await loadPdf(book.id)
    if (!buf) { showToast('error','PDF not found — please re-upload this book'); return }
    if (!pdfMap.has(book.id)) setPdfMap(m=>{const n=new Map(m);n.set(book.id,buf!);return n})
    setActiveBook(book); setActiveBuf(buf)
    setCurrentPage(book.currentPage||1)
    setSessionStart(book.currentPage||1)
    setTotalPages(book.totalPages||1)
    ;(window as any).__shh_readStart = Date.now()
    setView('reader'); setShowNotes(false)
    // Store current reading context for Chat
    localStorage.setItem('shh_reading_ctx', JSON.stringify({
      bookId: book.id, title: book.title, author: book.author,
      currentPage: book.currentPage||1, totalPages: book.totalPages||1,
    }))
  }

  const updatePage = (p: number) => {
    if (!activeBook) return
    const c = Math.max(1,Math.min(p,totalPages)); setCurrentPage(c)
    setBooks(prev=>prev.map(b=>b.id===activeBook.id?{...b,currentPage:c,totalPages}:b))
    // Keep reading context fresh
    localStorage.setItem('shh_reading_ctx', JSON.stringify({
      bookId: activeBook.id, title: activeBook.title, author: activeBook.author,
      currentPage: c, totalPages,
    }))
  }

  const closeReader = () => {
    const start = (window as any).__shh_readStart
    if (start) {
      const secs = Math.round((Date.now()-start)/1000)
      if (secs > 10) {
        const today = new Date().toISOString().split('T')[0]
        try { const d=JSON.parse(localStorage.getItem('shh_study_time')??'{}'); d[today]=(d[today]??0)+secs; localStorage.setItem('shh_study_time',JSON.stringify(d)) } catch {}
      }
      delete (window as any).__shh_readStart
    }
    setView('shelf'); setShowNotes(false)
  }

  const finishSession = async () => {
    if (!activeBook) return
    setRecapLoading(true)
    const r = await generateRecap(activeBook,sessionStart,currentPage)
    setRecap(r); setRecapLoading(false); setView('recap')
    if (typeof (window as any).__shh_generateCards==='function') {
      ;(window as any).__shh_generateCards(activeBook,sessionStart,currentPage)
    }
  }

  const deleteBook = async (id: string) => {
    setBooks(prev=>prev.filter(b=>b.id!==id))
    setPdfMap(m=>{const n=new Map(m);n.delete(id);return n})
    saveNotes(loadNotes().filter(n=>n.bookId!==id))
    _docCache.delete(id)
    await deletePdf(id)
    if(activeBook?.id===id){setView('shelf');setActiveBook(null);setActiveBuf(null)}
  }

  const filtered = books.filter(b=>{
    if(!b.totalPages) return filter==='all'
    const p=b.currentPage/b.totalPages
    if(filter==='progress') return p>0&&p<1
    if(filter==='finished') return p>=1
    return true
  })
  const pct = totalPages>0 ? Math.round(currentPage/totalPages*100) : 0

  return (
    <>
      {toast && <Toast kind={toast.kind} msg={toast.msg}/>}

      {/* ── Shelf ── */}
      <div className="page-scroll" style={{display:view!=='shelf'?'none':undefined}}>
        <div style={{padding:'32px clamp(16px,4vw,52px) 130px',maxWidth:1400,margin:'0 auto',width:'100%'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:30,letterSpacing:'-1px',color:'var(--text-1)',lineHeight:1.1,marginBottom:5}}>My library</div>
          <div style={{fontSize:12,color:'var(--text-3)',marginBottom:18}}>
            {books.length} book{books.length!==1?'s':''}
            {books.filter(b=>b.currentPage>1&&b.totalPages>1&&b.currentPage<b.totalPages).length>0?` · ${books.filter(b=>b.currentPage>1&&b.currentPage<b.totalPages).length} in progress`:''}
          </div>
          <div style={{display:'flex',gap:6,marginBottom:22}}>
            <button style={tabStyle(filter==='all')} onClick={()=>setFilter('all')}>All</button>
            <button style={tabStyle(filter==='progress')} onClick={()=>setFilter('progress')}>In progress</button>
            <button style={tabStyle(filter==='finished')} onClick={()=>setFilter('finished')}>Finished</button>
          </div>
          <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>fileRef.current?.click()}
            style={{border:`1.5px dashed ${dragging?'var(--accent)':'var(--border)'}`,borderRadius:20,padding:'26px 32px',textAlign:'center',cursor:'pointer',background:dragging?'var(--accent-soft)':'var(--bg-card)',transition:'all .2s',marginBottom:26}}>
            <div style={{width:44,height:44,borderRadius:12,background:'var(--accent-soft)',border:'1px solid var(--border-active)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5a2 2 0 0 1 2-2h13"/><path d="M4 17h14a2 2 0 0 1 0 4H4"/>
                <line x1="18" y1="7" x2="18" y2="13"/><line x1="15" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--text-1)',marginBottom:4}}>Add a book</div>
            <div style={{fontSize:12,color:'var(--text-3)',fontWeight:300}}>Drop any PDF — no size limit</div>
            <input ref={fileRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value=''}}/>
          </div>
          {filtered.length===0&&<p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'40px 0'}}>{filter==='all'?'No books yet — add one above.':'Nothing here yet.'}</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:14}}>
            {filtered.map(book=>(
              <div key={book.id}>
                <BookCard book={book} hasPdf={pdfMap.has(book.id)} onClick={()=>openBook(book)} onDelete={()=>deleteBook(book.id)}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reader overlay ── */}
      {view==='reader' && activeBook && activeBuf && (
        <div style={{position:'fixed',inset:0,background:'var(--bg)',zIndex:50,display:'flex',flexDirection:'column'}}>
          {/* Slim topbar */}
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:'0.5px solid var(--border)',background:'var(--bg-card)',backdropFilter:'blur(14px)',flexShrink:0,zIndex:2}}>
            <button onClick={closeReader} style={{width:30,height:30,borderRadius:'50%',border:'0.5px solid var(--border)',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{activeBook.title}</div>
              <div style={{fontSize:10,color:'var(--text-3)',marginTop:1}}>{activeBook.author} · p.{currentPage}/{totalPages} · {pct}%</div>
            </div>
            <div style={{width:72,height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',flexShrink:0}}>
              <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,var(--accent),#b07ef7)',borderRadius:99,transition:'width .5s ease'}}/>
            </div>
            <button onClick={()=>setReaderMode(m=>m==='pdf'?'ebook':'pdf')} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:999,border:'0.5px solid var(--border)',background:readerMode==='ebook'?'var(--accent-soft)':'transparent',color:readerMode==='ebook'?'var(--accent)':'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              {readerMode==='ebook'?'PDF':'Reader'}
            </button>
            <button onClick={()=>setShowNotes(n=>!n)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:999,border:'0.5px solid var(--border)',background:showNotes?'var(--accent-soft)':'transparent',color:showNotes?'var(--accent)':'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',flexShrink:0}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Notes
            </button>
            <button onClick={finishSession} disabled={recapLoading} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 12px',borderRadius:999,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',fontSize:11,color:'white',cursor:recapLoading?'default':'pointer',fontFamily:'var(--font-body)',boxShadow:'0 2px 10px var(--accent-glow)',opacity:recapLoading?0.6:1,flexShrink:0}}>
              {recapLoading?'…':'Done ✓'}
            </button>
          </div>

          {/* Body: tap zones + content */}
          <div style={{flex:1,display:'flex',alignItems:'stretch',minHeight:0,position:'relative'}}>
            {/* Left tap */}
            <button onClick={()=>updatePage(currentPage-1)} disabled={currentPage<=1}
              style={{width:'clamp(40px,7vw,72px)',flexShrink:0,background:'transparent',border:'none',cursor:currentPage<=1?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:currentPage<=1?0.1:0.35,transition:'opacity .2s',zIndex:2}}
              onMouseEnter={e=>{if(currentPage>1)(e.currentTarget as HTMLButtonElement).style.opacity='0.9'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity=currentPage<=1?'0.1':'0.35'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>

            {/* Content */}
            <div style={{flex:1,overflowY:'auto',overflowX:'hidden',minWidth:0,position:'relative'}}>
              {readerMode==='ebook'
                ? <EbookPage bookId={activeBook.id} buf={activeBuf} pageNum={currentPage} totalPages={totalPages}
                    onLoad={n=>{setTotalPages(n);setBooks(prev=>prev.map(b=>b.id===activeBook.id?{...b,totalPages:n}:b))}}/>
                : <div style={{display:'flex',justifyContent:'center',padding:'16px clamp(8px,2vw,20px)'}}>
                    <PdfPage bookId={activeBook.id} buf={activeBuf} pageNum={currentPage}
                      onLoad={n=>{setTotalPages(n);setBooks(prev=>prev.map(b=>b.id===activeBook.id?{...b,totalPages:n}:b))}}/>
                  </div>
              }
            </div>

            {/* Right tap */}
            <button onClick={()=>updatePage(currentPage+1)} disabled={currentPage>=totalPages}
              style={{width:'clamp(40px,7vw,72px)',flexShrink:0,background:'transparent',border:'none',cursor:currentPage>=totalPages?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:currentPage>=totalPages?0.1:0.35,transition:'opacity .2s',zIndex:2}}
              onMouseEnter={e=>{if(currentPage<totalPages)(e.currentTarget as HTMLButtonElement).style.opacity='0.9'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.opacity=currentPage>=totalPages?'0.1':'0.35'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.8" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            {showNotes && <NotesPanel book={activeBook} currentPage={currentPage} onClose={()=>setShowNotes(false)}/>}
          </div>
        </div>
      )}

      {/* ── Recap ── */}
      {view==='recap' && recap && (
        <RecapCard recap={recap}
          onClose={()=>{setRecap(null);setView('shelf');setActiveBook(null);setActiveBuf(null)}}
          onAsk={q=>{setMaterial({book:activeBook,recap,question:q});setPage('chat')}}/>
      )}
    </>
  )
}
