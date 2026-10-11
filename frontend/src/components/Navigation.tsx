import { useEffect, useRef, useState } from 'react'
import type { Page } from '../App'
import Icon from './Icon'

const items: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Home', icon: 'home' },
  { page: 'chat', label: 'Ask AI', icon: 'ask' },
  { page: 'library', label: 'Library', icon: 'library' },
  { page: 'pomodoro', label: 'Focus', icon: 'focus' },
  { page: 'notes', label: 'Notes', icon: 'notes' },
  { page: 'plan', label: 'Plan', icon: 'plan' },
  { page: 'flashcards', label: 'Flashcards', icon: 'cards' },
]
export function AccountMenu({ navigate, signOut }: { navigate: (p: Page) => void; signOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  let name = 'Student'
  try { name = JSON.parse(localStorage.getItem('shh_profile') || '{}').name || name } catch { /* use default */ }
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])
  return <div className="account-wrap" ref={ref} onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
    <button className="account-card" aria-expanded={open} aria-label={`Account for ${name}`} onClick={() => setOpen(!open)}>
      <span className="account-avatar">{name.slice(0, 1).toUpperCase()}</span><span className="account-copy"><strong>{name}</strong><small>Your study space</small></span><Icon name="chevron" size={16} />
    </button>
    {open && <div className="account-menu">
      {[{ page: 'settings' as Page, label: 'Profile & settings', icon: 'user' }].map(item => <button key={item.label} onClick={() => { navigate(item.page); setOpen(false) }}><Icon name={item.icon} size={18} />{item.label}</button>)}
      <div className="account-mobile-links">{items.slice(4).map(item => <button key={item.page} onClick={() => { navigate(item.page); setOpen(false) }}><Icon name={item.icon} size={18} />{item.label}</button>)}</div>
      <button onClick={() => { window.dispatchEvent(new Event('shh:feedback')); setOpen(false) }}><Icon name="feedback" size={18} />Feedback</button>
      <button onClick={signOut}><Icon name="logout" size={18} />Sign out</button>
    </div>}
  </div>
}
export default function Navigation({ page, navigate, signOut, open, setOpen }: { page: Page; navigate: (p: Page) => void; signOut: () => void; open: boolean; setOpen: (v: boolean) => void }) {
  const home = page === 'dashboard'
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!home && <button className="sidebar-hint" aria-label="Reveal navigation" onFocus={() => setOpen(true)} onMouseEnter={() => setOpen(true)} onClick={() => setOpen(true)} />}
    <aside className={`study-sidebar ${home || open ? 'revealed' : ''}`} onMouseEnter={() => setOpen(true)} onMouseLeave={e => { if (!e.currentTarget.contains(document.activeElement)) setOpen(false) }} onFocusCapture={() => setOpen(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}>
      <button className="sidebar-brand" onClick={() => navigate('dashboard')}>Shhhhh<span>Your quiet study space</span></button>
      <nav aria-label="Main navigation">{items.map((item, i) => <button key={item.page} data-tour={item.page} aria-current={page === item.page ? 'page' : undefined} className={`sidebar-item ${page === item.page ? 'active' : ''}`} style={{ animationDelay: `${i * 35}ms` }} onClick={() => { navigate(item.page); setOpen(false) }}><Icon name={item.icon} size={20} />{item.label}</button>)}</nav>
      <AccountMenu navigate={navigate} signOut={signOut} />
    </aside>
    <nav className="mobile-tabs" aria-label="Mobile navigation">{items.slice(0, 4).map(item => <button key={item.page} aria-current={page === item.page ? 'page' : undefined} onClick={() => navigate(item.page)}><Icon name={item.icon} size={21} /><span>{item.label}</span></button>)}</nav>
  </>
}
