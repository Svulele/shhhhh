import { useEffect, useRef, useState } from 'react'
const botCheckEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
interface Turnstile {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme: 'auto' }) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }
let ready: Promise<void> | null = null
function load() {
  if (window.turnstile) return Promise.resolve()
  if (!ready) ready = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => { script.remove(); ready = null; reject(new Error('Security check could not load.')) }
    document.head.append(script)
  })
  return ready
}
export default function BotCheck({ onToken, reset }: { onToken: (token: string) => void; reset: number }) {
  const ref = useRef<HTMLDivElement>(null), callback = useRef(onToken)
  const [error,setError] = useState('')
  useEffect(()=>{callback.current=onToken},[onToken])
  useEffect(()=>{
    if (!botCheckEnabled) return
    let disposed=false, id:string|undefined
    callback.current('')
    void load().then(()=>{
      if(disposed || !ref.current || !window.turnstile)return
      id=window.turnstile.render(ref.current,{sitekey:import.meta.env.VITE_TURNSTILE_SITE_KEY,theme:'auto',callback:token=>{setError('');callback.current(token)},'expired-callback':()=>callback.current(''),'error-callback':()=>{callback.current('');setError('Security check failed. Reload to try again.')}})
    }).catch(()=>{if(!disposed)setError('Security check could not load. Reload to try again.')})
    return ()=>{disposed=true;if(id)window.turnstile?.remove(id)}
  },[reset])
  if(!botCheckEnabled)return null
  return <div className="bot-check"><p>Security check</p><div ref={ref}/><p role="alert">{error}</p></div>
}
