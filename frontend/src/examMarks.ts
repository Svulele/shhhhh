export type ExamMarkTag = 'high-yield' | 'likely-exam' | 'memorize' | 'weak-area'

export interface ExamMark {
  id: string
  bookId: string
  bookTitle: string
  page: number
  text: string
  tag: ExamMarkTag
  createdAt: number
}

export const EXAM_TAGS: Record<ExamMarkTag, { label: string; color: string; bg: string; border: string }> = {
  'high-yield': { label: 'High yield', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', border: 'rgba(245,158,11,.28)' },
  'likely-exam': { label: 'Likely exam', color: '#38bdf8', bg: 'rgba(56,189,248,.12)', border: 'rgba(56,189,248,.26)' },
  memorize: { label: 'Memorize', color: '#a78bfa', bg: 'rgba(167,139,250,.12)', border: 'rgba(167,139,250,.26)' },
  'weak-area': { label: 'Weak area', color: '#f87171', bg: 'rgba(248,113,113,.12)', border: 'rgba(248,113,113,.26)' },
}

const KEY = 'shh_exam_marks'

export function loadExamMarks(): ExamMark[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveExamMarks(marks: ExamMark[]) {
  localStorage.setItem(KEY, JSON.stringify(marks))
  window.dispatchEvent(new CustomEvent('shh:exam-marks-updated'))
}

export function addExamMark(mark: Omit<ExamMark, 'id' | 'createdAt'>) {
  const next: ExamMark = {
    ...mark,
    id: `exam_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  }
  saveExamMarks([next, ...loadExamMarks()].slice(0, 500))
  return next
}

export function deleteExamMark(id: string) {
  saveExamMarks(loadExamMarks().filter(mark => mark.id !== id))
}
