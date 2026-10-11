import { plural } from '../plural'
import WindowItem from '../components/WindowItem'
import useModalFocus from '../components/useModalFocus'
import useOverlayBack from '../components/useOverlayBack'
import '../components/reader/pdfCompatibility'
import pdfWorkerUrl from '../components/reader/pdf.worker.ts?worker&url'
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {DocumentBundle,PdfSource} from '../components/reader/types'
const ReaderExperience = lazy(() => import('../components/reader/ReaderExperience'))
import { SessionComplete } from '../components/reader/ReaderPanels'
import Icon from '../components/Icon'
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useUser, type Page } from '../App'
import { addStudySeconds, recordReadingSession } from '../studyHistory'
import { validateRange, type ReadingContext, type SourcePage } from '../readingContext'

// ── Types ─────────────────────────────────────────────────────
interface Book {
  id: string; title: string; author: string
  totalPages: number; currentPage: number
  coverGradient: string; addedAt: number
  goalDate?: string   // ISO date string "YYYY-MM-DD"
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
    req.onsuccess = () => {req.result.onversionchange=()=>req.result.close();res(req.result)}; req.onerror = () => rej(req.error)
  })
}
async function savePdf(id: string, buf: ArrayBuffer) {
  const db = await openDb(); const tx = db.transaction(ST,'readwrite')
  tx.objectStore(ST).put(buf, id)
  return new Promise<void>((res,rej) => { tx.oncomplete=()=>{db.close();res()}; tx.onerror=()=>{db.close();rej(tx.error)} })
}
async function loadPdf(id: string): Promise<ArrayBuffer|null> {
  const db = await openDb(); const tx = db.transaction(ST,'readonly')
  const req = tx.objectStore(ST).get(id)
  return new Promise((res,rej) => { req.onsuccess=()=>{db.close();res(req.result??null)}; req.onerror=()=>{db.close();rej(req.error)} })
}
async function deletePdf(id: string) {
  const db = await openDb(); const tx = db.transaction(ST,'readwrite'); tx.objectStore(ST).delete(id)
  return new Promise<void>((res,rej)=>{tx.oncomplete=()=>{db.close();res()};tx.onerror=()=>{db.close();rej(tx.error)}})
}

// ── pdf.js loader ─────────────────────────────────────────────
const pdfOptions = {cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/',enableXfa:false}
let _pdfjs: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null
function ensurePdfjs() {
  if (!_pdfjs) _pdfjs = import('pdfjs-dist/legacy/build/pdf.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return lib
  }).catch(error => { _pdfjs = null; throw error })
  return _pdfjs
}

// Each loading task owns a classic worker, including Safari without module workers.
const documentOwners = new WeakMap<PDFDocumentProxy, () => Promise<void>>()
async function parsePdf(data: ArrayBuffer) {
  const lib = await ensurePdfjs(), port = new Worker(pdfWorkerUrl, import.meta.env.DEV ? {type:'module'} : undefined)
  const worker = lib.PDFWorker.create({port})
  const task = lib.getDocument({...pdfOptions,data,worker})
  const destroy = async () => { try { await task.destroy() } finally { worker.destroy(); port.terminate() } }
  try { const doc = await task.promise; documentOwners.set(doc,destroy); return doc }
  catch(error) { await destroy(); throw error }
}
function destroyPdf(doc: PDFDocumentProxy) {
  const destroy = documentOwners.get(doc)
  documentOwners.delete(doc)
  return destroy ? destroy() : doc.loadingTask.destroy()
}

// ── Module-level PDF document cache ──────────────────────────
// Keyed by book ID so document never reloads on page turn
const _docCache = new Map<string, any>()
let lastSource: { key: string; pages: SourcePage[] } | null = null
window.addEventListener('shh:clear-device-data', () => { sourceEpoch++; extractionPending.clear(); releaseReaderDocuments() })
function cacheDocument(id: string, document: any) {
  _docCache.set(id,document)
  if(_docCache.size>3){
    const oldest=_docCache.keys().next().value!
    const evicted=_docCache.get(oldest)
    _docCache.delete(oldest)
    if(evicted) void destroyPdf(evicted)
  }
}

