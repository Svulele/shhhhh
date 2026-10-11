import { startFrameProbe } from './frameProbe'
import { initInputMode } from './useInputMode'
let dispose: (() => void) | undefined
/** Presentation-only viewport, motion and device capability handling. */
export function installMobileUX() {
  dispose?.()
  const stopInput = initInputMode()
  const controller = new AbortController(), signal = controller.signal
  const root = document.documentElement
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; addEventListener?: (name: string, callback: () => void) => void } }
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let probedLite = false
  const capabilities = () => root.classList.toggle('lite', Boolean(probedLite || (nav.deviceMemory && nav.deviceMemory <= 4) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || nav.connection?.saveData || motion.matches))
  capabilities()
  const stopProbe = startFrameProbe(lite => { probedLite=lite; capabilities() })
  motion.addEventListener('change', capabilities)
  nav.connection?.addEventListener?.('change', capabilities)
  let frame = 0, focusFrame = 0, scrollTimer: ReturnType<typeof setTimeout>, focusTimer: ReturnType<typeof setTimeout>
  const viewport = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const vv = window.visualViewport
      const field = document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]')
      const kb = field ? Math.max(0, innerHeight - (vv?.height ?? innerHeight) - (vv?.offsetTop ?? 0)) : 0
      root.style.setProperty('--kb', `${kb}px`)
      root.style.setProperty('--viewport-bottom', `${Math.max(0, innerHeight - (vv?.height ?? innerHeight) - (vv?.offsetTop ?? 0))}px`)
      root.style.setProperty('--viewport-top', `${vv?.offsetTop ?? 0}px`)
      root.style.setProperty('--viewport-height', `${vv?.height ?? innerHeight}px`)
      root.classList.toggle('keyboard-open', Boolean(field && (kb > 100 || (vv?.height ?? innerHeight) < screen.height * .65)))
      if (field && kb > 100) { cancelAnimationFrame(focusFrame); focusFrame = requestAnimationFrame(() => {
        const active = document.activeElement as HTMLElement | null
        if (!active?.closest('.chat-page')) active?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }) }
    })
  }
  window.visualViewport?.addEventListener('resize', viewport, { passive: true, signal })
  window.visualViewport?.addEventListener('scroll', viewport, { passive: true, signal })
  window.addEventListener('resize', viewport, { passive: true, signal })
  document.addEventListener('focusin', event => {
    viewport()
    const el = event.target as HTMLElement
    if (matchMedia('(pointer: coarse)').matches && el.matches('input,textarea,[contenteditable=true]')) {
      clearTimeout(focusTimer); focusTimer = setTimeout(() => { if (!el.closest('.chat-page') && document.activeElement === el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, 250)
    }
  }, { signal })
  document.addEventListener('focusout', viewport, { signal })
  window.addEventListener('shh:goto',()=>{root.classList.remove('tabs-hidden');previousScroll=0},{signal})
  const visibility = () => root.classList.toggle('motion-paused', document.hidden)
  document.addEventListener('visibilitychange', visibility, { signal })
  let directionFrame=0, previousScroll=0, scrollIntent=0
  const intent=()=>{scrollIntent=performance.now()}
  document.addEventListener('pointerdown',intent,{passive:true,signal})
  document.addEventListener('touchmove',intent,{passive:true,signal})
  document.addEventListener('wheel',intent,{passive:true,signal})
  document.addEventListener('scroll', event => {
    const target=event.target
    if (matchMedia('(max-width:820px), (max-width:1100px) and (pointer:coarse)').matches && performance.now()-scrollIntent<1000 && !directionFrame && ((target instanceof Element && target.closest('.main,.main-home')) || target === document)) {
      directionFrame=requestAnimationFrame(()=>{
        directionFrame=0
        const next=target instanceof Element ? target.scrollTop : scrollY
        if(next < previousScroll-6 || next < 24) root.classList.remove('tabs-hidden')
        else if(next > previousScroll+6 && !document.activeElement?.matches('input,textarea')) root.classList.add('tabs-hidden')
        previousScroll=next
      })
    }
    root.classList.add('scrolling')
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => root.classList.remove('scrolling'), 180)
  }, { capture: true, passive: true, signal })
  const theme = () => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.append(meta) }
    meta.content = root.dataset.theme === 'dark' ? '#13121d' : '#f4f2fb'
  }
  const observer = new MutationObserver(theme)
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  theme(); viewport(); visibility()
  dispose = () => { controller.abort(); stopProbe(); stopInput(); observer.disconnect(); motion.removeEventListener('change', capabilities); (nav.connection as unknown as EventTarget)?.removeEventListener('change', capabilities); cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); cancelAnimationFrame(directionFrame); clearTimeout(scrollTimer); clearTimeout(focusTimer) }
  return dispose
}
