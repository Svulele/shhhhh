import { useState, useEffect } from 'react'
import axios from 'axios'

interface Props {
  setMaterial: (m: any) => void
  setPage: (p: any) => void
}

export default function Library({ setMaterial, setPage }: Props) {
  const [materials, setMaterials] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => { fetchMaterials() }, [])

  const fetchMaterials = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/api/upload/materials')
      setMaterials(res.data)
    } catch (e) {}
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/upload/', form)
      setMaterials(prev => [...prev, res.data])
      setSelected(res.data)
      setMaterial(res.data)
    } catch (e) {
      alert('Upload failed. Is the backend running?')
    }
    setUploading(false)
  }

  return (
    <div>
      <div className="page-title">My Library</div>

      {/* Upload zone */}
      <label style={{ display: 'block', cursor: 'pointer' }}>
        <input type="file" accept=".pdf,.txt" onChange={handleUpload} style={{ display: 'none' }} />
        <div className="card" style={{ border: '2px dashed #2a2a3a', textAlign: 'center', padding: 48, transition: 'all 0.2s' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            {uploading ? 'Uploading...' : 'Drop your study material here'}
          </div>
          <div style={{ fontSize: 14, color: '#555570' }}>PDF or TXT · Click to browse</div>
        </div>
      </label>

      {/* Materials list */}
      <div style={{ marginTop: 24 }}>
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#555570', padding: 40 }}>
            <div style={{ fontSize: 40 }}>📚</div>
            <div style={{ marginTop: 12 }}>No materials yet</div>
          </div>
        ) : (
          materials.map((m: any) => (
            <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', marginBottom: 12, border: selected?.id === m.id ? '1px solid #7c6af7' : '1px solid #2a2a3a' }}
              onClick={() => { setSelected(m); setMaterial(m) }}>
              <div style={{ width: 44, height: 44, background: 'rgba(124,106,247,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                📕
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{m.title}</div>
                <div style={{ fontSize: 13, color: '#555570' }}>{m.total_pages} pages</div>
              </div>
              <button className="btn btn-primary" onClick={() => setPage('chat')}>Ask AI</button>
            </div>
          ))
        )}
      </div>

      {/* Preview */}
      {selected?.preview && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-title">Preview</div>
          <div style={{ fontSize: 14, color: '#8888aa', lineHeight: 1.8, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
            {selected.preview}
          </div>
        </div>
      )}
    </div>
  )
}