/** Passive gesture observation: native scrolling and selection remain in control. */
export function installTouchPaging(stage: HTMLElement, turn: (direction: number) => void) {
  let start: {x:number;y:number;at:number} | null = null;
  const selected = () => Boolean(window.getSelection()?.toString());
  const cancel = () => { start = null; };
  const begin = (event: TouchEvent) => {
    const target = event.target as Element;
    if (document.documentElement.dataset.input !== 'touch' || event.touches.length !== 1 || selected() || target.closest('button,input,textarea,select,a,[contenteditable]')) return cancel();
    start = { x:event.touches[0].clientX, y:event.touches[0].clientY, at:Date.now() };
  };
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1 || selected() || (start && Math.abs(event.touches[0].clientY-start.y)>14)) cancel();
  };
  const end = (event: TouchEvent) => {
    const previous=start; cancel();
    if (!previous || document.documentElement.dataset.input !== 'touch' || selected() || event.changedTouches.length!==1 || Date.now()-previous.at>600) return;
    const dx=event.changedTouches[0].clientX-previous.x, dy=event.changedTouches[0].clientY-previous.y;
    if(Math.abs(dx)>=70 && Math.abs(dy)<=14) turn(dx<0?1:-1);
  };
  const selection = () => { if(selected()) cancel(); };
  stage.addEventListener('touchstart',begin,{passive:true});
  stage.addEventListener('touchmove',move,{passive:true});
  stage.addEventListener('touchend',end,{passive:true});
  stage.addEventListener('touchcancel',cancel,{passive:true});
  document.addEventListener('selectionchange',selection);
  return () => { stage.removeEventListener('touchstart',begin);stage.removeEventListener('touchmove',move);stage.removeEventListener('touchend',end);stage.removeEventListener('touchcancel',cancel);document.removeEventListener('selectionchange',selection); };
}