let sourceEpoch = 0
const extractionPending = new Map<string, Promise<SourcePage[]>>()
let extractionQueue: Promise<void> = Promise.resolve()
export async function extractReadingPages(context: ReadingContext): Promise<SourcePage[]> {
  validateRange(context.fromPage, context.toPage, context.totalPages)
  const key = `${context.bookId}:${context.fromPage}:${context.toPage}`
  if(lastSource?.key === key) return lastSource.pages
  const existing = extractionPending.get(key)
  if(existing) return existing
  // Preview and Send may ask for the same selection. Share work and cap peak workers.
  const epoch = sourceEpoch
  const request = extractionQueue.then(() => { if(epoch!==sourceEpoch)throw new Error('Selection cleared'); return readReadingPages(context,epoch) })
  extractionQueue = request.then(() => undefined, () => undefined)
  extractionPending.set(key,request)
  try { return await request } finally { if(extractionPending.get(key)===request)extractionPending.delete(key) }
}
async function readReadingPages(context: ReadingContext, epoch: number): Promise<SourcePage[]> {
  validateRange(context.fromPage, context.toPage, context.totalPages)
  const sourceKey=`${context.bookId}:${context.fromPage}:${context.toPage}`
  if(lastSource?.key===sourceKey)return lastSource.pages
  // Extraction owns a short-lived document; never retain it between screens.
  let doc: PDFDocumentProxy | undefined
  if (!doc) {
    const buffer = await loadPdf(context.bookId)
    if (!buffer) throw new Error('The PDF is not available on this device. Open or re-upload it in your library.')
    doc = await parsePdf(buffer)
  }
  try {
  validateRange(context.fromPage, context.toPage, doc.numPages)
  const pages: SourcePage[] = []
  let count = 0
  for (let n = context.fromPage; n <= context.toPage; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    const text = content.items.map(item => ('str' in item ? item.str : '') + ('hasEOL' in item && item.hasEOL ? '\n' : ' ')).join('').trim()
    count += text.length
    if (count > 32000) throw new Error('This selection has too much text. Choose a smaller page range.')
    pages.push({ page: n, text }); page.cleanup()
  }
  if (!pages.some(p => p.text.trim())) throw new Error('These pages contain no readable text. Scan-only pages need OCR, or paste their text into chat.')
  if(epoch!==sourceEpoch)throw new Error('Selection cleared')
  lastSource={key:sourceKey,pages}
  return pages
  } finally { await destroyPdf(doc) }
}

