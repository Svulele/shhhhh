import { clearStudyDeviceData, waitForDeviceCleanup } from './localPrivacy'
import Splash from './components/auth/Splash'
import AuthCard from './components/auth/AuthCard'
import Landing from './components/auth/Landing'
import OnboardingFlow from './components/auth/OnboardingFlow'
import { useState, useEffect, useRef } from 'react'
import { supabase, signOut, syncProfile, recordStudyDay, getStreak } from './supabase'
import type { User } from '@supabase/supabase-js'

export { recordStudyDay, getStreak }
interface Props {
  children: (
    user: User,
    doSignOut: () => void,
    tourDone: boolean
  ) => React.ReactNode
}

// ── Check tour status — local first, then Supabase ────────────
// Exported so App.tsx can call it too
export async function checkTourDone(userId?: string): Promise<boolean> {
  if (localStorage.getItem('shh_tour_done')) return true
  if (!userId || !supabase) return false
  try {
    const { data } = await supabase
      .from('profiles')
      .select('tour_done')
      .eq('id', userId)
      .single()
    if (data?.tour_done) {
      localStorage.setItem('shh_tour_done', '1') // cache locally for next time
      return true
    }
  } catch {}
  return false
}

// ── Mark tour done — saves to both localStorage and Supabase ──
export async function markTourDone(userId?: string): Promise<void> {
  localStorage.setItem('shh_tour_done', '1')
  if (!userId || !supabase) return
  try {
    await supabase
      .from('profiles')
      .update({ tour_done: true })
      .eq('id', userId)
  } catch (e) {
    console.warn('Could not save tour_done to Supabase:', e)
  }
}

// Account-specific local state must not survive sign-out or an account switch.
const clearUserData = clearStudyDeviceData

function readProfile() { try { return JSON.parse(localStorage.getItem('shh_profile') || '{}') } catch { return {} } }
function completedProfile() { const p=readProfile();return Boolean(p.onboarded && p.name?.trim() && Array.isArray(p.goals) && p.goals.length) }
export default function AuthGate({ children }: Props) {
  const [user,setUser]=useState<User|null>(null)
  const [screen,setScreen]=useState<'landing'|'auth'|'loading'|'app'|'onboarding'>('loading')
  const [mode,setMode]=useState<'login'|'signup'>('login')
  const [tourDone,setTourDone]=useState(true)
  const currentUid=useRef<string|null>(null)
  useEffect(()=>{
    let active=true,generation=0
    const started=Date.now()
    const wait=()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,800-(Date.now()-started))))
    const ready=async(u:User)=>{
      if(currentUid.current===u.id)return
      const beforeCleanup=generation
      if(currentUid.current)await clearUserData()
      await waitForDeviceCleanup()
      if(!active||generation!==beforeCleanup)return
      currentUid.current=u.id
      const version=++generation,draft=readProfile(),loadingStarted=Date.now()
      setScreen('loading')
      try{await syncProfile(u.id)}catch{/* retain local profile when offline */}
      if(!active||version!==generation)return
      if(draft.onboarded===false)localStorage.setItem('shh_profile',JSON.stringify(draft))
      const done=await checkTourDone(u.id)
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,800-(Date.now()-loadingStarted))))
      if(!active||version!==generation)return
      setTourDone(done);setUser(u);setScreen(completedProfile()?'app':'onboarding')
    }
    if(!supabase){void wait().then(()=>{if(active)setScreen('landing')});return()=>{active=false}}
    void supabase.auth.getSession().then(async({data})=>{
      if(!active)return
      if(data.session?.user)void ready(data.session.user)
      else{await wait();if(active&&!currentUid.current)setScreen('landing')}
    }).catch(async()=>{await wait();if(active&&!currentUid.current)setScreen('landing')})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        ++generation;clearUserData();currentUid.current=null;setUser(null);setTourDone(true);setScreen('auth')
      }else if(session?.user){const u=session.user;setTimeout(()=>{if(active)void ready(u)},0)}
    })
    return()=>{active=false;++generation;subscription.unsubscribe()}
  },[])
  const doSignOut=async()=>{await signOut();await clearUserData();currentUid.current=null;setUser(null);setScreen('landing')}
  if(screen==='loading')return <Splash/>
  if(screen==='onboarding'&&user)return <OnboardingFlow onDone={()=>setScreen('app')}/>
  if(screen==='app'&&user)return <>{children(user,doSignOut,tourDone)}</>
  if(screen==='auth')return <AuthCard initialMode={mode} onBack={()=>setScreen('landing')}/>
  return <Landing onStart={create=>{setMode(create?'signup':'login');setScreen('auth')}}/>
}
