import { useEffect, useRef } from 'react'

let nextOverlay = 0
let pendingBack: Promise<void> | null = null
/** Give transient UI a history entry so hardware Back dismisses it first. */
export default function useOverlayBack(open: boolean, onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const id = ++nextOverlay
    let installed = false, disposed = false, popped = false
    const setup = setTimeout(async () => {
      await pendingBack
      if (disposed) return
      history.pushState({ ...history.state, shhOverlay: id }, '')
      installed = true
    }, 0)
    const pop = () => {
      if (!installed || history.state?.shhOverlay === id) return
      popped = true
      close.current()
    }
    window.addEventListener('popstate', pop)
    return () => {
      disposed = true
      clearTimeout(setup)
      window.removeEventListener('popstate', pop)
      if (installed && !popped && history.state?.shhOverlay === id) {
        pendingBack = new Promise(resolve => {
          const complete = () => { pendingBack = null; resolve() }
          window.addEventListener('popstate', complete, { once: true })
        })
        history.back()
      }
    }
  }, [open])
}
