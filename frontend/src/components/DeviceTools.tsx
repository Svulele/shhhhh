import { useEffect, useState } from 'react';
import { useInputMode, useIsStandalone } from '../useInput';

export default function DeviceTools() {
  const mode = useInputMode(), standalone = useIsStandalone();
  const [tip, setTip] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'touch' || standalone) return;
    try {
      if (localStorage.getItem('shh_home_tip_dismissed') || sessionStorage.getItem('shh_home_tip_seen')) return;
      sessionStorage.setItem('shh_home_tip_seen', '1');
      setTip(true);
    } catch { /* Storage unavailable: omit the tip rather than repeat it. */ }
  }, [mode, standalone]);
  if (mode !== 'touch') return null;
  const dismiss = () => { setTip(false); try { localStorage.setItem('shh_home_tip_dismissed', '1'); } catch { /* session flag still prevents repeats */ } };
  const share = async () => {
    setError('');
    try { await navigator.share({ title: 'Shhhhh', text: 'A quieter place to study.', url: location.origin }); }
    catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError('Sharing is unavailable right now. Please try again.'); }
  };
  return <div className="device-tools">
    {typeof navigator.share === 'function' && <button className="ui-button" onClick={() => void share()}>Share Shhhhh</button>}
    {tip && !standalone && <aside className="home-screen-tip"><p>Add Shhhhh to your Home Screen using your browser’s menu or Share options.</p><button className="ui-button" onClick={dismiss} aria-label="Dismiss Add to Home Screen tip">Dismiss</button></aside>}
    {error && <p role="status">{error}</p>}
  </div>;
}
