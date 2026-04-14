import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Book { id: string; title: string; author: string; totalPages: number; currentPage: number }
interface Card {
  id: string; bookId: string; bookTitle: string
  front: string; back: string
  fromPage: number; toPage: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  createdAt: number
  nextReview: number   // timestamp — 0 means due now
  interval: number     // days until next review
  reviewCount: number  // total times reviewed
}

// ── Spaced repetition scheduling (SM-2 simplified) ────────────
// Hard  → review again tomorrow (1 day)
// Okay  → review in 3 days (or interval * 1.5)
// Easy  → review in 7 days (or interval * 2.5)
function scheduleCard(card: Card, rating: 'easy' | 'medium' | 'hard'): Partial<Card> {
  const now      = Date.now()
  const interval = card.interval || 1
  let nextInterval: number
  if      (rating === 'hard')   nextInterval = 1
  else if (rating === 'medium') nextInterval = Math.max(3, Math.round(interval * 1.5))
  else                          nextInterval = Math.max(7, Math.round(interval * 2.5))
  return {
    difficulty:   rating,
    interval:     nextInterval,
    nextReview:   now + nextInterval * 86400000,
    reviewCount: (card.reviewCount || 0) + 1,
  }
}

// ── Storage ───────────────────────────────────────────────────
const CK = 'shh_flashcards'
const loadCards = (): Card[] => { try { return JSON.parse(localStorage.getItem(CK) ?? '[]') } catch { return [] } }
const saveCards = (c: Card[]) => { try { localStorage.setItem(CK, JSON.stringify(c)) } catch {} }
const loadBooks = (): Book[] => { try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] } }

// ── Generate cards from a reading session ─────────────────────
// Uses AI knowledge of the book + page range — no manual notes needed
async function generateFromSession(
  book: Book, fromPage: number, toPage: number
): Promise<Omit<Card, 'id' | 'createdAt'>[]> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `The reader just read pages ${fromPage}–${toPage} of "${book.title}" by ${book.author} (total ${book.totalPages} pages).

Based on your knowledge of this book, create 6–8 flashcards that test the key ideas, concepts, terms, and arguments from that section.

Rules:
- Cards must be specific to what those pages cover
- Front: a clear question, fill-in-the-blank, or "what is…" prompt
- Back: concise answer, 1–3 sentences max
- Mix factual recall AND conceptual understanding
- Don't create cards for things covered outside those pages

Respond ONLY with a JSON array, no markdown, no extra text:
[{"front":"…","back":"…"},…]`
      }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const text = (data.content ?? []).map((c: any) => c.text ?? '').join('')
  const parsed: { front: string; back: string }[] = JSON.parse(text.replace(/```json|```/g, '').trim())
  return parsed.map(c => ({
    bookId: book.id, bookTitle: book.title,
    front: c.front, back: c.back,
    fromPage, toPage, difficulty: null,
  }))
}

