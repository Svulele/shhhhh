import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import BotCheck from '../auth/BotCheck'
import useModalFocus from '../useModalFocus'
import { API_URL, publicApiHeaders } from '../../api'
import './legal.css'

const botCheckEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
export default function PrivacyTools() {
  const [feedback, setFeedback] = useState(false)
  const [decision, setDecision] = useState<((allowed: boolean) => void) | null>(null)
  useEffect(() => {
    const show = () => setFeedback(true)
    const consent = (event: Event) => setDecision(() => (event as CustomEvent<(allowed: boolean) => void>).detail)
    window.addEventListener('shh:feedback', show); window.addEventListener('shh:ai-consent', consent)
    return () => { window.removeEventListener('shh:feedback', show); window.removeEventListener('shh:ai-consent', consent) }
  }, [])
  const answer = (allowed: boolean) => { decision?.(allowed); setDecision(null) }
  return <>{feedback && !decision && <FeedbackDialog onClose={() => setFeedback(false)} />}{decision && <ConsentDialog onAnswer={answer} />}</>
}
function ConsentDialog({ onAnswer }: { onAnswer: (allowed: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useModalFocus(ref, true, () => onAnswer(false))
  return createPortal(<div className="privacy-overlay"><div className="privacy-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="ai-consent-heading" aria-describedby="ai-consent-description"><Icon name="shield" size={28} /><h2 id="ai-consent-heading">Allow AI sharing?</h2><p id="ai-consent-description">AI tools send your question, relevant study context and selected PDF passages through our backend to OpenRouter and its model providers. They may process data outside South Africa. Don’t share confidential information or material you don’t have permission to send.</p><p>Reading and notes still work without AI. You can withdraw future sharing in Settings. <a href="/privacy" target="_blank" rel="noreferrer">Read the privacy policy (new tab)</a>.</p><div className="privacy-actions"><button onClick={() => onAnswer(false)} className="privacy-button">Keep AI off</button><button onClick={() => onAnswer(true)} className="privacy-button primary">Allow AI sharing</button></div></div></div>, document.body)
}
function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [captchaToken,setCaptchaToken]=useState(''),[captchaReset,setCaptchaReset]=useState(0)
  const [message, setMessage] = useState(''), [replyEmail, setReplyEmail] = useState(''), [website, setWebsite] = useState(''), [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('')
  useModalFocus(ref, true, () => { if (!busy) onClose() })
  const submit = async () => {
    if (busy || !consent || message.trim().length < 3) return
    if(botCheckEnabled&&!captchaToken){setError('Complete the security check before sending.');return}
    setBusy(true); setError('')
    try {
      const response = await fetch(API_URL + '/api/feedback', { method: 'POST', headers: publicApiHeaders(), signal: AbortSignal.timeout(30000), body: JSON.stringify({ message: message.trim(), reply_email: replyEmail.trim(), website, consent, captcha_token:captchaToken }) })
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many messages. Please try again later.' : 'Could not send your message. Please try again later.')
      setSent(true)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not send your message.') }
    finally { setBusy(false);setCaptchaToken('');setCaptchaReset(n=>n+1) }
  }
  return createPortal(<div className="privacy-overlay"><div className="privacy-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="feedback-heading"><div className="privacy-heading"><h2 id="feedback-heading">Contact / feedback</h2><button className="round-button" onClick={onClose} disabled={busy} aria-label="Close feedback"><Icon name="close" size={20} /></button></div>{sent ? <div role="status"><p>Your message was sent. Thank you.</p><button className="privacy-button" onClick={onClose}>Close</button></div> : <form onSubmit={event => { event.preventDefault(); void submit() }}><p>For support, privacy requests or copyright concerns. Don’t include passwords, payment information or ID documents.</p><label htmlFor="feedback-message">Your message</label><textarea id="feedback-message" value={message} onChange={event => setMessage(event.target.value)} minLength={3} maxLength={4000} rows={5} required disabled={busy} /><label htmlFor="feedback-email">Reply email (optional)</label><input id="feedback-email" type="email" autoComplete="email" maxLength={254} value={replyEmail} onChange={event => setReplyEmail(event.target.value)} disabled={busy} /><div className="form-trap" aria-hidden="true"><label htmlFor="feedback-website">Website</label><input id="feedback-website" tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></div><label className="privacy-check"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required disabled={busy} /><span>I allow my message and optional reply email to be sent and stored to handle this request. <a href="/privacy" target="_blank" rel="noreferrer">Privacy policy (new tab)</a>.</span></label><BotCheck onToken={setCaptchaToken} reset={captchaReset}/><p role="alert" className="privacy-error">{error}</p><button className="privacy-button primary" disabled={busy || !consent || message.trim().length < 3}>{busy ? 'Sending…' : 'Send message'}</button></form>}</div></div>, document.body)
}
