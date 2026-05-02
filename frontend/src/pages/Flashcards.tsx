import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Book { id: string; title: string; author: string; totalPages: number; currentPage: number }
interface Card {
  id: string; bookId: string; bookTitle: string
  front: string; back: string
  fromPage: number; toPage: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  createdAt: number
  nextReview: number   // 0 = due now
  interval: number     // days until next review
  reviewCount: number
}

// ── Storage ───────────────────────────────────────────────────
const CK = 'shh_flashcards'
const load  = (): Card[] => { try { return JSON.parse(localStorage.getItem(CK) ?? '[]') } catch { return [] } }
const save  = (c: Card[]) => { try { localStorage.setItem(CK, JSON.stringify(c)) } catch {} }
const books = (): Book[] => { try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] } }

// ── SRS scheduling (SM-2 simplified) ─────────────────────────
function schedule(card: Card, rating: 'easy' | 'medium' | 'hard'): Partial<Card> {
  const now = Date.now()
  const iv  = card.interval || 1
  const next = rating === 'hard'   ? 1
             : rating === 'medium' ? Math.max(3,  Math.round(iv * 1.5))
             :                       Math.max(7,  Math.round(iv * 2.5))
  return {
    difficulty:  rating,
    interval:    next,
    nextReview:  now + next * 86400000,
    reviewCount: (card.reviewCount || 0) + 1,
  }
}

// ── Generate cards from a reading session ─────────────────────
async function generateCards(book: Book, fromPage: number, toPage: number): Promise<Card[]> {
  const res = await fetch((import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', max_tokens: 2000,
      system: 'Reply ONLY with valid JSON.',
      messages: [{
        role: 'user',
        content: `Create 6–8 flashcards for pages ${fromPage}–${toPage} of "${book.title}" by ${book.author}.
Each card tests one key concept from those pages. Mix recall and understanding questions.
Front: clear question. Back: concise answer (1–3 sentences).
JSON only: [{"front":"...","back":"..."},...]`
      }]
    })
  })
  const data = await res.json()
  const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
  const parsed: { front: string; back: string }[] = JSON.parse(text.replace(/```json|```/g, '').trim())
  return parsed.map((c, i) => ({
    id: `${Date.now()}_${i}_${Math.random().toString(36).slice(2)}`,
    bookId: book.id, bookTitle: book.title,
    front: c.front, back: c.back,
    fromPage, toPage,
    difficulty: null, createdAt: Date.now(),
    nextReview: 0, interval: 1, reviewCount: 0,
  }))
}

// Exposed so Library can call it after a session ends
;(window as any).__shh_generateCards = async (book: Book, fromPage: number, toPage: number) => {
  try {
    const newCards = await generateCards(book, fromPage, toPage)
    const existing = load()
    const deduped  = existing.filter(c => !(c.bookId === book.id && c.fromPage === fromPage && c.toPage === toPage))
    save([...deduped, ...newCards])
    // Notify any mounted Flashcards component
    window.dispatchEvent(new CustomEvent('shh:cards-updated'))
  } catch (e) { console.warn('Card gen error:', e) }
}

