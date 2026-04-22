import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to frontend/.env, then restart the Vite dev server. Running in local-only mode for now.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? (() => {
      try {
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      } catch (error) {
        console.warn('Supabase client init failed. Running in local-only mode.', error)
        return null
      }
    })()
  : null

export const isCloudModeEnabled = supabase !== null

const PROFILE_KEY = 'shh_profile'
const STREAK_KEY = 'shh_streak'
const STUDY_DAYS_KEY = 'shh_study_days'
const STUDY_TIME_KEY = 'shh_study_time'

function getLocalProfile(): CloudProfileInput | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CloudProfileInput
  } catch (error) {
    console.warn('Local profile read failed:', error)
    return null
  }
}

function getLocalStudyDays(): string[] {
  try {
    const raw = localStorage.getItem(STUDY_DAYS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch (error) {
    console.warn('Local study days read failed:', error)
    return []
  }
}

function setLocalStreak(streak: number) {
  localStorage.setItem(STREAK_KEY, String(streak))
}

function computeStreakFromDays(days: string[]): number {
  if (!days.length) return 0

  const dates = new Set(days)
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function recordLocalStudyDay() {
  const today = new Date().toISOString().slice(0, 10)
  const days = getLocalStudyDays()
  if (!days.includes(today)) {
    const nextDays = [today, ...days].sort((a, b) => b.localeCompare(a))
    localStorage.setItem(STUDY_DAYS_KEY, JSON.stringify(nextDays))
    setLocalStreak(computeStreakFromDays(nextDays))
    return
  }

  setLocalStreak(computeStreakFromDays(days))
}

function getLocalStudyTimeMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STUDY_TIME_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch (error) {
    console.warn('Local study time read failed:', error)
    return {}
  }
}

function requireSupabaseForAuth() {
  if (supabase) return supabase
  throw new Error('Cloud sync is unavailable right now. You can continue in local-only mode.')
}

export interface CloudProfileInput {
  name: string
  ai: string
  vibe: string
  goals: string[]
  location: string
  lat: number | null
  lon: number | null
}

export async function saveCloudProfile(userId: string, profile: CloudProfileInput) {
  if (!supabase) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...profile, id: userId }))
    return
  }

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profile }, { onConflict: 'id' })

  if (error) throw error
}

export async function signInWithGoogle() {
  const client = requireSupabaseForAuth()
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const client = requireSupabaseForAuth()
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string) {
  const client = requireSupabaseForAuth()
  const { error } = await client.auth.signUp({
    email,
    password,
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return

  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadCloudProfile(userId: string): Promise<CloudProfileInput | null> {
  if (!supabase) {
    return getLocalProfile()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as CloudProfileInput | null
}

export async function recordStudyDay(userId?: string) {
  if (!supabase) {
    recordLocalStudyDay()
    return
  }

  if (!userId) {
    throw new Error('A user id is required when cloud sync is enabled.')
  }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('study_days')
    .upsert({ user_id: userId, study_date: today }, { onConflict: 'user_id,study_date' })

  if (error) throw error
}

export async function getStreak(userId: string): Promise<number> {
  if (!supabase) {
    const streak = computeStreakFromDays(getLocalStudyDays())
    setLocalStreak(streak)
    return streak
  }

  const { data, error } = await supabase
    .from('study_days')
    .select('study_date')
    .eq('user_id', userId)
    .order('study_date', { ascending: false })
    .limit(365)

  if (error) throw error
  if (!data?.length) return 0

  const dates = new Set(data.map(row => row.study_date))
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  let streak = 0
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
export async function syncProfile(userId: string): Promise<void> {
  const local = localStorage.getItem(PROFILE_KEY)
  const localP = local ? JSON.parse(local) : null

  if (!supabase) {
    if (localP?.name) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...localP, onboarded: true }))
    }
    const streak = computeStreakFromDays(getLocalStudyDays())
    setLocalStreak(streak)
    return
  }
 
  const cloud = await loadCloudProfile(userId)
 
  if (cloud) {
    // Cloud is source of truth — merge into local
    const merged = { ...(localP ?? {}), ...cloud, onboarded: true }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(merged))
  } else if (localP?.name) {
    // No cloud profile yet — push local to cloud
    await saveCloudProfile(userId, {
      name: localP.name, ai: localP.ai ?? 'claude', vibe: localP.vibe ?? 'balanced',
      goals: localP.goals ?? [], location: localP.location ?? '',
      lat: localP.lat ?? null, lon: localP.lon ?? null,
    })
  }
 
  // Sync streak to localStorage for offline use
  const streak = await getStreak(userId)
  setLocalStreak(streak)
}
export async function syncStudyTime(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  try {
    const data = getLocalStudyTimeMap()
    const secs = data[today] ?? 0
    if (secs < 10) return // don't sync tiny amounts
    if (!supabase) return
    await supabase.from('study_time').upsert(
      { user_id: userId, study_date: today, seconds: secs },
      { onConflict: 'user_id,study_date' }
    )
  } catch (e) { console.warn('Study time sync:', e) }
}
 
export async function getTodayStudyTime(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  if (!supabase) {
    return getLocalStudyTimeMap()[today] ?? 0
  }
  const { data } = await supabase.from('study_time').select('seconds').eq('user_id', userId).eq('study_date', today).single()
  return (data as any)?.seconds ?? 0
}
 
export async function getWeekStudyTime(userId: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  if (!supabase) {
    return Object.entries(getLocalStudyTimeMap())
      .filter(([date]) => date >= weekAgo)
      .reduce((sum, [, seconds]) => sum + (Number(seconds) || 0), 0)
  }
  const { data } = await supabase.from('study_time').select('seconds').eq('user_id', userId).gte('study_date', weekAgo)
  return (data ?? []).reduce((sum: number, r: any) => sum + (r.seconds ?? 0), 0)
}
 
