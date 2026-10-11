import { plural } from '../plural'
import { buildInfo } from '../buildInfo'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import { useUser } from '../App'
import { saveProfile as saveCloudProfile } from '../supabase'
import { AiVibePane, ConfirmDialog, DataPane, ProfilePane, SaveBar, SettingsHeader, SettingsTabs, StatTile, type LocationStatus, type Profile, type Tab } from '../components/settings/SettingsParts'
import '../components/settings/settings.css'

const load = (): Profile => {
  const defaults: Profile = { name: '', ai: 'claude', vibe: 'balanced', goals: [], location: '', lat: null, lon: null, onboarded: false }
  try { return { ...defaults, ...JSON.parse(localStorage.getItem('shh_profile') ?? '{}') } } catch { return defaults }
}
const persist = (profile: Profile) => localStorage.setItem('shh_profile', JSON.stringify(profile))
function getBooks(): { totalPages: number; currentPage: number }[] { try { const books = JSON.parse(localStorage.getItem('shh_books') ?? '[]'); return Array.isArray(books) ? books : [] } catch { return [] } }
function deleteLocalPdfStore(): Promise<void> {
  return new Promise(resolve => { const request = indexedDB.deleteDatabase('shh_pdf_db'); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve() })
}
// Goals are a set: changing only their order does not make the profile dirty.
const signature = (profile: Profile) => JSON.stringify({ ...profile, goals: [...profile.goals].sort() })
export default function Settings({ doSignOut }: { doSignOut?: () => void }) {
  const { user } = useUser()
  const [tab, setTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<Profile>(load)
  const [baseline, setBaseline] = useState(profile)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [error, setError] = useState('')
  const [locStatus, setLocStatus] = useState<LocationStatus>('idle')
  const [confirmClear, setConfirmClear] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  const locationVersion = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bypassWarning = useRef(false)
  const dirty = signature(profile) !== signature(baseline)
  const books = getBooks()
  const streak = Math.max(0, Number(localStorage.getItem('shh_streak')) || 0)
  const booksRead = books.filter(book => book.totalPages > 1 && book.currentPage >= book.totalPages).length
  const inProgress = books.filter(book => book.currentPage > 1 && book.currentPage < book.totalPages).length

  useEffect(() => { alive.current = true; return () => { alive.current = false; if (toastTimer.current) clearTimeout(toastTimer.current) } }, [])
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!bypassWarning.current) { event.preventDefault(); event.returnValue = '' } }
    const beforeLeave = (event: Event) => { if (bypassWarning.current) return; if (!window.confirm(busy ? 'Your changes are still being saved. Leave this page?' : 'You have unsaved changes. Leave without saving?')) event.preventDefault(); else bypassWarning.current = true }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('shh:before-leave', beforeLeave)
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('shh:before-leave', beforeLeave) }
  }, [dirty, busy])
  const update = (patch: Partial<Profile>) => { setProfile(current => ({ ...current, ...patch })); setSaved(false); setError(''); if (patch.name !== undefined) setNameError(false) }
  const restoreSaveFocus = () => { if (document.activeElement?.closest('.settings-save')) requestAnimationFrame(() => document.querySelector<HTMLElement>('.settings-tabs [aria-selected=true]')?.focus()) }
  const discard = () => { restoreSaveFocus(); locationVersion.current++; setProfile(baseline); setNameError(false); setError(''); setLocStatus('idle') }
  const save = async () => {
    if (busy || locStatus === 'asking') return
    if (!profile.name.trim()) { setNameError(true); setTab('profile'); requestAnimationFrame(() => nameRef.current?.focus()); return }
    const next = { ...profile, name: profile.name.trim() }
    setBusy(true); setError('')
    try {
      persist(next)
      if (user) {
        const cloudSave = saveCloudProfile(user.id, { name: next.name, ai: next.ai, vibe: next.vibe, goals: next.goals, location: next.location, lat: next.lat, lon: next.lon })
        // The existing cloud helper also writes locally; keep local-only onboarding fields.
        persist(next)
        await cloudSave
      }
      if (!alive.current) return
      restoreSaveFocus(); setProfile(next); setBaseline(next); setSaved(true)
      window.dispatchEvent(new Event('shh:profile-updated'))
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setSaved(false), 2000)
    } catch { if (alive.current) setError('Could not save your changes. Please try again.') }
    finally { if (alive.current) setBusy(false) }
  }
  const requestLocation = () => {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    const version = ++locationVersion.current
    setLocStatus('asking')
    navigator.geolocation.getCurrentPosition(async position => {
      const lat = Number(position.coords.latitude.toFixed(2)), lon = Number(position.coords.longitude.toFixed(2))
      let location: string | undefined
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
        const data = await response.json()
        location = data.address?.city || data.address?.town || data.address?.state || 'your area'
      } catch { /* retain existing place name if city lookup is unavailable */ }
      if (!alive.current || version !== locationVersion.current) return
      update({ lat, lon, ...(location ? { location } : {}) }); setLocStatus('done')
    }, () => { if (alive.current && version === locationVersion.current) setLocStatus('denied') })
  }
  const clearAll = async () => {
    bypassWarning.current = true
    localStorage.clear()
    await deleteLocalPdfStore()
    window.location.reload()
  }
  const restartTour = () => {
    if (!window.dispatchEvent(new Event('shh:before-leave', { cancelable: true }))) return
    bypassWarning.current = true
    localStorage.removeItem('shh_tour_done')
    window.dispatchEvent(new CustomEvent('shh:restart-tour'))
  }
  return <div className="page-scroll settings-workspace"><div className="settings-content"><SettingsHeader name={profile.name} email={user?.email} onSignOut={doSignOut} /><div className="settings-stats"><StatTile label="Streak" value={plural(streak, 'day')} icon="flame" tint="amber" /><StatTile label="Books read" value={booksRead} icon="library" tint="accent" /><StatTile label="In progress" value={inProgress} icon="book" tint="green" /></div><SettingsTabs tab={tab} setTab={setTab} /><div key={tab} id={`settings-panel-${tab}`} role="tabpanel" aria-labelledby={`settings-tab-${tab}`} tabIndex={0} className="settings-pane"><fieldset className="settings-fields" disabled={busy}><legend className="sr-only">{tab === 'profile' ? 'Profile preferences' : tab === 'ai' ? 'AI and study style preferences' : 'Data controls'}</legend>{tab === 'profile' && <ProfilePane profile={profile} update={update} inputRef={nameRef} nameError={nameError} locationStatus={locStatus} requestLocation={requestLocation} />}{tab === 'ai' && <AiVibePane profile={profile} update={update} />}{tab === 'data' && <DataPane email={user?.email} restartTour={restartTour} clearAll={() => setConfirmClear(true)} />}</fieldset></div><footer className="settings-build">Build {buildInfo.shortHash} · <time dateTime={buildInfo.builtAt}>{buildInfo.builtAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}</time></footer>{error && <p className="settings-error" role="alert">{error}</p>}{dirty && <SaveBar discard={discard} save={() => void save()} busy={busy} locating={locStatus === 'asking'} />}<div className={`settings-toast ${saved ? 'visible' : ''}`} role="status" aria-live="polite">{saved && <><Icon name="check" size={20} />Changes saved</>}</div>{confirmClear && <ConfirmDialog onCancel={() => setConfirmClear(false)} onConfirm={() => void clearAll()} />}</div></div>
}
