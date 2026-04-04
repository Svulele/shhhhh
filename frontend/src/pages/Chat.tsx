import { useState } from 'react'
import axios from 'axios'

interface Props { material: any }

export default function Chat({ material }: Props) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hey! I'm your study partner 🤖 Upload a PDF in the Library and I can answer questions, summarize chapters, or quiz you!` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const personality = localStorage.getItem('shhhh_personality') || 'friendly'
  const name = localStorage.getItem('shhhh_name') || 'Sbulele'

  const send = async () => {
    if (!input.trim()) return
    const msg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setLoading(true)

    try {
      const res = await axios.post('http://127.0.0.1:8000/api/chat/', {
        message: msg,
        personality,
        user_name: name,
        material_context: material?.content_text || '',
      })
      setMessages(prev => [...prev, { role: 'ai', text: res.data.reply }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Error: ' + (e.response?.data?.detail || 'Backend/API error') }])
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="card" style={{ borderRadius: '16px 16px 0 0', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #7c6af7, #4ecdc4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700 }}>Study Partner</div>
          <div style={{ fontSize: 12, color: '#4ecdc4' }}>● Ready to help</div>
        </div>
        {material && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#555570' }}>📖 {material.title}</div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, background: '#12121a', borderLeft: '1px solid #2a2a3a', borderRight: '1px solid #2a2a3a', padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
            {m.role === 'ai' && (
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c6af7,#4ecdc4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🤖</div>
            )}
            <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: 14, fontSize: 14, lineHeight: 1.6, background: m.role === 'user' ? '#7c6af7' : '#1a1a26', color: m.role === 'user' ? 'white' : '#f0f0f8', borderTopRightRadius: m.role === 'user' ? 4 : 14, borderTopLeftRadius: m.role === 'ai' ? 4 : 14 }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c6af7,#4ecdc4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
            <div style={{ background: '#1a1a26', padding: '10px 16px', borderRadius: 14, borderTopLeftRadius: 4, color: '#555570', fontSize: 14 }}>Thinking...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ background: '#12121a', border: '1px solid #2a2a3a', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: 16, display: 'flex', gap: 12 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask your study partner anything..."
          style={{ flex: 1, resize: 'none', height: 44 }} rows={1} />
        <button className="btn btn-primary" onClick={send} disabled={loading}>➤</button>
      </div>
    </div>
  )
}
