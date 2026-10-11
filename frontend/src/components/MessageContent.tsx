import type { ReactNode } from 'react'

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2,-2)}</strong>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1,-1)}</code>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={index}>{part.slice(1,-1)}</em>
    return part
  })
}

// Render a small safe Markdown subset as React nodes; never interpret HTML.
export default function MessageContent({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  for (let i = 0; i < lines.length;) {
    const key = i
    if (lines[i].startsWith('```')) {
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      if (i < lines.length) i++
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>)
    } else if (/^\s*[-•*] /.test(lines[i])) {
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*[-•*] /.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(/^\s*[-•*] /,''))}</li>)
      blocks.push(<ul key={key}>{items}</ul>)
    } else if (/^\s*\d+[.)] /.test(lines[i])) {
      const items: ReactNode[] = []
      const start = parseInt(lines[i].trim(), 10)
      while (i < lines.length && /^\s*\d+[.)] /.test(lines[i])) items.push(<li key={i}>{inline(lines[i++].replace(/^\s*\d+[.)] /,''))}</li>)
      blocks.push(<ol key={key} start={start}>{items}</ol>)
    } else if (lines[i].trim()) {
      blocks.push(<p key={key}>{inline(lines[i++].replace(/^#{1,6}\s+/,''))}</p>)
    } else i++
  }
  return <div className="message-content">{blocks}</div>
}
