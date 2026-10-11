export function classifyFrames(deltas: number[]) {
  const sorted = [...deltas].sort((a,b)=>a-b), median = sorted[Math.floor(sorted.length/2)] ?? 0
  const slowFraction = deltas.filter(delta=>delta>20).length / Math.max(1,deltas.length)
  return { lite: slowFraction>.15 || median>18, medianMs: median, slowFraction, frames: deltas.length }
}
/** One visible two-second measurement, cached for a week. No capability API is required. */
export function startFrameProbe(onResult: (lite: boolean) => void) {
  const key='shh_perf_probe_v1'
  try { const saved=JSON.parse(localStorage.getItem(key)||'null'); if(saved && Date.now()-saved.measuredAt<7*86400000) { onResult(Boolean(saved.lite)); return ()=>{} } } catch { /* measure without storage */ }
  let frame=0, start=0, previous=0, deltas:number[]=[], done=false
  const tick=(now:number)=>{
    if(document.hidden)return
    if(!start)start=now
    if(previous)deltas.push(now-previous)
    previous=now
    if(now-start<2000){frame=requestAnimationFrame(tick);return}
    const result={...classifyFrames(deltas),measuredAt:Date.now()}; done=true
    try{localStorage.setItem(key,JSON.stringify(result))}catch{ /* private browsing */ }
    document.removeEventListener('visibilitychange',visibility);onResult(result.lite)
  }
  const visibility=()=>{cancelAnimationFrame(frame);start=0;previous=0;deltas=[];if(!document.hidden&&!done)frame=requestAnimationFrame(tick)}
  document.addEventListener('visibilitychange',visibility);visibility()
  return()=>{done=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility)}
}
