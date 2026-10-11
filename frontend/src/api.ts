declare const __SHH_PREVIEW__: boolean
import { supabase } from './supabase'
import { ensureAIConsent } from './privacyConsent'

export const API_URL = __SHH_PREVIEW__ ? '' : (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://shhhhh-zhgy.onrender.com' : 'http://127.0.0.1:8000')).replace(/\/+$/, '')
export function publicApiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Supabase-Key': import.meta.env.VITE_SUPABASE_ANON_KEY || '' }
}
export async function aiFetch(url: string, options: RequestInit): Promise<Response> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  if (!data.session) throw new Error('Please sign in to use AI features.')
  await ensureAIConsent()
  if (options.signal?.aborted) throw new DOMException('Canceled', 'AbortError')
  return fetch(url, { ...options, headers: { ...publicApiHeaders(), ...options.headers, Authorization: `Bearer ${data.session.access_token}` } })
}
