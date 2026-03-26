import { useEffect, useState } from 'react'
import axios from 'axios'

interface Props {
  material: any
  setPage: (p: any) => void
}

const QUOTES = [
  "Small progress is still progress. Keep going.",
  "The secret of getting ahead is getting started.",
  "Don't watch the clock. Do what it does. Keep going.",
  "You don't have to be great to start, but you have to start to be great.",
  "Success is the sum of small efforts repeated every day.",
]

export default function Dashboard({ material, setPage }: Props) {
  const [greeting, setGreeting] = useState('')
  const [quote, setQuote] = useState('')
  const [name, setName] = useState(localStorage.getItem('shhhh_name') || 'Sbulele')
  const [materials, setMaterials] = useState<any[]>([])

  useEffect(() => {
    const h = new Date().getHours()
    const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
    const e = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙'
    setGreeting(`${g}, ${name} ${e}`)
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)])
    fetchMaterials()
  }, [])

  const fetchMaterials = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/upload/materials')
      setMaterials(res.data)
    } catch (e) {}
  }

  return (
    <div>
      {/* Greeting */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: '#7c6af7', marginBottom: 8, textTransform: 'uppercase' }}>
          {new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>{greeting}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 50, padding: '6px 14px', fontSize: 13, color: '#8888aa' }}>
            🌤️ Durban, ZA
          </span>
          <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 50, padding: '6px 14px', fontSize: 13, color: '#8888aa' }}>
            🔥 Keep your streak going!
          </span>
        </div>
      </div>

      {/* Quote */}
      <div className="card" style={{ borderLeft: '3px solid #7c6af7', borderRadius: '0 12px 12px 0' }}>
        <div style={{ fontStyle: 'italic', color: '#8888aa', fontSize: 15 }}>"{quote}"</div>
      </div>

      {/* Study Progress */}
      <div className="card">
        <div className="card-title">Study Progress</div>
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#555570' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div>No materials yet —</div>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPage('library')}>
              Upload something
            </button>
          </div>
        ) : (
          materials.map((m: any) => (
            <div key={m.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#8888aa', marginBottom: 6 }}>
                <span>{m.title}</span>
                <span style={{ color: '#7c6af7' }}>{m.total_pages} pages</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: '25%' }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => setPage('chat')}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
          <div style={{ fontWeight: 600 }}>Ask Study Partner</div>
          <div style={{ fontSize: 13, color: '#555570', marginTop: 4 }}>Chat with your AI tutor</div>
        </div>
        <div className="card" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => setPage('pomodoro')}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏱️</div>
          <div style={{ fontWeight: 600 }}>Start Focus Session</div>
          <div style={{ fontSize: 13, color: '#555570', marginTop: 4 }}>25 min Pomodoro</div>
        </div>
      </div>
    </div>
  )
}