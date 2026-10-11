import { useState, useEffect } from 'react'
import type { Page } from '../App'

// ── Types ─────────────────────────────────────────────────────
interface PlanItem {
  id: string
  type: 'read' | 'review' | 'chat' | 'focus' | 'custom'
  title: string
  detail: string
  duration: number   // minutes
  emoji?: string
  page?: Page
  done: boolean
}

interface DayPlan {
  date: string
  greeting: string
  focus: string      // one-line focus for today
  items: PlanItem[]
  generatedAt: number
}

// ── Storage ───────────────────────────────────────────────────
const PLAN_KEY = 'shh_daily_plan'

const loadPlan = (): DayPlan | null => {
  try {
    const p = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null')
    if (!p) return null
    // Stale after midnight
    if (p.date !== new Date().toISOString().split('T')[0]) return null
    return p
  } catch { return null }
}

const savePlan = (p: DayPlan) => {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)) } catch {}
}

const getProfile = () => {
  try { return JSON.parse(localStorage.getItem('shh_profile') ?? '{}') } catch { return {} }
}

const getBooks = () => {
  try { return JSON.parse(localStorage.getItem('shh_books') ?? '[]') } catch { return [] }
}

const getStudyTime = () => {
  try { return JSON.parse(localStorage.getItem('shh_study_time') ?? '{}') } catch { return {} }
}

const getStreak = () => Number(localStorage.getItem('shh_streak') ?? 0)

const getCards = () => {
  try { return JSON.parse(localStorage.getItem('shh_flashcards') ?? '[]') } catch { return [] }
}

