export const CONSENT_VERSION = '2026-10-11'
export const hasAIConsent = () => localStorage.getItem('shh_ai_consent') === CONSENT_VERSION
let pending: Promise<void> | null = null
export function ensureAIConsent(): Promise<void> {
  if (hasAIConsent()) return Promise.resolve()
  if (!pending) pending = new Promise<void>((resolve, reject) => {
    window.dispatchEvent(new CustomEvent('shh:ai-consent', { detail: (allowed: boolean) => {
      if (allowed) { localStorage.setItem('shh_ai_consent', CONSENT_VERSION); resolve() }
      else reject(new Error('AI sharing was not allowed. Your reading tools still work locally.'))
    } }))
  }).finally(() => { pending = null })
  return pending
}
