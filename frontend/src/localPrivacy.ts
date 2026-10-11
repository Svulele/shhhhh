let pendingCleanup: Promise<void> = Promise.resolve()
export function waitForDeviceCleanup() { return pendingCleanup }
export function clearStudyDeviceData(): Promise<void> {
  // Keep only the visual theme; study and permission state belongs to the departing user.
  Object.keys(localStorage).filter(key=>key.startsWith('shh_')&&key!=='shh_theme').forEach(key=>localStorage.removeItem(key))
  Object.keys(sessionStorage).filter(key=>key.startsWith('shh_')).forEach(key=>sessionStorage.removeItem(key))
  window.dispatchEvent(new Event('shh:clear-device-data'))
  pendingCleanup = Promise.all(['shh_pdf_db','shh_pdfs','shh-library'].map(name=>new Promise<void>(resolve=>{
    const request=indexedDB.deleteDatabase(name)
    request.onsuccess=()=>resolve()
    request.onerror=()=>resolve()
    request.onblocked=()=>resolve() // Open tab can hold the database; next owner still cannot use old local book IDs.
  }))).then(()=>undefined)
  return pendingCleanup
}
