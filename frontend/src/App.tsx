import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import Chat from './pages/Chat'
import Pomodoro from './pages/Pomodoro'
import Settings from './pages/Settings'
import './App.css'

type Page = 'dashboard' | 'library' | 'chat' | 'pomodoro' | 'settings'

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [material, setMaterial] = useState<any>(null)

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">Sh</div>
        <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}>🏠</button>
        <button className={page === 'library' ? 'active' : ''} onClick={() => setPage('library')}>📚</button>
        <button className={page === 'chat' ? 'active' : ''} onClick={() => setPage('chat')}>🤖</button>
        <button className={page === 'pomodoro' ? 'active' : ''} onClick={() => setPage('pomodoro')}>⏱️</button>
        <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>👤</button>
      </nav>
      <main className="main">
        {page === 'dashboard' && <Dashboard material={material} setPage={setPage} />}
        {page === 'library' && <Library setMaterial={setMaterial} setPage={setPage} />}
        {page === 'chat' && <Chat material={material} />}
        {page === 'pomodoro' && <Pomodoro />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}

export default App