type ReaderTextItem = {str?:string;transform?:number[]}
type ReaderSource = Omit<PdfSource,'getTextContent'> & {
  getTextContent:()=>Promise<{items:ReaderTextItem[];styles:Record<string,unknown>}>
  getOperatorList:()=>Promise<{fnArray:number[]}>
}
type ReaderBundle = {doc:{numPages:number;getPage:(page:number)=>Promise<ReaderSource>};lib:DocumentBundle['lib'] & {OPS:{paintImageXObject:number}}}
const readerPending = new Map<string, Promise<ReaderBundle>>()
let readerGeneration = 0
function releaseReaderDocuments() {
  readerGeneration++
  for (const doc of _docCache.values()) void destroyPdf(doc).catch(() => {})
  _docCache.clear(); readerPending.clear(); lastSource = null
}
async function readerDocument(bookId: string, buf: ArrayBuffer) {
  const pending=readerPending.get(bookId)
  if(pending)return pending
  const generation = readerGeneration
  const request:Promise<ReaderBundle>=(async()=>{
    const lib=await ensurePdfjs()
    if(!_docCache.has(bookId)){
      const doc=await parsePdf(buf.slice(0))
      if (generation !== readerGeneration) { await destroyPdf(doc); throw new Error('Reader closed') }
      cacheDocument(bookId,doc)
    }
    return {doc:_docCache.get(bookId),lib:{OPS:lib.OPS,renderTextLayer(options) {
      const layer = new lib.TextLayer(options as unknown as ConstructorParameters<typeof lib.TextLayer>[0])
      return {promise:layer.render(),cancel:()=>layer.cancel()}
    }}}
  })()
  readerPending.set(bookId,request)
  try{return await request}finally{if(readerPending.get(bookId)===request)readerPending.delete(bookId)}
}
async function readerText(bookId:string, buf:ArrayBuffer, pageNum:number) {
  const {doc,lib}=await readerDocument(bookId,buf)
  const pg=await doc.getPage(pageNum)
  const ct=await pg.getTextContent()
  const ops=await pg.getOperatorList()
  const hasImages=ops.fnArray.some((f:number)=>f===lib.OPS.paintImageXObject || f===85 || f===86)
        // Group by Y coordinate
        const lineMap = new Map<number, string[]>()
        ct.items.forEach((it: ReaderTextItem) => {
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

  pg.cleanup?.()
  return { blocks:result, hasImages, totalPages:doc.numPages }
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ kind, msg }: { kind: ToastKind; msg: string }) {
  const C = { success:{bg:'rgba(52,211,153,.13)',border:'rgba(52,211,153,.3)',dot:'#34d399'}, error:{bg:'rgba(239,68,68,.1)',border:'rgba(239,68,68,.25)',dot:'#f87171'}, loading:{bg:'var(--bg-card)',border:'var(--border)',dot:'var(--accent)'} }[kind]
  return (
    <div className="study-toast" role="status" style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',zIndex:300,display:'flex',alignItems:'center',gap:10,padding:'11px 18px',borderRadius:999,background:C.bg,border:`1px solid ${C.border}`,backdropFilter:'blur(20px)',fontSize:13,color:'var(--text-1)',fontFamily:'var(--font-body)',whiteSpace:'nowrap',boxShadow:'0 8px 24px rgba(0,0,0,.16)',animation:'toastIn .3s cubic-bezier(.34,1.56,.64,1) both'}}>
      <div style={{width:7,height:7,borderRadius:'50%',background:C.dot,flexShrink:0,animation:kind==='loading'?'pulse 1.4s ease-in-out infinite':'none'}}/>
      {msg}
    </div>
  )
}

// ── Book card with three-dot menu ─────────────────────────────
function BookCard({ book, hasPdf, onClick, onDelete, onRename }: {
  book: Book; hasPdf: boolean
  onClick: () => void; onDelete: () => void
  onRename: (title: string, author: string, goalDate?: string) => void
}) {
  const pct  = book.totalPages > 0 ? Math.round(book.currentPage/book.totalPages*100) : 0
  const done = pct >= 100
  const [menu, setMenu]   = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [editTitle,  setEditTitle]  = useState(book.title)
  const [editAuthor, setEditAuthor] = useState(book.author)
  const [editGoal,   setEditGoal]   = useState(book.goalDate ?? '')
  const menuRef = useRef<HTMLDivElement>(null)
  const renameRef = useRef<HTMLDivElement>(null)
  useOverlayBack(menu, () => setMenu(false))
  useModalFocus(renameRef, renaming, () => setRenaming(false))

  // Pages per day calculation
  const pagesLeft    = book.totalPages - book.currentPage
  const daysLeft     = book.goalDate ? Math.max(1, Math.ceil((new Date(book.goalDate).getTime() - Date.now()) / 86400000)) : null
  const pagesPerDay  = daysLeft && pagesLeft > 0 ? Math.ceil(pagesLeft / daysLeft) : null
  const goalOverdue  = book.goalDate && new Date(book.goalDate) < new Date() && pct < 100

  useEffect(() => {
    if (!menu) return
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [menu])

  const saveRename = () => {
    onRename(editTitle, editAuthor, editGoal || undefined)
    setRenaming(false)
  }

  return (
    <>
      {/* Rename / goal modal */}
      {renaming && (
        <div className="book-overlay" onClick={()=>setRenaming(false)} style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div ref={renameRef} role="dialog" aria-modal="true" aria-label="Edit book details" className="book-dialog" onClick={e=>e.stopPropagation()} style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:22,padding:'28px 28px 24px',width:'100%',maxWidth:380,boxShadow:'0 24px 64px rgba(0,0,0,.3)',animation:'scaleIn .2s var(--spring) both'}}>
            <div style={{fontSize:16,fontWeight:500,color:'var(--text-1)',marginBottom:18}}>Edit book details</div>
            <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
              <div>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:5}}>Title</div>
                <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveRename()} style={{borderRadius:10,fontSize:14}} autoFocus/>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:5}}>Author</div>
                <input value={editAuthor} onChange={e=>setEditAuthor(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveRename()} style={{borderRadius:10,fontSize:14}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:'var(--text-3)',marginBottom:5}}>
                  Finish by <span style={{color:'var(--text-4)'}}>— optional</span>
                </div>
                <input type="date" value={editGoal} onChange={e=>setEditGoal(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  style={{borderRadius:10,fontSize:14,colorScheme:'dark'}}/>
                {editGoal && book.totalPages > 0 && (
                  <div style={{fontSize:11,color:'var(--accent)',marginTop:6}}>
                    {(() => {
                      const d = Math.max(1, Math.ceil((new Date(editGoal).getTime()-Date.now())/86400000))
                      const p = Math.ceil((book.totalPages-book.currentPage)/d)
                      return `~${plural(p, 'page')}/day to finish in ${plural(d, 'day')}`
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="book-dialog-actions" style={{display:'flex',gap:8}}>
              <button onClick={()=>setRenaming(false)} style={{flex:1,padding:'10px',borderRadius:10,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-2)',fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)'}}>Cancel</button>
              <button onClick={saveRename} style={{flex:1,padding:'10px',borderRadius:10,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 14px var(--accent-glow)'}}>Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="library-book-hover" style={{position:'relative'}}>
        <button onClick={onClick} style={{background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:16,overflow:'hidden',cursor:'pointer',textAlign:'left',width:'100%',transition:'all .22s',transform:'none',boxShadow:'none'}}>
          <div style={{height:110,background:book.coverGradient,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
            <Icon name="library" size={26} />
            <span style={{position:'absolute',top:10,right:10,background:'rgba(0,0,0,.25)',borderRadius:6,padding:'3px 7px',fontSize:10,color:'rgba(255,255,255,.9)',fontWeight:500}}>{pct}%</span>
            {!hasPdf && <span style={{position:'absolute',bottom:8,left:8,background:'rgba(0,0,0,.4)',borderRadius:6,padding:'2px 6px',fontSize:9,color:'rgba(255,255,255,.7)'}}>re-upload needed</span>}
          </div>
          <div style={{padding:'12px 14px 14px'}}>
            <div style={{fontSize:13,fontWeight:500,color:'var(--text-1)',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{book.title}</div>
            <div style={{fontSize:11,color:'var(--text-3)',marginBottom:6,fontWeight:300,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{book.author}</div>
            {/* Goal badge */}
            {pagesPerDay && !done && (
              <div style={{fontSize:10,color:goalOverdue?'#f87171':'var(--accent)',marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
                <Icon name="plan" size={10} />
                {goalOverdue ? 'Goal overdue!' : `${pagesPerDay} pg/day`}
              </div>
            )}
            <div style={{height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:done?'linear-gradient(90deg,#3ecfa0,#2aad82)':'linear-gradient(90deg,var(--accent),#b07ef7)',borderRadius:99,transition:'width .8s ease'}}/>
            </div>
          </div>
        </button>

        {/* Three-dot menu */}
        <div ref={menuRef} style={{position:'absolute',top:8,right:8,zIndex:10}}>
          <button className="book-actions" aria-label={`Actions for ${book.title}`} aria-expanded={menu} onClick={e=>{e.stopPropagation();setMenu(m=>!m)}} style={{width:26,height:26,borderRadius:'50%',background:menu?'rgba(0,0,0,.45)':'transparent',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:menu?1:0,transition:'all .18s',color:'white'}}>
            <Icon name="more" size={13} />
          </button>
          {menu && (
            <div style={{position:'absolute',top:30,right:0,background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:12,padding:'4px',minWidth:140,boxShadow:'0 8px 24px rgba(0,0,0,.2)',backdropFilter:'blur(16px)',zIndex:20}}>
              <button className="capability-hover-5"  onClick={e=>{e.stopPropagation();setMenu(false);onClick()}} style={{width:'100%',padding:'9px 14px',borderRadius:8,background:'transparent',border:'none',textAlign:'left',fontSize:13,color:'var(--text-1)',cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',gap:8}}  >
                <Icon name="eye" size={13} />Open
              </button>
              <button className="capability-hover-6"  onClick={e=>{e.stopPropagation();setMenu(false);setEditTitle(book.title);setEditAuthor(book.author);setEditGoal(book.goalDate??'');setRenaming(true)}} style={{width:'100%',padding:'9px 14px',borderRadius:8,background:'transparent',border:'none',textAlign:'left',fontSize:13,color:'var(--text-1)',cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',gap:8}}  >
                <Icon name="edit" size={13} />Rename & goal
              </button>
              <button className="capability-hover-7"  onClick={e=>{e.stopPropagation();setMenu(false);onDelete()}} style={{width:'100%',padding:'9px 14px',borderRadius:8,background:'transparent',border:'none',textAlign:'left',fontSize:13,color:'#f87171',cursor:'pointer',fontFamily:'var(--font-body)',display:'flex',alignItems:'center',gap:8}}  >
                <Icon name="trash" size={13} />Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const tabStyle = (a:boolean): React.CSSProperties => ({padding:'5px 14px',borderRadius:999,fontSize:12,cursor:'pointer',border:'0.5px solid var(--border)',fontFamily:'var(--font-body)',background:a?'var(--bg-pill)':'transparent',color:a?'var(--text-1)':'var(--text-3)',transition:'all .18s'})

// ── Main Library ──────────────────────────────────────────────
export default function Library({
  setMaterial,
  setPage,
  onReaderModeChange,
}: {
  setMaterial:(m:any)=>void
  setPage:(p:Page)=>void
  onReaderModeChange?: (active:boolean)=>void
}) {
  const { user } = useUser()
  const [books,setBooks]               = useState<Book[]>(loadBooks)
  const [pdfIds,setPdfIds]             = useState<Set<string>>(new Set())
  const [view,setView]                 = useState<LibView>('shelf')
  const [filter,setFilter]             = useState<ShelfFilter>('all')
  const [search,setSearch]             = useState('')
  const [activeBook,setActiveBook]     = useState<Book|null>(null)
  const [activeBuf,setActiveBuf]       = useState<ArrayBuffer|null>(null)
  const [currentPage,setCurrentPage]   = useState(1)
  const [totalPages,setTotalPages]     = useState(1)
    const [recap,setRecap]               = useState<RecapData|null>(null)
  const [dragging,setDragging]         = useState(false)
  const [toast,setToast]               = useState<{kind:ToastKind;msg:string}|null>(null)
  const sessionRange = useRef({min:1,max:1})
  const fileRef  = useRef<HTMLInputElement>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  const showToast = useCallback((kind:ToastKind, msg:string, ttl=3500) => {
    setToast({kind,msg})
    if(toastRef.current) clearTimeout(toastRef.current)
    if(ttl>0) toastRef.current=setTimeout(()=>setToast(null),ttl)
  }, [])

  useEffect(() => () => { if(toastRef.current) clearTimeout(toastRef.current); releaseReaderDocuments() }, [])
  useEffect(() => { if(view !== 'reader') releaseReaderDocuments() }, [view])
  const restoredReader = useRef(sessionStorage.getItem('shh_open_reader'))
  useEffect(()=>{ saveBooks(books) },[books])
  useEffect(() => {
    if(view === 'reader' && activeBook) sessionStorage.setItem('shh_open_reader',activeBook.id)
    else sessionStorage.removeItem('shh_open_reader')
    onReaderModeChange?.(view === 'reader')
    return () => onReaderModeChange?.(false)
  }, [view, activeBook, onReaderModeChange])
  useEffect(()=>{
    if(activeBook) localStorage.setItem('shh_session',JSON.stringify({bookId:activeBook.id,bookTitle:`${activeBook.title} — ${activeBook.author}`,page:currentPage,totalPages}))
      if(activeBook) { const profileKey=user?.id || 'local'; localStorage.setItem(`shh_resume:${profileKey}`,JSON.stringify({bookId:activeBook.id,bookTitle:activeBook.title,page:currentPage,totalPages})) }
  },[activeBook,currentPage,totalPages,user?.id])
  useEffect(()=>{
    let cancelled=false
    void openDb().then(db=>{
      const tx=db.transaction(ST,'readonly')
      const req=tx.objectStore(ST).getAllKeys()
      req.onsuccess=()=>{if(!cancelled)setPdfIds(new Set(req.result.map(String)));db.close()}
      req.onerror=()=>db.close()
    }).catch(()=>showToast('error','Could not open local PDF storage.'))
    return()=>{cancelled=true}
  },[])

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { showToast('error','Choose a PDF smaller than 25 MB'); return }
    if (file.type !== 'application/pdf') { showToast('error','Please upload a PDF file'); return }
    showToast('loading',`Reading ${file.name}…`,0)
    try {
      const buf = await file.arrayBuffer()
      if (new TextDecoder().decode(buf.slice(0, 5)) !== '%PDF-') throw new Error('Invalid PDF signature')
      const pdf = await parsePdf(buf.slice(0))
      const numPages: number = pdf.numPages
      const raw = file.name.replace(/\.pdf$/i,'').replace(/_/g,' ')
      const parts = raw.split(/\s*[-–]\s*/)
      const title = parts[0]?.trim()||raw; const author = parts[1]?.trim()||'Unknown author'
      const id = Date.now().toString()
      const book: Book = {id,title,author,totalPages:numPages,currentPage:1,coverGradient:GRADIENTS[Math.floor(Math.random()*GRADIENTS.length)],addedAt:Date.now()}
      await destroyPdf(pdf)
      await savePdf(id,buf)
      setPdfIds(ids=>new Set([...ids,id]))
      setBooks(prev=>[...prev,book])
      if(toastRef.current) clearTimeout(toastRef.current)
      showToast('success',`"${title}" added — ${numPages} pages`)
    } catch(e) { console.error(e); showToast('error','Could not read this PDF. Try another file.') }
  },[showToast])

  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f=e.dataTransfer.files[0]; if(f) handleFile(f) }

  const openBook = useCallback(async (book: Book) => {
    let buf: ArrayBuffer | null
    try { buf=await loadPdf(book.id) } catch { showToast('error','Could not open local PDF storage.'); return }
    if (!buf) { showToast('error','PDF not found — please re-upload this book'); return }
    setPdfIds(ids=>new Set([...ids,book.id]))
    setActiveBook(book); setActiveBuf(buf)
    setCurrentPage(book.currentPage||1)
    setTotalPages(book.totalPages||1)
    ;(window as any).__shh_readStart = Date.now()
    ;(window as any).__shh_readSessionId = `${book.id}:${book.currentPage || 1}:${Date.now()}`
    ;(window as any).__shh_readSessionLogged = null
    setView('reader'); sessionRange.current={min:book.currentPage||1,max:book.currentPage||1}
    // Store current reading context for Chat
    localStorage.setItem('shh_reading_ctx', JSON.stringify({
      bookId: book.id, title: book.title, author: book.author,
      currentPage: book.currentPage||1, totalPages: book.totalPages||1,
      fromPage: book.currentPage||1, toPage: book.currentPage||1,
    }))
  }, [showToast])

  useEffect(() => {
    const id = sessionStorage.getItem('shh_resume_request') || restoredReader.current
    restoredReader.current = null
    if (!id) return
    sessionStorage.removeItem('shh_resume_request')
    const book = books.find(b => b.id === id)
    if (book) void Promise.resolve().then(() => openBook(book))
  }, [books, openBook])

  const updatePage = (p: number) => {
    if (!activeBook) return
    const c = Math.max(1,Math.min(p,totalPages)); setCurrentPage(c)
    sessionRange.current={min:Math.min(sessionRange.current.min,c),max:Math.max(sessionRange.current.max,c)}
    setBooks(prev=>prev.map(b=>b.id===activeBook.id?{...b,currentPage:c,totalPages}:b))
    // Keep reading context fresh
    localStorage.setItem('shh_reading_ctx', JSON.stringify({
      bookId: activeBook.id, title: activeBook.title, author: activeBook.author,
      currentPage: c, totalPages, fromPage: sessionRange.current.min, toPage: sessionRange.current.max,
    }))
  }

  const closeReader = () => {
    const start = (window as any).__shh_readStart
    let secs = 0
    if (start) {
      secs = Math.round((Date.now()-start)/1000)
      if (secs > 10) addStudySeconds(secs)
      delete (window as any).__shh_readStart
    }
    const sessionId = (window as any).__shh_readSessionId
    if (activeBook && sessionId && (window as any).__shh_readSessionLogged !== sessionId) {
      recordReadingSession(activeBook, sessionRange.current.min, sessionRange.current.max, secs)
      ;(window as any).__shh_readSessionLogged = sessionId
    }
    setActiveBuf(null); setView('shelf')
  }

  const finishSession = (headings:string[]) => {
    if (!activeBook) return
    const start = (window as any).__shh_readStart
    const secs = start ? Math.round((Date.now()-start)/1000) : 0
    const sessionId = (window as any).__shh_readSessionId
    if (sessionId && (window as any).__shh_readSessionLogged !== sessionId) {
      if (secs > 10) addStudySeconds(secs)
      recordReadingSession(activeBook, sessionRange.current.min, sessionRange.current.max, secs)
      ;(window as any).__shh_readSessionLogged = sessionId
      delete (window as any).__shh_readStart
    }
    const fromPage=sessionRange.current.min,toPage=sessionRange.current.max
    const r:RecapData={bookId:activeBook.id,fromPage,toPage,summary:headings.length?headings:[fromPage===toPage?`Page ${fromPage}`:`Pages ${fromPage}–${toPage}`],questions:['Summarise these pages','Quiz me','Explain it simply']}
    setActiveBuf(null); setRecap(r);setView('recap')
    if(typeof (window as any).__shh_generateCards==='function')void (window as any).__shh_generateCards({...activeBook,totalPages,currentPage},fromPage,toPage)

  }

  const deleteBook = async (id: string) => {
    setBooks(prev=>prev.filter(b=>b.id!==id))
    setPdfIds(ids=>{const next=new Set(ids);next.delete(id);return next})
    saveNotes(loadNotes().filter(n=>n.bookId!==id))
    if(lastSource?.key.startsWith(id+':'))lastSource=null
    const cached = _docCache.get(id)
    _docCache.delete(id)
    if(cached) void destroyPdf(cached)
    try { if (JSON.parse(localStorage.getItem('shh_reading_ctx') ?? 'null')?.bookId === id) localStorage.removeItem('shh_reading_ctx') } catch {}
    await deletePdf(id)
    if(activeBook?.id===id){setView('shelf');setActiveBook(null);setActiveBuf(null)}
  }

  const renameBook = (id: string, title: string, author: string, goalDate?: string) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, title: title.trim() || b.title, author: author.trim() || b.author, goalDate } : b))
  }

  const filtered = books.filter(b => {
    const q = search.toLowerCase()
    if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false
    if (!b.totalPages) return filter === 'all'
    const p = b.currentPage / b.totalPages
    if (filter === 'progress') return p > 0 && p < 1
    if (filter === 'finished') return p >= 1
    return true
  })

  return (
    <>
      {toast && <Toast kind={toast.kind} msg={toast.msg}/>}

      {/* ── Shelf ── */}
      <div className="page-scroll library-shelf" style={{display:view!=='shelf'?'none':undefined}}>
        <div style={{padding:'32px clamp(16px,4vw,52px) 130px',maxWidth:1400,margin:'0 auto',width:'100%'}}>
          <h1 className="page-title">Your <em className="title-accent">library.</em></h1>
          <div style={{fontSize:12,color:'var(--text-3)',marginBottom:18}}>
            {books.length} book{books.length!==1?'s':''}
            {books.filter(b=>b.currentPage>1&&b.totalPages>1&&b.currentPage<b.totalPages).length>0?` · ${books.filter(b=>b.currentPage>1&&b.currentPage<b.totalPages).length} in progress`:''}
          </div>

          {/* Search bar */}
          {books.length > 2 && (
            <div style={{position:'relative',marginBottom:16}}>
              <Icon name="search" size={14} style={{position:'absolute',left:13,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--text-3)'}} />
              <input
                value={search} onChange={e=>setSearch(e.target.value)}
                aria-label="Search books and authors" placeholder="Search books and authors…"
                style={{paddingLeft:36,borderRadius:12,fontSize:13}}
              />
              {search && (
                <button aria-label="Clear book search" onClick={()=>setSearch('')} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',display:'flex',alignItems:'center',padding:2}}>
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          )}

          <div style={{display:'flex',gap:8,marginBottom:22}}>
            <button style={tabStyle(filter==='all')} onClick={()=>setFilter('all')}>All</button>
            <button style={tabStyle(filter==='progress')} onClick={()=>setFilter('progress')}>In progress</button>
            <button style={tabStyle(filter==='finished')} onClick={()=>setFilter('finished')}>Finished</button>
          </div>
          <div className="library-dropzone" role="button" tabIndex={0} aria-label="Add a book, choose a text-based PDF" onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileRef.current?.click()}}} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>fileRef.current?.click()}
            style={{border:`1.5px dashed ${dragging?'var(--accent)':'var(--border)'}`,borderRadius:20,padding:'26px 32px',textAlign:'center',cursor:'pointer',background:dragging?'var(--accent-soft)':'var(--bg-card)',transition:'all .2s',marginBottom:26}}>
            <div style={{width:44,height:44,borderRadius:12,background:'var(--accent-soft)',border:'1px solid var(--border-active)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <Icon name="library" size={20} style={{color:'var(--accent)'}} />
            </div>
            <div style={{fontSize:14,fontWeight:500,color:'var(--text-1)',marginBottom:4}}>Add a book</div>
            <div style={{fontSize:12,color:'var(--text-3)',fontWeight:300}}>Drop a text-based PDF · up to 25 MB</div>
            <input ref={fileRef} type="file" accept=".pdf" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value=''}}/>
          </div>
          {filtered.length===0&&<p style={{fontSize:13,color:'var(--text-3)',textAlign:'center',padding:'40px 0'}}>{filter==='all'?'No books yet — add one above.':'Nothing here yet.'}</p>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(148px,1fr))',gap:14}}>
            {filtered.map(book=>(
              <WindowItem key={book.id} enabled={filtered.length > 40}>
                <BookCard book={book} hasPdf={pdfIds.has(book.id)} onClick={()=>openBook(book)} onDelete={()=>deleteBook(book.id)} onRename={(t,a,g)=>renameBook(book.id,t,a,g)}/>
              </WindowItem>
            ))}
          </div>
        </div>
      </div>

      {view==='reader' && activeBook && activeBuf && <Suspense fallback={<p role="status">Opening reader…</p>}><ReaderExperience
        key={activeBook.id} book={activeBook} buffer={activeBuf} currentPage={currentPage} totalPages={totalPages}
        settingsKey={`shh_reader_settings:${user?.id || 'local'}`} loadDocument={readerDocument} loadText={readerText}
        onPage={updatePage} onClose={closeReader} onDone={finishSession}
        onTotal={n=>{setTotalPages(n);setBooks(prev=>prev.some(b=>b.id===activeBook.id&&b.totalPages!==n)?prev.map(b=>b.id===activeBook.id?{...b,totalPages:n}:b):prev)}}
        onAsk={(text,fromPage,toPage)=>{closeReader();localStorage.setItem('shh_reading_ctx',JSON.stringify({bookId:activeBook.id,title:activeBook.title,author:activeBook.author,currentPage:fromPage,totalPages,fromPage,toPage}));setMaterial({book:{...activeBook,currentPage:fromPage,totalPages},recap:{fromPage,toPage,questions:[]},question:`Explain this passage from PDF pages ${fromPage}–${toPage}:\n“${text}”`});setPage('chat')}}
      /></Suspense>}

      {/* ── Recap ── */}
      {view==='recap' && recap && (
        <SessionComplete recap={recap}
          onClose={()=>{setRecap(null);setView('shelf');setActiveBook(null);setActiveBuf(null)}}
          onAsk={q=>{if(activeBook)localStorage.setItem('shh_reading_ctx',JSON.stringify({bookId:activeBook.id,title:activeBook.title,author:activeBook.author,currentPage,totalPages,fromPage:recap.fromPage,toPage:recap.toPage}));setMaterial({book:activeBook ? {...activeBook,currentPage,totalPages} : null,recap,question:q});setPage('chat')}}/>
      )}
    </>
  )
}
