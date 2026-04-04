export default function Settings() {
    const save = (key: string, val: string) => localStorage.setItem(key, val)
  
    return (
      <div>
        <div className="page-title">Profile & Settings</div>
  
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#7c6af7,#f97b6b)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800 }}>S</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>Sbulele</div>
            <div style={{ fontSize: 14, color: '#555570' }}>Student · Durban, ZA</div>
          </div>
        </div>
  
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">Your Name</div>
          <input defaultValue={localStorage.getItem('shhhh_name') || 'Sbulele'}
            onChange={e => save('shhhh_name', e.target.value)}
            style={{ width: '100%' }} placeholder="Your name" />
        </div>
  
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-title">API Key Setup</div>
          <div style={{ fontSize: 13, color: '#555570' }}>
            API key is now read securely from the backend file <strong style={{ color: '#7c6af7' }}>backend/key.env</strong>.
          </div>
        </div>
  
        <div className="card">
          <div className="card-title">Study Partner Personality</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {['friendly', 'strict', 'calm', 'hype'].map(p => (
              <button key={p} className="btn"
                style={{ background: localStorage.getItem('shhhh_personality') === p ? '#7c6af7' : 'transparent', color: localStorage.getItem('shhhh_personality') === p ? 'white' : '#8888aa', border: '1px solid #2a2a3a' }}
                onClick={() => { save('shhhh_personality', p); window.location.reload() }}>
                {p === 'friendly' ? '😊 Friendly' : p === 'strict' ? '💪 Strict' : p === 'calm' ? '🧘 Calm' : '🔥 Hype'}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
