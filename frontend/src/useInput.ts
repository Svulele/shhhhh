import { useSyncExternalStore } from 'react';

const subscribeInput = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-input'] });
  return () => mo.disconnect();
};
export const useInputMode = () =>
  useSyncExternalStore(subscribeInput, () => document.documentElement.dataset.input ?? 'mouse', () => 'mouse');

export function useMediaQuery(q: string) {
  return useSyncExternalStore(
    cb => { const m = matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(q).matches,
    () => false
  );
}
export const useIsCompact = () => useMediaQuery('(max-width: 560px)');
export const useIsStandalone = () => useMediaQuery('(display-mode: standalone)');
