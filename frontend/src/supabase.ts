import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing. Auth features will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
}

export const supabase = createClient(
  supabaseUrl || 'https://ftslqohbpbpussqfpynu.supabase.co',
  supabaseAnonKey || 'sb_publishable_z0RGxn8wM3ktne4ILj-26g_EGxQItqt',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

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
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...profile }, { onConflict: 'id' })

  if (error) throw error
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
}

export async function signUpWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function loadCloudProfile(userId: string): Promise<CloudProfileInput | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as CloudProfileInput | null
}

export async function recordStudyDay(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('study_days')
    .upsert({ user_id: userId, study_date: today }, { onConflict: 'user_id,study_date' })

  if (error) throw error
}

export async function getStreak(userId: string): Promise<number> {
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
  const local = localStorage.getItem('shh_profile')
  const localP = local ? JSON.parse(local) : null
 
  const cloud = await loadCloudProfile(userId)
 
  if (cloud) {
    // Cloud is source of truth — merge into local
    const merged = { ...(localP ?? {}), ...cloud, onboarded: true }
    localStorage.setItem('shh_profile', JSON.stringify(merged))
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
  localStorage.setItem('shh_streak', String(streak))
}
 export async function syncStudyTime(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  try {
    const raw  = localStorage.getItem('shh_study_time')
    const data = raw ? JSON.parse(raw) : {}
    const secs = data[today] ?? 0
    if (secs < 10) return // don't sync tiny amounts
    await supabase.from('study_time').upsert(
      { user_id: userId, study_date: today, seconds: secs },
      { onConflict: 'user_id,study_date' }
    )
  } catch (e) { console.warn('Study time sync:', e) }
}
 
export async function getTodayStudyTime(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await supabase.from('study_time').select('seconds').eq('user_id', userId).eq('study_date', today).single()
  return (data as any)?.seconds ?? 0
}
 
export async function getWeekStudyTime(userId: string): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const { data } = await supabase.from('study_time').select('seconds').eq('user_id', userId).gte('study_date', weekAgo)
  return (data ?? []).reduce((sum: number, r: any) => sum + (r.seconds ?? 0), 0)
}
 