export type StudyEventType = 'reading' | 'focus' | 'flashcard'

export interface StudyEvent {
  id: string
  type: StudyEventType
  date: string
  timestamp: number
  bookId?: string
  bookTitle?: string
  fromPage?: number
  toPage?: number
  pages?: number
  seconds?: number
  rating?: 'easy' | 'medium' | 'hard'
}

interface BookSnapshot {
  id: string
  title: string
  author?: string
  totalPages?: number
  currentPage?: number
}

interface CardSnapshot {
  bookId: string
  bookTitle: string
  fromPage: number
  toPage: number
  difficulty: 'easy' | 'medium' | 'hard' | null
  reviewCount?: number
  reviewedAt?: number
}

interface ExamMarkSnapshot {
  bookId: string
  bookTitle: string
  page: number
  text: string
  tag: 'high-yield' | 'likely-exam' | 'memorize' | 'weak-area'
  createdAt: number
}

const EVENTS_KEY = 'shh_study_events'
const STUDY_TIME_KEY = 'shh_study_time'
const WEEKLY_SUMMARY_KEY = 'shh_weekly_ai_summaries'

function safeJSON<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return fallback }
}

function dateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function rangeStart(days: number) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  return start
}

function inLastDays(date: string, days: number) {
  return date >= rangeStart(days).toISOString().slice(0, 10)
}

