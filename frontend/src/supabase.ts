import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars are missing. Auth features will not work until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.')
}

export const supabase = createClient(
  supabaseUrl || 'https://example.supabase.co',
  supabaseAnonKey || 'missing-anon-key',
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
