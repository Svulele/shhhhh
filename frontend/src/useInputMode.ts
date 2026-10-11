export type InputMode = 'touch' | 'mouse' | 'keyboard'
let dispose: (() => void) | undefined
export function keyboardShortcutsEnabled() {
  const mode = document.documentElement.dataset.input
  return mode === 'mouse' || mode === 'keyboard'
}
export function canHover() {
  return matchMedia('(hover: hover) and (pointer: fine)').matches
}
/** One app-lifetime listener pair; repeated setup returns the existing disposer. */
export function initInputMode() {
  if (dispose) return dispose
  const root = document.documentElement
  const set = (mode: InputMode) => { if (root.dataset.input !== mode) root.dataset.input = mode }
  set(canHover() ? 'mouse' : 'touch')
  const pointer = (event: PointerEvent) => set(event.pointerType === 'touch' ? 'touch' : 'mouse')
  const key = (event: KeyboardEvent) => {
    if (event.target instanceof Element && event.target.closest('input,textarea,[contenteditable]:not([contenteditable=false])')) return
    set('keyboard')
  }
  window.addEventListener('pointerdown', pointer, { passive: true })
  // Capture updates the mode before document/React shortcut handlers see this key.
  window.addEventListener('keydown', key, true)
  dispose = () => {
    window.removeEventListener('pointerdown', pointer)
    window.removeEventListener('keydown', key, true)
    dispose = undefined
  }
  return dispose
}