// ── Flip card ─────────────────────────────────────────────────
function FlipCard({ card, onRate }: { card: Card; onRate: (d: 'easy' | 'medium' | 'hard') => void }) {
  const [flipped, setFlipped] = useState(false)
  useEffect(() => { setFlipped(false) }, [card.id])

  return (
    <div style={{ width: '100%', maxWidth: 540, margin: '0 auto' }}>
      {/* Card */}
      <div
        onClick={() => setFlipped(f => !f)}
        style={{ cursor: 'pointer', perspective: '1200px', height: 'clamp(200px,32vh,280px)', position: 'relative' }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.42s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Front */}
          <div style={{ position:'absolute',inset:0,backfaceVisibility:'hidden',background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:20,padding:'28px 32px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
            <div style={{ fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--text-3)',marginBottom:18 }}>
              {card.bookTitle.length > 30 ? card.bookTitle.slice(0,30)+'…' : card.bookTitle} · p.{card.fromPage}–{card.toPage}
            </div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:'clamp(15px,2vw,20px)',color:'var(--text-1)',textAlign:'center',lineHeight:1.45,letterSpacing:'-0.2px' }}>
              {card.front}
            </div>
            <div style={{ marginTop:20,fontSize:11,color:'var(--text-3)',display:'flex',alignItems:'center',gap:5 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Tap to reveal answer
            </div>
          </div>
          {/* Back */}
          <div style={{ position:'absolute',inset:0,backfaceVisibility:'hidden',transform:'rotateY(180deg)',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',borderRadius:20,padding:'28px 32px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
            <div style={{ fontSize:10,letterSpacing:'2.5px',textTransform:'uppercase',color:'var(--accent)',marginBottom:18 }}>Answer</div>
            <div style={{ fontSize:'clamp(14px,1.8vw,17px)',color:'var(--text-1)',textAlign:'center',lineHeight:1.7,fontWeight:300 }}>
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Rating buttons — only visible after flip */}
      <div style={{
        display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18,
        opacity: flipped ? 1 : 0,
        transform: flipped ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity .28s ease, transform .28s ease',
        pointerEvents: flipped ? 'auto' : 'none',
      }}>
        {[
          { d: 'hard',   label: 'Hard',   sub: 'See tomorrow',  color: '#f87171', bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)'   },
          { d: 'medium', label: 'Okay',   sub: 'See in 3 days', color: 'var(--amber)', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' },
          { d: 'easy',   label: 'Easy',   sub: 'See in 7 days', color: '#34d399', bg: 'rgba(52,211,153,.1)',  border: 'rgba(52,211,153,.25)'  },
        ].map(({ d, label, sub, color, bg, border }) => (
          <button key={d}
            onClick={e => { e.stopPropagation(); onRate(d as any) }}
            style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'9px 18px',borderRadius:14,background:bg,border:`0.5px solid ${border}`,color,cursor:'pointer',fontFamily:'var(--font-body)',transition:'all .18s',minWidth:80,touchAction:'manipulation' }}>
            <span style={{ fontSize:13,fontWeight:500 }}>{label}</span>
            <span style={{ fontSize:10,opacity:0.7 }}>{sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── How SRS works explainer ───────────────────────────────────
function SRSExplainer() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 16 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',padding:0,touchAction:'manipulation' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        How do flashcards work?
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ marginTop:12,padding:'16px 18px',background:'var(--bg-card)',border:'0.5px solid var(--border)',borderRadius:14,fontSize:13,color:'var(--text-2)',lineHeight:1.7,fontWeight:300,animation:'fadeUp .2s ease both' }}>
          <p style={{ marginBottom:10 }}>Cards are <strong style={{ fontWeight:500,color:'var(--text-1)' }}>automatically created</strong> when you finish a reading session in your Library. Claude reads the same pages you just read and generates questions about them.</p>
          <p style={{ marginBottom:10 }}>When you review a card, you rate how well you knew it:</p>
          <div style={{ display:'flex',flexDirection:'column',gap:6,margin:'12px 0' }}>
            {[
              { c:'#f87171', l:'Hard', d:"You didn't know it — you'll see it again tomorrow" },
              { c:'var(--amber)', l:'Okay', d:"You sort of knew it — back in 3 days" },
              { c:'#34d399', l:'Easy', d:"You knew it well — back in 7 days (then 17, 42…)" },
            ].map(({c,l,d}) => (
              <div key={l} style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                <span style={{ color:c,fontWeight:500,fontSize:12,minWidth:40 }}>{l}</span>
                <span style={{ color:'var(--text-3)',fontSize:12 }}>{d}</span>
              </div>
            ))}
          </div>
          <p>Cards you find hard come back sooner. Cards you know well disappear for longer. Over time you only see what you actually need to review. This is called <strong style={{ fontWeight:500,color:'var(--text-1)' }}>spaced repetition</strong> — the same method used by Anki and medical students worldwide.</p>
        </div>
      )}
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign:'center',padding:'48px 24px' }}>
      <div style={{ width:56,height:56,borderRadius:16,background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>
      <div style={{ fontFamily:'var(--font-display)',fontSize:20,color:'var(--text-1)',marginBottom:8 }}>No cards yet</div>
      <div style={{ fontSize:13,color:'var(--text-3)',fontWeight:300,lineHeight:1.7,maxWidth:300,margin:'0 auto' }}>
        Read a few pages in your <strong style={{ fontWeight:500,color:'var(--text-2)' }}>Library</strong>, then tap <strong style={{ fontWeight:500,color:'var(--text-2)' }}>Done</strong> when you finish. Cards are automatically created from what you just read — no manual work.
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Flashcards() {
  const [cards,    setCards]    = useState<Card[]>(load)
  const [selBook,  setSelBook]  = useState<string>('all')
  const [idx,      setIdx]      = useState(0)
  const [mode,     setMode]     = useState<'browse' | 'review'>('browse')
  const [done,     setDone]     = useState(false)

  // Listen for new cards generated by Library
  useEffect(() => {
    const handler = () => { setCards(load()); setIdx(0) }
    window.addEventListener('shh:cards-updated', handler)
    return () => window.removeEventListener('shh:cards-updated', handler)
  }, [])

  useEffect(() => { save(cards) }, [cards])

  const allBooks = books().filter(b => cards.some(c => c.bookId === b.id))
  const filtered = selBook === 'all' ? cards : cards.filter(c => c.bookId === selBook)
  const now      = Date.now()
  const dueQueue = filtered.filter(c => !c.nextReview || c.nextReview <= now)
  const display  = mode === 'review' ? dueQueue : filtered
  const current  = display[idx]

  const stats = {
    total:    filtered.length,
    due:      dueQueue.length,
    mastered: filtered.filter(c => c.reviewCount >= 3 && c.difficulty === 'easy').length,
    unseen:   filtered.filter(c => !c.reviewCount).length,
  }

  const rate = (d: 'easy' | 'medium' | 'hard') => {
    if (!current) return
    setCards(prev => prev.map(c => c.id === current.id ? { ...c, ...schedule(current, d) } : c))
    const next = idx + 1
    if (mode === 'review') {
      if (next >= dueQueue.length) { setDone(true); return }
    }
    if (next < display.length) setIdx(next)
  }

  const startReview = () => { setMode('review'); setIdx(0); setDone(false) }
  const clearBook   = (bookId: string) => { setCards(prev => prev.filter(c => c.bookId !== bookId)); setIdx(0) }

  return (
    <div className="page-scroll">
      <div style={{ maxWidth:640,margin:'0 auto',padding:'clamp(24px,4vw,44px) clamp(16px,4vw,44px) 120px' }}>

        {/* Header */}
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:30,letterSpacing:'-0.8px',color:'var(--text-1)',marginBottom:4 }}>Flashcards</div>
            <div style={{ fontSize:12,color:'var(--text-3)' }}>
              {stats.total > 0
                ? `${stats.total} card${stats.total!==1?'s':''} · ${stats.due > 0 ? `${stats.due} due` : 'all caught up ✓'}`
                : 'No cards yet'}
            </div>
          </div>
          {stats.due > 0 && (
            <button onClick={startReview}
              style={{ padding:'9px 18px',borderRadius:999,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 14px var(--accent-glow)',touchAction:'manipulation' }}>
              Review ({stats.due})
            </button>
          )}
        </div>

        <SRSExplainer />

        {/* Stats pills — only when cards exist */}
        {stats.total > 0 && (
          <div style={{ display:'flex',gap:7,flexWrap:'wrap',marginBottom:20 }}>
            {[
              { l:'Due',      v:stats.due,      c:'var(--accent)' },
              { l:'Unseen',   v:stats.unseen,   c:'var(--text-2)' },
              { l:'Mastered', v:stats.mastered, c:'var(--green)'  },
            ].map(({l,v,c})=>(
              <div key={l} style={{ display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:999,background:'var(--bg-card)',border:'0.5px solid var(--border)',fontSize:12 }}>
                <span style={{ color:'var(--text-3)' }}>{l}</span>
                <span style={{ fontWeight:500,color:c }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Book filter tabs */}
        {allBooks.length > 1 && (
          <div style={{ display:'flex',gap:5,flexWrap:'wrap',marginBottom:20 }}>
            <button onClick={()=>{setSelBook('all');setIdx(0)}} style={{ padding:'5px 13px',borderRadius:999,fontSize:12,cursor:'pointer',border:'0.5px solid var(--border)',fontFamily:'var(--font-body)',background:selBook==='all'?'var(--bg-pill)':'transparent',color:selBook==='all'?'var(--text-1)':'var(--text-3)',transition:'all .18s',touchAction:'manipulation' }}>
              All ({cards.length})
            </button>
            {allBooks.map(b=>(
              <button key={b.id} onClick={()=>{setSelBook(b.id);setIdx(0)}} style={{ padding:'5px 13px',borderRadius:999,fontSize:12,cursor:'pointer',border:'0.5px solid var(--border)',fontFamily:'var(--font-body)',background:selBook===b.id?'var(--bg-pill)':'transparent',color:selBook===b.id?'var(--text-1)':'var(--text-3)',transition:'all .18s',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',touchAction:'manipulation' }}>
                {b.title.length>20?b.title.slice(0,20)+'…':b.title}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : done ? (
          /* Session complete */
          <div style={{ textAlign:'center',padding:'48px 20px' }}>
            <div style={{ width:60,height:60,borderRadius:'50%',background:'var(--accent-soft)',border:'0.5px solid var(--border-active)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontFamily:'var(--font-display)',fontSize:24,color:'var(--text-1)',marginBottom:8,letterSpacing:'-0.5px' }}>Session done</div>
            <div style={{ fontSize:13,color:'var(--text-3)',marginBottom:24,lineHeight:1.6,fontWeight:300 }}>
              {stats.mastered > 0 ? `${stats.mastered} mastered · ` : ''}{dueQueue.length} cards will come back based on how you rated them.
            </div>
            <div style={{ display:'flex',gap:10,justifyContent:'center' }}>
              <button onClick={()=>{setIdx(0);setDone(false);setMode('review')}} style={{ padding:'10px 24px',borderRadius:999,background:'linear-gradient(135deg,var(--accent),#7b6cf6)',border:'none',color:'white',fontSize:14,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-body)',boxShadow:'0 4px 14px var(--accent-glow)',touchAction:'manipulation' }}>
                Review again
              </button>
              <button onClick={()=>{setMode('browse');setIdx(0);setDone(false)}} style={{ padding:'10px 24px',borderRadius:999,border:'0.5px solid var(--border)',background:'transparent',color:'var(--text-2)',fontSize:14,cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>
                Browse all
              </button>
            </div>
          </div>
        ) : current ? (
          <div>
            {/* Progress + nav */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
              <div style={{ display:'flex',gap:5 }}>
                <button onClick={()=>setMode(m=>m==='browse'?'review':'browse')} style={{ padding:'4px 12px',borderRadius:999,border:'0.5px solid var(--border)',background:'transparent',color:mode==='review'?'var(--accent)':'var(--text-3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>
                  {mode==='review'?'Review mode':'Browse mode'}
                </button>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ fontSize:12,color:'var(--text-3)' }}>{idx+1} / {display.length}</span>
                {[{d:-1,p:'15 18 9 12 15 6'},{d:1,p:'9 18 15 12 9 6'}].map(({d,p},i)=>(
                  <button key={i} onClick={()=>setIdx(n=>Math.max(0,Math.min(display.length-1,n+d)))} disabled={d===-1?idx===0:idx===display.length-1}
                    style={{ width:28,height:28,borderRadius:'50%',border:'0.5px solid var(--border)',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',opacity:(d===-1?idx===0:idx===display.length-1)?.3:1,color:'var(--text-2)',touchAction:'manipulation' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points={p}/></svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height:3,background:'var(--text-4)',borderRadius:99,overflow:'hidden',marginBottom:22 }}>
              <div style={{ height:'100%',width:`${((idx+1)/display.length)*100}%`,background:'linear-gradient(90deg,var(--accent),#b07ef7)',borderRadius:99,transition:'width .4s ease' }}/>
            </div>

            <FlipCard card={current} onRate={rate}/>

            {/* Delete book's cards option */}
            {allBooks.length > 0 && selBook !== 'all' && (
              <div style={{ textAlign:'center',marginTop:24 }}>
                <button onClick={()=>clearBook(selBook)} style={{ fontSize:11,color:'var(--text-3)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)',touchAction:'manipulation' }}>
                  Clear all cards for this book
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
