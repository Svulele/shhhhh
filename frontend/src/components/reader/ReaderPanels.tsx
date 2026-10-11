import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useModalFocus from '../useModalFocus';
import Icon from '../Icon';
import type { ReaderNote } from './types';
export function NotesPanel({ notes, page, onSave, onDelete, onClose }: {
    notes: ReaderNote[];
    page: number;
    onSave: (text: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}) { const ref = useRef<HTMLElement>(null), [draft, setDraft] = useState(''); useModalFocus(ref, true, onClose); return <aside className="reader-notes" role="dialog" aria-modal="true" aria-label="Notes" ref={ref}><div className="reader-panel-heading"><h2>Notes</h2><button className="reader-round" aria-label="Close notes panel" onClick={onClose}><Icon name="close" size={18}/></button></div><div className="reader-note-compose"><label htmlFor="reader-note-draft">Note for page {page}</label><textarea id="reader-note-draft" placeholder="Add your own thoughts…" value={draft} onChange={e => setDraft(e.target.value)} rows={3}/><button className="reader-button" disabled={!draft.trim()} onClick={() => { if (draft.trim()) {
    onSave(draft.trim());
    setDraft('');
} }}>Save note</button></div><div className="reader-note-list">{!notes.length && <p className="reader-empty">Select text in the page to highlight it or save a note.</p>}{[...notes].reverse().map(note => <article className="reader-note" key={note.id}><span>PAGE {note.page}{note.id.startsWith('hl_') ? ' · HIGHLIGHT' : ''}</span><blockquote>{note.text}</blockquote><button className="reader-round" aria-label={`Delete note from page ${note.page}`} onClick={() => onDelete(note.id)}><Icon name="trash" size={15}/></button></article>)}</div></aside>; }
export function SessionComplete({ recap, onClose, onAsk }: {
    recap: {
        fromPage: number;
        toPage: number;
        summary: string[];
    };
    onClose: () => void;
    onAsk: (question?: string) => void;
}) { const ref = useRef<HTMLElement>(null); useModalFocus(ref, true, onClose); const single = recap.fromPage === recap.toPage; const fallback = single ? `Page ${recap.fromPage}` : `Pages ${recap.fromPage}–${recap.toPage}`; const topics = recap.summary.filter(s => s.trim() && !/^(failed to fetch|(?:network|type)error:|recap unavailable|could not (?:load|extract|fetch)|network request failed)/i.test(s)); return createPortal(<div className="reader-complete-scrim" onClick={e => { if (e.target === e.currentTarget)
    onClose(); }}><section className="reader-complete" role="dialog" aria-modal="true" aria-label="Session complete" ref={ref}><p className="reader-eyebrow">Session complete</p><h2>{single ? `You read page ${recap.fromPage}` : `You read pages ${recap.fromPage}–${recap.toPage}`}</h2><p className="reader-eyebrow">What you covered</p><ul className="reader-covered">{(topics.length ? topics : [fallback]).map((topic, i) => <li key={i}><Icon name="check" size={18}/><span>{topic}</span></li>)}</ul><p className="reader-eyebrow">Tap to ask the AI</p><div className="reader-suggestions">{['Summarise these pages', 'Quiz me', 'Explain it simply'].map(q => <button className="reader-button" key={q} onClick={() => onAsk(q)}>{q}</button>)}</div><div className="reader-complete-footer"><button className="reader-button ghost" onClick={onClose}>Back to shelf</button><button className="reader-button primary" onClick={() => onAsk()}>Open AI chat<Icon name="arrow" size={17}/></button></div></section></div>, document.body); }
