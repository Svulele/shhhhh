import { useState, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Note { id: string; bookId: string; page: number; text: string; createdAt: number }
interface Book { id: string; title: string; author: string }

// ── Storage ───────────────────────────────────────────────────
const loadNotes = (): Note[] => { try { return JSON.parse(localStorage.getItem('shh_notes') ?? '[]') } catch { return [] } }
const saveNotes = (n: Note[]) => { try { localStorage.setItem('shh_notes', JSON.stringify(n)) } catch {} }
const loadBooks = (): Book[] => { try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] } }

// ── Export helpers ─────────────────────────────────────────────
function exportAsText(notes: Note[], books: Book[]) {
  const byBook: Record<string, Note[]> = {}
  notes.forEach(n => { if (!byBook[n.bookId]) byBook[n.bookId] = []; byBook[n.bookId].push(n) })
  const lines: string[] = ['SHHHHH — MY STUDY NOTES', `Exported ${new Date().toLocaleDateString()}`, '']
  Object.entries(byBook).forEach(([bookId, bNotes]) => {
    const book = books.find(b => b.id === bookId)
    lines.push(`── ${book?.title ?? 'Unknown book'} ──`)
    bNotes.sort((a,b)=>a.page-b.page).forEach(n => {
      lines.push(`p.${n.page}  ${n.text}`)
    })
    lines.push('')
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'shhhhh-notes.txt'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Main ──────────────────────────────────────────────────────
export default function Notes() {
  const [notes,    setNotes]    = useState<Note[]>(loadNotes)
  const books                   = loadBooks()
  const [search,   setSearch]   = useState('')
  const [selBook,  setSelBook]  = useState<string>('all')
  const [sort,     setSort]     = useState<'newest' | 'oldest' | 'page'>('newest')
  const [editing,  setEditing]  = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const booksWithNotes = books.filter(b => notes.some(n => n.bookId === b.id))

  const filtered = useMemo(() => {
    let list = selBook === 'all' ? notes : notes.filter(n => n.bookId === selBook)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => n.text.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === 'newest') return b.createdAt - a.createdAt
      if (sort === 'oldest') return a.createdAt - b.createdAt
      return a.page - b.page
    })
  }, [notes, selBook, search, sort])

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id)
    setNotes(updated); saveNotes(updated)
  }

  const saveEdit = (id: string) => {
    if (!editText.trim()) return
    const updated = notes.map(n => n.id === id ? { ...n, text: editText.trim() } : n)
    setNotes(updated); saveNotes(updated); setEditing(null)
  }

  const getBook = (bookId: string) => books.find(b => b.id === bookId)

  const fmt = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 680, margin: '0 auto', padding: 'clamp(24px,4vw,44px) clamp(16px,4vw,44px) 120px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:30, letterSpacing:'-0.8px', color:'var(--text-1)', marginBottom:4 }}>Notes</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>
              {notes.length} note{notes.length !== 1 ? 's' : ''} across {booksWithNotes.length} book{booksWithNotes.length !== 1 ? 's' : ''}
            </div>
          </div>
          {notes.length > 0 && (
            <button onClick={() => exportAsText(filtered, books)}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px', borderRadius:999, border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', transition:'all .2s', touchAction:'manipulation' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          )}
        </div>

        {notes.length === 0 ? (
          /* Empty state */
          <div style={{ textAlign:'center', padding:'56px 24px' }}>
            <div style={{ width:56, height:56, borderRadius:16, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:20, color:'var(--text-1)', marginBottom:8 }}>No notes yet</div>
            <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:300, lineHeight:1.7, maxWidth:300, margin:'0 auto' }}>
              Open a book in your Library, tap the <strong style={{ fontWeight:500, color:'var(--text-2)' }}>Notes</strong> button while reading, and jot down anything worth remembering.
            </div>
          </div>
        ) : (
          <>
            {/* Search */}
            <div style={{ position:'relative', marginBottom:14 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" style={{ position:'absolute', left:13, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search your notes…"
                style={{ paddingLeft:36, borderRadius:12, fontSize:13 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', display:'flex', padding:2 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Filters row */}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:20, alignItems:'center' }}>
              {/* Book filter */}
              <button onClick={() => setSelBook('all')} style={{ padding:'5px 13px', borderRadius:999, fontSize:12, cursor:'pointer', border:'0.5px solid var(--border)', fontFamily:'var(--font-body)', background:selBook==='all'?'var(--bg-pill)':'transparent', color:selBook==='all'?'var(--text-1)':'var(--text-3)', transition:'all .18s', touchAction:'manipulation' }}>
                All books
              </button>
              {booksWithNotes.map(b => (
                <button key={b.id} onClick={() => setSelBook(b.id)} style={{ padding:'5px 13px', borderRadius:999, fontSize:12, cursor:'pointer', border:'0.5px solid var(--border)', fontFamily:'var(--font-body)', background:selBook===b.id?'var(--bg-pill)':'transparent', color:selBook===b.id?'var(--text-1)':'var(--text-3)', transition:'all .18s', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', touchAction:'manipulation' }}>
                  {b.title.length > 20 ? b.title.slice(0,20)+'…' : b.title}
                </button>
              ))}

              {/* Spacer */}
              <div style={{ flex:1 }}/>

              {/* Sort */}
              <select value={sort} onChange={e => setSort(e.target.value as any)}
                style={{ padding:'5px 10px', borderRadius:999, fontSize:11, cursor:'pointer', border:'0.5px solid var(--border)', background:'var(--bg-card)', color:'var(--text-2)', fontFamily:'var(--font-body)', outline:'none' }}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="page">By page</option>
              </select>
            </div>

            {/* No results */}
            {filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-3)', fontSize:13 }}>
                No notes match "{search}"
              </div>
            )}

            {/* Note cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(note => {
                const book = getBook(note.bookId)
                const isEditing = editing === note.id
                return (
                  <div key={note.id} style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:16, padding:'16px 18px', transition:'border-color .2s' }}>
                    {/* Top meta row */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                        <span style={{ fontSize:10, fontWeight:500, color:'var(--accent)', background:'var(--accent-soft)', padding:'2px 8px', borderRadius:999, whiteSpace:'nowrap' }}>
                          p.{note.page}
                        </span>
                        {book && (
                          <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:300, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {book.title.length > 28 ? book.title.slice(0,28)+'…' : book.title}
                          </span>
                        )}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0, marginLeft:8 }}>
                        <span style={{ fontSize:10, color:'var(--text-3)', marginRight:6 }}>{fmt(note.createdAt)}</span>
                        {/* Edit button */}
                        <button onClick={() => { setEditing(note.id); setEditText(note.text) }}
                          style={{ width:28, height:28, borderRadius:8, border:'none', background:'transparent', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .18s', touchAction:'manipulation' }}
                          onMouseEnter={e => { e.currentTarget.style.background='var(--bg-pill)'; e.currentTarget.style.color='var(--text-1)' }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-3)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {/* Delete button */}
                        <button onClick={() => deleteNote(note.id)}
                          style={{ width:28, height:28, borderRadius:8, border:'none', background:'transparent', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .18s', touchAction:'manipulation' }}
                          onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,.1)'; e.currentTarget.style.color='#f87171' }}
                          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-3)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Note text or edit field */}
                    {isEditing ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        <textarea value={editText} onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => { if (e.key==='Enter'&&(e.metaKey||e.ctrlKey)) saveEdit(note.id) }}
                          style={{ fontSize:14, fontWeight:300, lineHeight:1.65, resize:'none', minHeight:80, borderRadius:10 }}
                          autoFocus/>
                        <div style={{ display:'flex', gap:7 }}>
                          <button onClick={() => setEditing(null)} style={{ flex:1, padding:'7px', borderRadius:8, border:'0.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)', touchAction:'manipulation' }}>Cancel</button>
                          <button onClick={() => saveEdit(note.id)} style={{ flex:1, padding:'7px', borderRadius:8, background:'var(--accent-soft)', border:'0.5px solid var(--border-active)', color:'var(--accent)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-body)', touchAction:'manipulation' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize:14, color:'var(--text-1)', fontWeight:300, lineHeight:1.65 }}>
                        {note.text}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}