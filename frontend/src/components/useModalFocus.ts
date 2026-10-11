import { keyboardShortcutsEnabled } from '../useInputMode'
import useOverlayBack from './useOverlayBack'
import { useEffect, useRef, type RefObject } from 'react'

export default function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useOverlayBack(open, onClose)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    if (!open || !ref.current) return
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    const app = document.getElementById('root')
    const wasInert = app?.inert || false
    if (app && !app.contains(dialog)) app.inert = true
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
    focusable()[0]?.focus()
    const key = (e: KeyboardEvent) => {
      if (keyboardShortcutsEnabled() && e.key === 'Escape') { e.preventDefault(); close.current() }
      if (e.key !== 'Tab') return
      const elements = focusable(), first = elements[0], last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      if (app) app.inert = wasInert
      if (previous?.isConnected) previous.focus()
      else document.getElementById('main-content')?.focus()
    }
  }, [open, ref])
}
