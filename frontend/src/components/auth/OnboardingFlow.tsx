import { useEffect, useRef, useState } from 'react'
import AuthLayout from './AuthLayout'
import Icon from '../Icon'
export interface StudyProfile { name:string;ai:string;vibe:string;goals:string[];location:string;lat:number|null;lon:number|null;onboarded:boolean }
const AI=[{id:'claude',label:'Claude',sub:'Anthropic'},{id:'gpt4',label:'GPT-4',sub:'OpenAI'},{id:'gemini',label:'Gemini',sub:'Google'},{id:'llama',label:'LLaMA',sub:'Open source'}]
const STYLES=[{id:'gentle',icon:'sprout',label:'Gentle',sub:'Warm, patient, never judges'},{id:'balanced',icon:'bolt',label:'Balanced',sub:'Supportive but accountable'},{id:'strict',icon:'target',label:'Strict',sub:'Direct, no fluff, results'},{id:'chill',icon:'white',label:'Chill',sub:'Laid-back, no pressure'}]
const GOALS=['Exams','Research','Personal growth','Language','Coding','Creative writing']
const QUESTIONS=['What should I call you?','Which AI will you study with?','What kind of study buddy?','What are you studying for?','Can I see your location?']
const LABELS=['Welcome','Your AI','Your style','Focus areas','Almost there']
function readDraft():StudyProfile {try{const p=JSON.parse(localStorage.getItem('shh_profile')||'{}');return {name:p.name||'',ai:p.ai||'claude',vibe:p.vibe||'balanced',goals:Array.isArray(p.goals)?p.goals:[],location:p.location||'',lat:p.lat??null,lon:p.lon??null,onboarded:false}}catch{return {name:'',ai:'claude',vibe:'balanced',goals:[],location:'',lat:null,lon:null,onboarded:false}}}
export function OptionCard({value,label,sub,icon,selected,onSelect}:{value:string;label:string;sub:string;icon?:string;selected:boolean;onSelect:(v:string)=>void}){return <label className={`onboarding-option ${selected?'selected':''}`}><input type="radio" name={icon?'study-style':'study-ai'} value={value} checked={selected} onChange={()=>onSelect(value)}/>{icon&&<span className="option-icon"><Icon name={icon} size={22}/></span>}<span className="option-copy"><strong>{label}</strong><small>{sub}</small></span>{icon&&<Icon name="check" size={17} className={`option-check ${selected?'checked':''}`}/>}</label>}
export function ChipGroup({values,onChange}:{values:string[];onChange:(v:string[])=>void}){return <fieldset className="goal-chips"><legend className="sr-only">Focus areas, select at least one</legend>{GOALS.map(goal=><label key={goal} className={values.includes(goal)?'selected':''}><input type="checkbox" value={goal} checked={values.includes(goal)} onChange={()=>onChange(values.includes(goal)?values.filter(g=>g!==goal):[...values,goal])}/><span>{goal}</span></label>)}</fieldset>}
export function DoneScreen({profile,onOpen}:{profile:StudyProfile;onOpen:()=>void}){const ref=useRef<HTMLHeadingElement>(null);useEffect(()=>ref.current?.focus(),[]);return <AuthLayout><section className="auth-card onboarding-done"><div className="done-check"><Icon name="check" size={34}/></div><h1 ref={ref} tabIndex={-1}>You're all set, {profile.name}.</h1><p>Your {STYLES.find(s=>s.id===profile.vibe)?.label.toLowerCase()||'balanced'} study buddy is ready.</p><button className="auth-button full" onClick={onOpen}>Open Shhhhh<Icon name="arrow" size={18}/></button></section></AuthLayout>}
export default function OnboardingFlow({onDone}:{onDone:(profile:StudyProfile)=>void}){
  const [profile,setProfile]=useState(readDraft),[step,setStep]=useState(()=>{const draft=readDraft();return !draft.name.trim()?0:draft.goals.length?4:1}),[direction,setDirection]=useState(1),[done,setDone]=useState(false),[locationState,setLocationState]=useState<'idle'|'asking'|'done'|'denied'>(()=>readDraft().lat!==null?'done':'idle')
  const nameRef=useRef<HTMLInputElement>(null),headingRef=useRef<HTMLHeadingElement>(null),alive=useRef(true),latest=useRef(profile)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  useEffect(()=>{if(step===0)nameRef.current?.focus();else headingRef.current?.focus()},[step])
  const update=(patch:Partial<StudyProfile>)=>{const next={...latest.current,...patch,onboarded:false};latest.current=next;setProfile(next);localStorage.setItem('shh_profile',JSON.stringify(next))}
  const valid=step===0?profile.name.trim().length>0:step===3?profile.goals.length>0:true
  const navigate=(next:number)=>{setDirection(next>step?1:-1);setStep(next)}
  const location=()=>{
    if(!navigator.geolocation){setLocationState('denied');return}
    setLocationState('asking')
    navigator.geolocation.getCurrentPosition(async position=>{
      const lat=Number(position.coords.latitude.toFixed(2)),lon=Number(position.coords.longitude.toFixed(2))
      let city='Location saved'
      try{const response=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{signal:AbortSignal.timeout(8000)});if(response.ok){const data=await response.json();city=data.address?.city||data.address?.town||data.address?.state||city}}catch{/* optional city lookup */}
      if(alive.current){const next={...latest.current,lat,lon,location:city,onboarded:false};latest.current=next;setProfile(next);localStorage.setItem('shh_profile',JSON.stringify(next));setLocationState('done')}
    },()=>{if(alive.current)setLocationState('denied')},{timeout:10000,maximumAge:1800000})
  }
  const finish=()=>{alive.current=false;const complete={...profile,name:profile.name.trim(),onboarded:true};localStorage.setItem('shh_profile',JSON.stringify(complete));setProfile(complete);setDone(true)}
  if(done)return <DoneScreen profile={profile} onOpen={()=>onDone(profile)}/>
  return <AuthLayout><section className="auth-card onboarding-card" aria-label="Set up your study buddy"><div className="onboarding-progress" role="progressbar" aria-label="Onboarding progress" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step+1}>{QUESTIONS.map((_,i)=><span className={i<=step?'filled':''} key={i}/>)}</div>
    <div key={step} className={`onboarding-pane ${direction>0?'forward':'backward'}`}><p className="auth-eyebrow">{LABELS[step]} · {step+1} of 5</p><h1 ref={headingRef} tabIndex={-1}>{QUESTIONS[step]}</h1>
      {step===0&&<><label className="sr-only" htmlFor="onboard-name">Your name</label><input className="onboarding-name" id="onboard-name" ref={nameRef} autoComplete="given-name" maxLength={30} value={profile.name} placeholder="Your name…" onChange={e=>update({name:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&valid){e.preventDefault();navigate(1)}}} required/></>}
      {step===1&&<fieldset className="ai-options"><legend className="sr-only">Choose your AI</legend>{AI.map(ai=><OptionCard key={ai.id} {...ai} value={ai.id} selected={profile.ai===ai.id} onSelect={ai=>update({ai})}/>)}</fieldset>}
      {step===2&&<fieldset className="style-options"><legend className="sr-only">Choose your study style</legend>{STYLES.map(style=><OptionCard key={style.id} {...style} value={style.id} selected={profile.vibe===style.id} onSelect={vibe=>update({vibe})}/>)}</fieldset>}
      {step===3&&<ChipGroup values={profile.goals} onChange={goals=>update({goals})}/>}
      {step===4&&<><p className="location-help">Only used for weather. Saved on your device.</p>{locationState==='done'?<p className="location-success" role="status"><Icon name="check" size={19}/>{profile.location||'Location saved'}</p>:<button className="auth-button" disabled={locationState==='asking'} onClick={location}><Icon name="pin" size={18}/>{locationState==='asking'?'Finding your location…':'Share location'}</button>}<p className="location-note" role="status">{locationState==='denied'?'No problem. Location is optional; you can continue without it.':'Optional. Weather and city lookup receive your coordinates only if you share them.'}</p></>}
    </div><div className="onboarding-footer">{step>0?<button className="auth-button ghost" onClick={()=>navigate(step-1)}>Back</button>:<span/>}<button className="auth-button" disabled={!valid} onClick={()=>{if(!valid)return;if(step===4)finish();else navigate(step+1)}}>{step===4?"Let's go":'Continue'}<Icon name="arrow" size={18}/></button></div>
  </section></AuthLayout>
}
