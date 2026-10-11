/** One in-flight request and one owned sentinel per full-screen session. */
export function startWakeLock() {
  if (!navigator.wakeLock?.request) return () => {};
  let lock: WakeLockSentinel | null = null, cancelled = false, pending = false, retry = false;
  const release = (sentinel: WakeLockSentinel | null) => { if (sentinel) void sentinel.release().catch(() => {}); };
  const acquire = async () => {
    if (cancelled || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
    if (pending) { retry = true; return; }
    pending = true;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (cancelled || document.visibilityState !== 'visible') release(acquired);
      else lock = acquired;
    } catch { /* Optional capability, including permission/battery restrictions. */ }
    finally { pending = false; if (retry) { retry = false; if (!cancelled) void acquire(); } }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void acquire();
    else { const previous = lock; lock = null; release(previous); }
  };
  void acquire();
  document.addEventListener('visibilitychange', onVisibility);
  return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisibility); const previous = lock; lock = null; release(previous); };
}
