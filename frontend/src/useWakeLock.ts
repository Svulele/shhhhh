import { useEffect } from 'react';
import { startWakeLock } from './wakeLockSession';
export function useWakeLock(active: boolean) {
  useEffect(() => { if (active) return startWakeLock(); }, [active]);
}
