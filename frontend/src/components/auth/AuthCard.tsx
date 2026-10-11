import BotCheck from './BotCheck'
import { LegalLinks } from '../legal/Legal'
import { useId, useRef, useState, type RefObject } from 'react'
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from '../../supabase'
import Icon from '../Icon'
import AuthLayout, { AppTile } from './AuthLayout'

const botCheckEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)
type Mode='login'|'signup'
function friendlyError(error:unknown):string {
  const message=error instanceof Error?error.message:String(error)
  if(/invalid login credentials|invalid_credentials/i.test(message))return 'Wrong email or password. Please try again.'
  if(/email not confirmed/i.test(message))return 'Please open the confirmation link in your email before signing in.'
  if(/already registered|already exists/i.test(message))return 'An account with this email already exists. Try signing in.'
  if(/rate|too many|security purposes/i.test(message))return 'Too many attempts. Please wait a moment and try again.'
  if(/fetch|network|connection/i.test(message))return 'Could not connect. Check your connection and try again.'
  if(/cloud unavailable/i.test(message))return 'Sign-in is temporarily unavailable. Please try again later.'
  return 'Could not complete your request. Please try again.'
}
export function StrengthMeter({password}:{password:string}){
  const score=[password.length>=8,/[a-z]/.test(password)&&/[A-Z]/.test(password),/\d/.test(password),/[^\w\s]/.test(password)].filter(Boolean).length
  return <div className="strength-area"><div className={`strength-meter score-${score}`} role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={score} aria-valuetext={`${score} of 4: length, mixed case, number and symbol`} >{[0,1,2,3].map(i=><span className={i<score?'filled':''} key={i}/>)}</div><small>At least 8 characters. Mixed case, numbers and symbols make it stronger.</small></div>
}
export function PasswordField({value,onChange,create,invalid,disabled,inputRef,errorId}:{value:string;onChange:(v:string)=>void;create:boolean;invalid:boolean;disabled:boolean;inputRef:RefObject<HTMLInputElement|null>;errorId:string}){
  const [visible,setVisible]=useState(false),id=useId()
  return <div className={`auth-field ${invalid?'invalid':''}`}><Icon name="lock" size={18}/><label className="sr-only" htmlFor={id}>Password</label><input ref={inputRef} id={id} maxLength={256} type={visible?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} placeholder="Password" autoComplete={create?'new-password':'current-password'} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid?errorId:undefined} minLength={create?8:undefined} required/><button type="button" className="password-eye" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}><Icon name={visible?'eye-off':'eye'} size={19}/></button></div>
}
function GoogleMark(){return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
export default function AuthCard({onBack,initialMode='login'}:{onBack:()=>void;initialMode?:Mode}){
  const [captchaToken,setCaptchaToken]=useState(''),[captchaReset,setCaptchaReset]=useState(0)
  const [accepted,setAccepted]=useState(false)
  const [mode,setMode]=useState<Mode>(initialMode),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[invalid,setInvalid]=useState<'email'|'password'|null>(null),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false)
  const emailRef=useRef<HTMLInputElement>(null),passwordRef=useRef<HTMLInputElement>(null),pending=useRef(false),id=useId(),errorId=useId(),tabRefs=useRef<(HTMLButtonElement|null)[]>([])
  const changeMode=(next:Mode)=>{if(pending.current)return;setMode(next);setError('');setInvalid(null)}
  const submit=async()=>{
    if(pending.current)return
    setError('');setInvalid(null)
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){setError('Enter a valid email address.');setInvalid('email');emailRef.current?.focus();return}
    if(!password || (mode==='signup'&&password.length<8)){setError(mode==='signup'?'Use at least 8 characters for your password.':'Enter your password.');setInvalid('password');passwordRef.current?.focus();return}
    if(mode==='signup'&&!accepted){setError('Confirm you are 18 or over and accept the terms before creating an account.');document.querySelector<HTMLInputElement>('.auth-consent input')?.focus();return}
    if(botCheckEnabled&&!captchaToken){setError('Complete the security check before signing in.');return}
    pending.current=true;setBusy(true)
    try{if(mode==='login')await signInWithEmail(email.trim(),password,captchaToken);else{const data=await signUpWithEmail(email.trim(),password,captchaToken);if(!data.session)setConfirm(true)}}catch(error){setError(friendlyError(error));emailRef.current?.focus()}finally{pending.current=false;setBusy(false);setCaptchaToken('');setCaptchaReset(n=>n+1)}
  }
  const google=async()=>{if(pending.current)return;if(!accepted){setError('Confirm you are 18 or over and accept the terms before continuing with Google.');document.querySelector<HTMLInputElement>('.auth-consent input')?.focus();return;}pending.current=true;setBusy(true);setError('');try{await signInWithGoogle()}catch(error){setError(friendlyError(error));pending.current=false;setBusy(false)}}
  return <AuthLayout><section className="auth-card" aria-labelledby="auth-heading"><button className="auth-back" type="button" onClick={onBack}><Icon name="back" size={15}/>Back</button><AppTile/><h1 className="auth-brand" id="auth-heading">Shhhhh</h1>
  {confirm?<div className="auth-confirm" role="status"><h2>Check your email</h2><p>Open the confirmation link sent to <strong>{email}</strong>, then sign in to finish setting up your study space.</p><button className="auth-button full" onClick={()=>{setConfirm(false);changeMode('login')}}>Go to sign in<Icon name="arrow" size={17}/></button></div>:<>
    <p className="auth-tag">{mode==='signup'?'Create your free account.':'Welcome back. Ready to learn?'}</p>
    <div className="auth-tabs" role="tablist" aria-label="Account access">{(['login','signup'] as Mode[]).map((m,i)=><button key={m} ref={node=>{tabRefs.current[i]=node}} role="tab" id={`${id}-${m}`} aria-controls={`${id}-panel`} aria-selected={mode===m} tabIndex={mode===m?0:-1} disabled={busy} onClick={()=>changeMode(m)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;changeMode(next?'signup':'login');tabRefs.current[next]?.focus()}}}>{m==='login'?'Sign in':'Create account'}</button>)}</div>
    <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)} disabled={busy}/><span>I am 18 or over and agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms (new tab)</a>. I have read the <a href="/privacy" target="_blank" rel="noreferrer">Privacy policy (new tab)</a>. Required for new accounts and Google sign-in.</span></label>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}><button className="auth-button google-button full" disabled={busy} onClick={google}><GoogleMark/>Continue with Google</button><div className="auth-divider">or</div>
      <form noValidate onSubmit={e=>{e.preventDefault();void submit()}} aria-busy={busy}>
        <div className={`auth-field ${invalid==='email'?'invalid':''}`}><Icon name="mail" size={18}/><label className="sr-only" htmlFor={`${id}-email`}>Email</label><input id={`${id}-email`} ref={emailRef} type="email" maxLength={254} autoComplete="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" aria-invalid={invalid==='email'} aria-describedby={invalid==='email'?errorId:undefined} disabled={busy} required/></div>
        <PasswordField value={password} onChange={setPassword} create={mode==='signup'} invalid={invalid==='password'} disabled={busy} inputRef={passwordRef} errorId={errorId}/>
        <div className="auth-mode-extra">{mode==='signup'&&<StrengthMeter password={password}/>}</div>
        <BotCheck onToken={setCaptchaToken} reset={captchaReset}/>
        <p className="auth-error" role="alert" id={errorId}>{error}</p>
        <button className="auth-button full" type="submit" disabled={busy}>{busy&&<span className="auth-spinner" aria-hidden="true"/>}{busy?'Please wait…':mode==='signup'?'Create account':'Sign in'}</button>
      </form>
    </div>
    <p className="auth-fine">{mode==='signup'?'Already have one?':"Don't have an account?"} <button className="auth-link" disabled={busy} onClick={()=>changeMode(mode==='signup'?'login':'signup')}>{mode==='signup'?'Sign in':'Sign up'}</button></p>
    <p className="auth-fine">Your study files stay on your device.</p><p className="auth-data-note">Account details sync through Supabase. Selected PDF excerpts are shared with the AI provider when you ask a question.</p>
  </>}
  <LegalLinks /></section></AuthLayout>
}