function fmtHours(seconds: number) {
  if (seconds < 60) return `${seconds}s`
  const hours = seconds / 3600
  if (hours < 1) return `${Math.round(seconds / 60)}m`
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`
}

function clampPages(fromPage = 0, toPage = 0) {
  if (!fromPage || !toPage) return 0
  return Math.max(0, Math.abs(toPage - fromPage) + 1)
}

export function getStudyEvents(): StudyEvent[] {
  return safeJSON<StudyEvent[]>(EVENTS_KEY, [])
}

export function recordStudyEvent(event: Omit<StudyEvent, 'id' | 'date' | 'timestamp'> & { timestamp?: number }) {
  const timestamp = event.timestamp ?? Date.now()
  const next: StudyEvent = {
    ...event,
    id: `${timestamp}_${Math.random().toString(36).slice(2)}`,
    date: dateKey(timestamp),
    timestamp,
  }
  const events = [next, ...getStudyEvents()].slice(0, 700)
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  window.dispatchEvent(new CustomEvent('shh:study-history-updated'))
}

export function addStudySeconds(seconds: number) {
  if (seconds < 1) return
  const today = dateKey()
  const data = safeJSON<Record<string, number>>(STUDY_TIME_KEY, {})
  data[today] = (data[today] ?? 0) + seconds
  localStorage.setItem(STUDY_TIME_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('shh:study-history-updated'))
}

export function recordReadingSession(book: BookSnapshot, fromPage: number, toPage: number, seconds = 0) {
  const pages = clampPages(fromPage, toPage)
  if (pages <= 0 && seconds < 10) return
  recordStudyEvent({
    type: 'reading',
    bookId: book.id,
    bookTitle: book.title,
    fromPage: Math.min(fromPage, toPage),
    toPage: Math.max(fromPage, toPage),
    pages,
    seconds,
  })
}

export function recordFocusSession(seconds: number) {
  if (seconds < 60) return
  addStudySeconds(seconds)
  recordStudyEvent({ type: 'focus', seconds })
}

export function summarizeStudyJourney() {
  const events = getStudyEvents()
  const books = safeJSON<BookSnapshot[]>('shh_books', [])
  const notes = safeJSON<{ createdAt: number }[]>('shh_notes', [])
  const cards = safeJSON<CardSnapshot[]>('shh_flashcards', [])
  const examMarks = safeJSON<ExamMarkSnapshot[]>('shh_exam_marks', [])
  const time = safeJSON<Record<string, number>>(STUDY_TIME_KEY, {})

  const weekEvents = events.filter(e => inLastDays(e.date, 7))
  const monthEvents = events.filter(e => inLastDays(e.date, 30))
  const weekStart = rangeStart(7)
  const weekEnd = addDays(weekStart, 6)
  const monthStart = rangeStart(30)

  const sumPages = (list: StudyEvent[]) => list.reduce((sum, e) => sum + (e.type === 'reading' ? e.pages ?? 0 : 0), 0)
  const sumFocus = (days: number) => Object.entries(time)
    .filter(([date]) => inLastDays(date, days))
    .reduce((sum, [, seconds]) => sum + (seconds || 0), 0)

  const weekPages = sumPages(weekEvents)
  const monthPages = sumPages(monthEvents)
  const weekFocus = sumFocus(7)
  const monthFocus = sumFocus(30)
  const weekReviews = weekEvents.filter(e => e.type === 'flashcard').length
  const monthReviews = monthEvents.filter(e => e.type === 'flashcard').length
  const weekNotes = notes.filter(n => inLastDays(dateKey(n.createdAt), 7)).length
  const monthNotes = notes.filter(n => inLastDays(dateKey(n.createdAt), 30)).length
  const weekExamMarks = examMarks.filter(mark => inLastDays(dateKey(mark.createdAt), 7)).length
  const monthExamMarks = examMarks.filter(mark => inLastDays(dateKey(mark.createdAt), 30)).length

  const allTimePages = books.reduce((sum, b) => sum + Math.max(0, (b.currentPage ?? 1) - 1), 0)
  const remainingPages = books.reduce((sum, b) => sum + Math.max(0, (b.totalPages ?? 0) - (b.currentPage ?? 1)), 0)
  const activeBooks = books.filter(b => (b.currentPage ?? 1) > 1 && (b.currentPage ?? 1) < (b.totalPages ?? 0))
  const finishedBooks = books.filter(b => (b.totalPages ?? 0) > 0 && (b.currentPage ?? 1) >= (b.totalPages ?? 0)).length

  const hardByArea = cards
    .filter(c => c.difficulty === 'hard' && (c.reviewCount ?? 0) > 0)
    .reduce<Record<string, number>>((map, c) => {
      const title = c.bookTitle || books.find(b => b.id === c.bookId)?.title || 'your cards'
      const area = `${title}${c.fromPage ? ` p.${c.fromPage}-${c.toPage}` : ''}`
      map[area] = (map[area] ?? 0) + 1
      return map
    }, {})
  examMarks.filter(mark => mark.tag === 'weak-area').forEach(mark => {
    const title = mark.bookTitle || books.find(b => b.id === mark.bookId)?.title || 'Exam marks'
    const area = `${title} p.${mark.page}`
    hardByArea[area] = (hardByArea[area] ?? 0) + 1
  })
  const weakestArea = Object.entries(hardByArea).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const topBook = Object.entries(
    weekEvents.filter(e => e.type === 'reading' && e.bookTitle).reduce<Record<string, number>>((map, e) => {
      map[e.bookTitle!] = (map[e.bookTitle!] ?? 0) + (e.pages ?? 0)
      return map
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]

  const coverage = books
    .filter(b => (b.currentPage ?? 1) > 1)
    .slice(0, 3)
    .map(b => `${b.title}: p.${Math.max(1, b.currentPage ?? 1)} of ${b.totalPages ?? '?'}`)

  const weeklyText = weekPages || weekFocus || weekReviews || weekExamMarks
    ? `This week you logged ${weekPages} page${weekPages === 1 ? '' : 's'}, reviewed ${weekReviews} flashcard${weekReviews === 1 ? '' : 's'}, saved ${weekExamMarks} exam mark${weekExamMarks === 1 ? '' : 's'}, and studied for ${fmtHours(weekFocus)}. ${topBook ? `Most of your reading was in ${topBook[0]}.` : ''} ${weakestArea ? `Your weakest area is ${weakestArea}.` : 'No weak area yet. Mark weak content or rate a few cards and this will sharpen.'}`.trim()
    : 'Your weekly summary is ready to fill in. Read a few pages, mark exam content, review some cards, or run a focus session and Shhhhh will start connecting the dots.'

  return {
    weekLabel: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    monthLabel: `${monthStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - today`,
    weeklyText,
    weakestArea,
    coverage,
    stats: {
      weekPages,
      weekFocus,
      weekReviews,
      weekNotes,
      weekExamMarks,
      monthPages,
      monthFocus,
      monthReviews,
      monthNotes,
      monthExamMarks,
      allTimePages,
      remainingPages,
      activeBooks: activeBooks.length,
      finishedBooks,
    },
  }
}

export async function generateWeeklySummaryText(summary: ReturnType<typeof summarizeStudyJourney>): Promise<string> {
  const s = summary.stats
  if (!s.weekPages && !s.weekFocus && !s.weekReviews && !s.weekNotes && !s.weekExamMarks) return summary.weeklyText

  const signature = [
    summary.weekLabel,
    s.weekPages,
    s.weekFocus,
    s.weekReviews,
    s.weekNotes,
    s.weekExamMarks,
    s.remainingPages,
    summary.weakestArea ?? 'none',
  ].join('|')
  const cache = safeJSON<Record<string, string>>(WEEKLY_SUMMARY_KEY, {})
  if (cache[signature]) return cache[signature]

  try {
    const res = await fetch((import.meta.env.VITE_API_URL ?? 'http://localhost:3001') + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openrouter/auto',
        max_tokens: 180,
        system: 'You write concise, specific weekly study progress summaries. No markdown. No invented facts.',
        messages: [{
          role: 'user',
          content: `Write 2 warm, specific sentences for this weekly study summary.
Week: ${summary.weekLabel}
Pages read this week: ${s.weekPages}
Flashcards reviewed this week: ${s.weekReviews}
Notes created this week: ${s.weekNotes}
Exam marks saved this week: ${s.weekExamMarks}
Study time this week: ${fmtHours(s.weekFocus)}
Last 30 days: ${s.monthPages} pages, ${s.monthReviews} card reviews, ${s.monthExamMarks} exam marks, ${fmtHours(s.monthFocus)} study time
All-time known pages covered: ${s.allTimePages}
Pages still to do: ${s.remainingPages}
Weakest area: ${summary.weakestArea ?? 'Not enough hard-rated cards yet'}
Current coverage: ${summary.coverage.join('; ') || 'No active book progress yet'}`
        }]
      })
    })
    if (!res.ok) return summary.weeklyText
    const data = await res.json()
    const text = (data.content ?? []).map((part: any) => part.text ?? '').join('').trim()
    if (!text) return summary.weeklyText
    localStorage.setItem(WEEKLY_SUMMARY_KEY, JSON.stringify({ ...cache, [signature]: text }))
    return text
  } catch {
    return summary.weeklyText
  }
}
