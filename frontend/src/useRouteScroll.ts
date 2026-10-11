import { useEffect, useRef } from 'react'
/** Bounded, session-only presentation state; never stores study content. */
export function useRouteScroll(page: string) {
  const positions=useRef<Record<string,number>>({})
  useEffect(()=>{try{positions.current=JSON.parse(sessionStorage.getItem('shh_route_scroll')||'{}')}catch{ /* storage unavailable */ }},[])
  useEffect(()=>{
    if(page==='chat')return // Chat intentionally restores at the newest message.
    let frame=0, restoreFrame=0, restored=false
    const target=()=>page==='dashboard'?document.scrollingElement:document.querySelector('.main .page-scroll')
    const save=()=>{try{sessionStorage.setItem('shh_route_scroll',JSON.stringify(positions.current))}catch{ /* storage unavailable */ }}
    const restore=()=>{const el=target();if(!el||restored)return;restored=true;observer.disconnect();restoreFrame=requestAnimationFrame(()=>{el.scrollTop=positions.current[page]||0})}
    const observer=new MutationObserver(restore);observer.observe(document.getElementById('main-content')!,{childList:true,subtree:true});restore()
    const scroll=(event:Event)=>{const el=target();if(event.target!==el&&!(page==='dashboard'&&event.target===document))return;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(el)positions.current[page]=el.scrollTop})}
    const hidden=()=>{if(document.hidden)save()}
    document.addEventListener('scroll',scroll,{capture:true,passive:true});window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',hidden)
    return()=>{cancelAnimationFrame(frame);cancelAnimationFrame(restoreFrame);observer.disconnect();document.removeEventListener('scroll',scroll,true);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',hidden);save()}
  },[page])
}