// ── Generate plan via AI ──────────────────────────────────────
async function generatePlan(): Promise<DayPlan> {
  const profile  = getProfile()
  const books    = getBooks()
  const timeData = getStudyTime()
  const streak   = getStreak()
  const cards    = getCards()

  const today      = new Date().toISOString().split('T')[0]
  const hour       = new Date().getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Build context for AI
  const inProgress = books.filter((b: any) => b.currentPage > 1 && b.currentPage < b.totalPages)
  const dueCards   = cards.filter((c: any) => c.nextReview && c.nextReview <= Date.now()).length
  const todaySecs  = timeData[today] ?? 0
  const weekSecs   = Object.entries(timeData)
    .filter(([d]) => d >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
    .reduce((s, [, v]) => s + (v as number), 0)

  const context = `
User: ${profile.name || 'student'}, vibe: ${profile.vibe || 'balanced'}, goals: ${profile.goals?.join(', ') || 'general study'}
Streak: ${streak} days
Books in progress: ${inProgress.map((b: any) => `"${b.title}" (${b.currentPage}/${b.totalPages} pages, ${Math.round(b.currentPage/b.totalPages*100)}%)`).join(', ') || 'none'}
Flashcards due for review: ${dueCards}
Study time today: ${Math.round(todaySecs / 60)} minutes
Study time this week: ${Math.round(weekSecs / 3600 * 10) / 10} hours
Time of day: ${greeting.toLowerCase()}
`.trim()

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are a study planner. Based on this context, create a realistic daily study plan.

${context}

Create 3–5 specific, actionable study tasks for today. Be concrete — reference actual books and page ranges if books are in progress.

Rules:
- Tasks should be achievable in one day
- Mix different activity types (reading, reviewing, AI chat, focus sessions)
- Keep tasks short and motivating
- One-line "focus" message for the day, personalised to their vibe

Respond ONLY with JSON, no markdown:
{
  "focus": "one motivating sentence for today",
  "items": [
    {
      "type": "read|review|chat|focus|custom",
      "title": "short task title",
      "detail": "specific description, e.g. 'Read pages 48–70 of Nelson Pediatrics'",
      "duration": 25
    }
  ]
}`
        }]
      })
    })

    const data   = await res.json()
    if (data.error) throw new Error(data.error.message)
    const text   = (data.content ?? []).map((c: any) => c.text ?? '').join('')
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

    const pageMap: Record<string, Page> = {
      read: 'library', review: 'flashcards', chat: 'chat', focus: 'pomodoro',
    }

    return {
      date: today,
      greeting,
      focus: parsed.focus,
      items: parsed.items.map((it: any, i: number) => ({
        id: `plan_${i}`,
        type: it.type,
        title: it.title,
        detail: it.detail,
        duration: it.duration ?? 25,
        page: pageMap[it.type],
        done: false,
      })),
      generatedAt: Date.now(),
    }
  } catch {
    // Fallback plan if AI fails
    const fallbackItems: PlanItem[] = []

    if (inProgress.length > 0) {
      const b = inProgress[0]
      const pagesLeft = b.totalPages - b.currentPage
      const pagesTarget = Math.min(20, pagesLeft)
      fallbackItems.push({
        id: 'p0', type: 'read',
        title: `Continue "${b.title}"`,
        detail: `Read pages ${b.currentPage}–${b.currentPage + pagesTarget}`,
        duration: 30, page: 'library', done: false,
      })
    }

    if (dueCards > 0) {
      fallbackItems.push({
        id: 'p1', type: 'review',
        title: 'Review flashcards',
        detail: `${dueCards} card${dueCards > 1 ? 's' : ''} due today`,
        duration: 15, page: 'flashcards', done: false,
      })
    }

    fallbackItems.push({
      id: 'p2', type: 'focus',
      title: 'Deep focus session',
      detail: 'Start a 25-minute Pomodoro timer',
      duration: 25, page: 'pomodoro', done: false,
    })

    fallbackItems.push({
      id: 'p3', type: 'chat',
      title: 'Ask the AI a question',
      detail: 'Review something you read recently',
      duration: 10, page: 'chat', done: false,
    })

    return {
      date: today,
      greeting,
      focus: "One step at a time — let's make today count.",
      items: fallbackItems,
      generatedAt: Date.now(),
    }
  }
}

// ── Type icons + colours ──────────────────────────────────────
const TYPE_CONFIG = {
  read:   { emoji: '📖', color: '#b07ef7', bg: 'rgba(160,100,220,.1)'  },
  review: { emoji: '🃏', color: 'var(--accent)', bg: 'rgba(99,140,245,.1)' },
  chat:   { emoji: '🤖', color: '#38bdf8', bg: 'rgba(56,189,248,.1)'   },
  focus:  { emoji: '⏱',  color: '#3ecfa0', bg: 'rgba(52,207,160,.1)'   },
  custom: { emoji: '✨', color: 'var(--amber)', bg: 'rgba(245,158,11,.1)' },
}

// ── Main StudyPlan page ───────────────────────────────────────
export default function StudyPlan({ setPage }: { setPage: (p: Page) => void }) {
  const [plan,         setPlan]         = useState<DayPlan | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const todaySecs = (() => {
    const d = getStudyTime()
    return d[new Date().toISOString().split('T')[0]] ?? 0
  })()

  const streak = getStreak()

  useEffect(() => {
    const cached = loadPlan()
    if (cached) { setPlan(cached); return }
    generate()
  }, [])

  const generate = async () => {
    setLoading(true); setError(null)
    try {
      const p = await generatePlan()
      savePlan(p); setPlan(p)
    } catch (e: any) {
      setError('Could not generate plan. Check your connection.')
    }
    setLoading(false)
  }

  const toggleDone = (id: string) => {
    if (!plan) return
    const updated = { ...plan, items: plan.items.map(it => it.id === id ? { ...it, done: !it.done } : it) }
    setPlan(updated); savePlan(updated)
  }

  const doneCount  = plan?.items.filter(i => i.done).length ?? 0
  const totalCount = plan?.items.length ?? 0
  const pct        = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const fmtTime = (secs: number) => {
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.round(secs / 60)}m`
    return `${(secs / 3600).toFixed(1)}h`
  }

  return (
    <div className="page-scroll">
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px clamp(16px,4vw,40px) 120px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '-0.5px', color: 'var(--text-1)' }}>
              {plan ? `${plan.greeting}` : 'Your plan'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
              {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
            </div>
          </div>
          <button onClick={generate} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-2)', fontSize: 12, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-body)', opacity: loading ? 0.5 : 1, transition: 'all .2s' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            {loading ? 'Generating…' : 'Refresh'}
          </button>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
          {[
            { label: 'Streak',    val: `${streak}🔥`,    color: 'var(--amber)'  },
            { label: 'Today',     val: fmtTime(todaySecs), color: 'var(--accent)' },
            { label: 'Progress',  val: `${pct}%`,          color: 'var(--green)'  },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 14, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 5 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '-0.5px', color: s.color, lineHeight: 1 }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '56px 0' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', margin: '0 auto 14px', animation: 'pulse 1.2s ease-in-out infinite' }} />
            <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 300 }}>Building your personalised plan…</div>
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,.08)', border: '0.5px solid rgba(239,68,68,.2)', fontSize: 13, color: '#fca5a5', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {/* Focus sentence */}
        {plan && !loading && (
          <>
            <div style={{ background: 'var(--accent-soft)', border: '0.5px solid var(--border-active)', borderRadius: 16, padding: '16px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>Today's focus</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text-1)', lineHeight: 1.45, letterSpacing: '-0.2px' }}>
                {plan.focus}
              </div>
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 7 }}>
                  <span>{doneCount} of {totalCount} tasks done</span>
                  <span>{pct}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--text-4)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,var(--accent),#b07ef7)', borderRadius: 99, transition: 'width .6s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            )}

            {/* Task list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plan.items.map(item => {
                const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.custom
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    background: 'var(--bg-card)', border: `0.5px solid ${item.done ? 'var(--border)' : 'var(--border)'}`,
                    borderRadius: 16, padding: '16px 18px',
                    opacity: item.done ? 0.55 : 1, transition: 'all .2s',
                  }}>
                    {/* Checkbox */}
                    <button onClick={() => toggleDone(item.id)}
                      style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s', border: `1.5px solid ${item.done ? 'var(--green)' : 'var(--border)'}`, background: item.done ? 'var(--green)' : 'transparent' }}>
                      {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    </button>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.title}</span>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 500 }}>{cfg.emoji} {item.duration}m</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 300, lineHeight: 1.5 }}>{item.detail}</div>
                    </div>

                    {/* Go button */}
                    {item.page && !item.done && (
                      <button onClick={() => setPage(item.page!)}
                        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%', border: `0.5px solid ${cfg.color}`, background: cfg.bg, color: cfg.color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* All done! */}
            {doneCount === totalCount && totalCount > 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0 0' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-1)', marginBottom: 6 }}>All done for today!</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 300 }}>Come back tomorrow for a fresh plan.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