// ── Flip card component ───────────────────────────────────────
function FlipCard({ card, onRate }: { card: Card; onRate: (d: 'easy' | 'medium' | 'hard') => void }) {
  const [flipped, setFlipped] = useState(false)

  // Reset flip when card changes
  useEffect(() => { setFlipped(false) }, [card.id])

  return (
    <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
      {/* Perspective wrapper */}
      <div
        onClick={() => setFlipped(f => !f)}
        style={{
          cursor: 'pointer',
          perspective: '1200px',
          height: 'clamp(220px, 35vh, 300px)',
          position: 'relative',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.42s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Front face */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: 22, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 18 }}>
              Question · p.{card.fromPage}–{card.toPage}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 'clamp(15px,2vw,21px)',
              color: 'var(--text-1)', textAlign: 'center', lineHeight: 1.45, letterSpacing: '-0.2px',
            }}>
              {card.front}
            </div>
            <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Tap to reveal
            </div>
          </div>

          {/* Back face */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)',
            borderRadius: 22, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 18 }}>Answer</div>
            <div style={{
              fontSize: 'clamp(14px,1.8vw,17px)', color: 'var(--text-1)',
              textAlign: 'center', lineHeight: 1.7, fontWeight: 300,
            }}>
              {card.back}
            </div>
          </div>
        </div>
      </div>

      {/* Rating — slides in after flip */}
      <div style={{
        display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18,
        opacity: flipped ? 1 : 0, transform: flipped ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity .28s ease, transform .28s ease',
        pointerEvents: flipped ? 'auto' : 'none',
      }}>
        {[
          { d: 'hard',   label: '😓 Hard',   bg: 'rgba(239,68,68,.1)',   border: 'rgba(239,68,68,.25)',  color: '#f87171' },
          { d: 'medium', label: '🤔 Okay',   bg: 'rgba(245,158,11,.1)',  border: 'rgba(245,158,11,.25)', color: 'var(--amber)' },
          { d: 'easy',   label: '✅ Easy',   bg: 'rgba(52,211,153,.1)',  border: 'rgba(52,211,153,.25)', color: '#34d399' },
        ].map(({ d, label, bg, border, color }) => (
          <button key={d}
            onClick={e => { e.stopPropagation(); onRate(d as any) }}
            style={{
              padding: '10px 22px', borderRadius: 999, background: bg,
              border: `0.5px solid ${border}`, color, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .18s',
            }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-3)' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>🃏</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-2)', marginBottom: 8 }}>No flashcards yet</div>
      <div style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
        Finish a reading session in your Library — at the end, cards are automatically created from what you just read.
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function Flashcards() {
  const [cards,   setCards]   = useState<Card[]>(loadCards)
  const [books]               = useState<Book[]>(loadBooks)
  const [selBook, setSelBook] = useState<string>('all')
  const [idx,     setIdx]     = useState(0)
  const [mode,    setMode]    = useState<'browse' | 'review'>('browse')
  const [done,    setDone]    = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState<string | null>(null)

  useEffect(() => { saveCards(cards) }, [cards])

  // Also expose generate function so Library recap can call it
  // It writes cards to localStorage — they appear here on next render
  ;(window as any).__shh_generateCards = async (book: Book, fromPage: number, toPage: number) => {
    setGenerating(true); setGenError(null)
    try {
      const newCards = await generateFromSession(book, fromPage, toPage)
      const stamped  = newCards.map(c => ({ ...c, id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, createdAt: Date.now(), nextReview: 0, interval: 1, reviewCount: 0 }))
      setCards(prev => {
        // Replace cards for this session (same book + overlapping page range)
        const filtered = prev.filter(c => !(c.bookId === book.id && c.fromPage === fromPage && c.toPage === toPage))
        return [...filtered, ...stamped]
      })
    } catch (e: any) {
      setGenError('Could not generate cards. Check your API connection.')
      console.warn('Flashcard gen error:', e)
    }
    setGenerating(false)
  }

  const filtered = selBook === 'all' ? cards : cards.filter(c => c.bookId === selBook)
  const now      = Date.now()
  // Due = never reviewed (nextReview===0) OR nextReview timestamp has passed
  const reviewQ  = filtered.filter(c => !c.nextReview || c.nextReview <= now)
  const display  = mode === 'review' ? reviewQ : filtered
  const current  = display[idx]

  const stats = {
    total:    filtered.length,
    due:      reviewQ.length,
    mastered: filtered.filter(c => c.difficulty === 'easy' && c.reviewCount && c.reviewCount >= 3).length,
    unseen:   filtered.filter(c => !c.nextReview || c.nextReview === 0).length,
  }

  const rate = (difficulty: 'easy' | 'medium' | 'hard') => {
    if (!current) return
    const scheduled = scheduleCard(current, difficulty)
    setCards(prev => prev.map(c => c.id === current.id ? { ...c, ...scheduled } : c))
    const next = idx + 1
    if (mode === 'review' && next >= reviewQ.length) { setDone(true); return }
    if (next < display.length) setIdx(next)
  }

  const booksWithCards = books.filter(b => cards.some(c => c.bookId === b.id))

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px clamp(16px,4vw,40px) 120px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.5px', color: 'var(--text-1)' }}>Flashcards</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
              {stats.total} card{stats.total !== 1 ? 's' : ''}
              {stats.due > 0 ? ` · ${stats.due} due` : ' · all caught up ✓'}
              {stats.unseen > 0 ? ` · ${stats.unseen} new` : ''}
            </div>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={() => { setMode('review'); setIdx(0); setDone(false) }}
              style={{ padding: '9px 18px', borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', border: 'none', color: 'white', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 4px 14px var(--accent-glow)', transition: 'all .2s' }}>
              {reviewQ.length > 0 ? `Review (${reviewQ.length} due)` : '✓ All caught up'}
            </button>
          )}
        </div>

        {/* How it works banner — shown when empty */}
        {cards.length === 0 && !generating && <EmptyState />}

        {/* Generating spinner */}
        {generating && (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', margin: '0 auto 16px', animation: 'pulse 1.2s ease-in-out infinite' }} />
            <div style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 300 }}>Generating cards from your session…</div>
          </div>
        )}

        {genError && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,.08)', border: '0.5px solid rgba(239,68,68,.2)', fontSize: 13, color: '#fca5a5', marginBottom: 20 }}>
            {genError}
            <button onClick={() => setGenError(null)} style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>Dismiss</button>
          </div>
        )}

        {/* Book filter tabs */}
        {booksWithCards.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
            <button onClick={() => { setSelBook('all'); setIdx(0) }}
              style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '0.5px solid var(--border)', fontFamily: 'var(--font-body)', background: selBook === 'all' ? 'var(--bg-pill)' : 'transparent', color: selBook === 'all' ? 'var(--text-1)' : 'var(--text-3)', transition: 'all .18s' }}>
              All ({cards.length})
            </button>
            {booksWithCards.map(b => (
              <button key={b.id} onClick={() => { setSelBook(b.id); setIdx(0) }}
                style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: '0.5px solid var(--border)', fontFamily: 'var(--font-body)', background: selBook === b.id ? 'var(--bg-pill)' : 'transparent', color: selBook === b.id ? 'var(--text-1)' : 'var(--text-3)', transition: 'all .18s', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {b.title.length > 20 ? b.title.slice(0, 20) + '…' : b.title}
              </button>
            ))}
          </div>
        )}

        {/* Card display */}
        {!generating && filtered.length > 0 && (
          done ? (
            /* Session complete */
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🎉</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--text-1)', marginBottom: 8, letterSpacing: '-0.5px' }}>Session complete</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 28, lineHeight: 1.6 }}>
                Easy: {stats.easy} · Hard: {stats.hard} · Remaining: {reviewQ.length}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={() => { setIdx(0); setDone(false); setMode('review') }}
                  style={{ padding: '10px 24px', borderRadius: 999, background: 'linear-gradient(135deg,var(--accent),#7b6cf6)', border: 'none', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)', boxShadow: '0 4px 14px var(--accent-glow)' }}>
                  Review again
                </button>
                <button onClick={() => { setMode('browse'); setIdx(0); setDone(false) }}
                  style={{ padding: '10px 24px', borderRadius: 999, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Browse all
                </button>
              </div>
            </div>
          ) : current ? (
            <div>
              {/* Progress + nav */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <button onClick={() => setMode(m => m === 'browse' ? 'review' : 'browse')}
                    style={{ padding: '4px 12px', borderRadius: 999, border: '0.5px solid var(--border)', background: 'transparent', color: mode === 'review' ? 'var(--accent)' : 'var(--text-3)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {mode === 'review' ? '📚 Review mode' : '🔀 Browse mode'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{idx + 1} / {display.length}</span>
                  <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-2)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button onClick={() => setIdx(i => Math.min(display.length - 1, i + 1))} disabled={idx === display.length - 1}
                    style={{ width: 28, height: 28, borderRadius: '50%', border: '0.5px solid var(--border)', background: 'transparent', cursor: idx === display.length - 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === display.length - 1 ? 0.3 : 1, color: 'var(--text-2)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 3, background: 'var(--text-4)', borderRadius: 99, overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ height: '100%', width: `${((idx + 1) / display.length) * 100}%`, background: 'linear-gradient(90deg,var(--accent),#b07ef7)', borderRadius: 99, transition: 'width .4s ease' }} />
              </div>

              <FlipCard card={current} onRate={rate} />
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}