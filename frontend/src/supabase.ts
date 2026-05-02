import { createClient, type User } from '@supabase/supabase-js'

// ── ENV ──────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export const isCloudModeEnabled = !!supabase

// ── STORAGE KEYS ─────────────────────────────────────────────
const PROFILE_KEY = 'shh_profile'
const STREAK_KEY = 'shh_streak'
const STUDY_DAYS_KEY = 'shh_study_days'
const STUDY_TIME_KEY = 'shh_study_time'

// ── TYPES ────────────────────────────────────────────────────
export interface CloudProfile {
  name: string
  ai: string
  vibe: string
  goals: string[]
  location: string
  lat: number | null
  lon: number | null
}

// ── SAFE HELPERS ─────────────────────────────────────────────
function safeJSON<T>(value: string | null, fallback: T): T {
  try { return value ? JSON.parse(value) : fallback } catch { return fallback }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ── LOCAL STORAGE ────────────────────────────────────────────
function getLocalProfile(): CloudProfile | null {
  return safeJSON(localStorage.getItem(PROFILE_KEY), null)
}

function setLocalProfile(profile: any) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

function getLocalStudyDays(): string[] {
  return safeJSON(localStorage.getItem(STUDY_DAYS_KEY), [])
}

function setLocalStudyDays(days: string[]) {
  localStorage.setItem(STUDY_DAYS_KEY, JSON.stringify(days))
}

function getLocalStudyTime(): Record<string, number> {
  return safeJSON(localStorage.getItem(STUDY_TIME_KEY), {})
}

function setLocalStreak(n: number) {
  localStorage.setItem(STREAK_KEY, String(n))
}

// ── STREAK LOGIC (SHARED) ───────────────────────────────────
function computeStreak(days: string[]): number {
  if (!days.length) return 0

  const set = new Set(days)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function recordLocalStudyDay() {
  const today = todayISO()
  const days = getLocalStudyDays()

  if (!days.includes(today)) {
    const updated = [today, ...days].sort((a, b) => b.localeCompare(a))
    setLocalStudyDays(updated)
    setLocalStreak(computeStreak(updated))
  }
}

// ── AUTH ────────────────────────────────────────────────────
function requireClient() {
  if (!supabase) throw new Error('Cloud unavailable')
  return supabase
}

export async function getUser(): Promise<User | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function signInWithGoogle() {
  const client = requireClient()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string) {
  const client = requireClient()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error) throw error
  return data // includes user + session (may be null)
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

// ── PROFILE ─────────────────────────────────────────────────
export async function loadProfile(userId: string): Promise<CloudProfile | null> {
  if (!supabase) return getLocalProfile()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function saveProfile(userId: string, profile: CloudProfile) {
  setLocalProfile(profile)

  if (!supabase) return

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profile, updated_at: new Date().toISOString() })

  if (error) console.warn('Profile save failed:', error.message)
}

export async function syncProfile(userId: string) {
  const local = getLocalProfile()

  if (!supabase) {
    if (local) setLocalProfile({ ...local, onboarded: true })
    setLocalStreak(computeStreak(getLocalStudyDays()))
    return
  }

  const cloud = await loadProfile(userId)

  if (cloud) {
    setLocalProfile({ ...(local ?? {}), ...cloud, onboarded: true })
  } else if (local?.name) {
    await saveProfile(userId, local)
  }

  setLocalStreak(await getStreak(userId))
}

// ── STUDY DAYS / STREAK ─────────────────────────────────────
export async function recordStudyDay(userId?: string) {
  recordLocalStudyDay()

  if (!supabase || !userId) return

  const { error } = await supabase
    .from('study_days')
    .upsert({ user_id: userId, study_date: todayISO() }, { onConflict: 'user_id,study_date' })

  if (error) console.warn('Study day sync failed:', error.message)
}

export async function getStreak(userId: string): Promise<number> {
  if (!supabase) return computeStreak(getLocalStudyDays())

  const { data, error } = await supabase
    .from('study_days')
    .select('study_date')
    .eq('user_id', userId)

  if (error) throw error
  if (!data?.length) return 0

  return computeStreak(data.map(d => d.study_date))
}

// ── STUDY TIME ──────────────────────────────────────────────
export async function syncStudyTime(userId: string) {
  const today = todayISO()
  const secs = getLocalStudyTime()[today] ?? 0

  if (secs < 10 || !supabase) return

  await supabase.from('study_time').upsert(
    { user_id: userId, study_date: today, seconds: secs },
    { onConflict: 'user_id,study_date' }
  )
}

export async function getTodayStudyTime(userId: string) {
  const today = todayISO()

  if (!supabase) return getLocalStudyTime()[today] ?? 0

  const { data } = await supabase
    .from('study_time')
    .select('seconds')
    .eq('user_id', userId)
    .eq('study_date', today)
    .single()

  return (data as any)?.seconds ?? 0
}

export async function getWeekStudyTime(userId: string) {
  const map = getLocalStudyTime()
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  if (!supabase) {
    return Object.entries(map)
      .filter(([d]) => d >= weekAgo)
      .reduce((s, [, v]) => s + (v || 0), 0)
  }

  const { data } = await supabase
    .from('study_time')
    .select('seconds')
    .eq('user_id', userId)
    .gte('study_date', weekAgo)

  return (data ?? []).reduce((s: number, r: any) => s + (r.seconds ?? 0), 0)
}

// ── FEEDBACK ────────────────────────────────────────────────
export async function submitFeedback(message: string, name?: string, userId?: string) {
  if (!supabase) return

  await supabase.from('feedback').insert({
    message,
    name: name || 'Anonymous',
    user_id: userId || null,
  })
}
