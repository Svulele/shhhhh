import { useEffect, useRef, useState } from 'react';
import { timerStore } from '../../timerStore';
import { useTheme } from '../../App';
import useModalFocus from '../useModalFocus';
import Icon from '../Icon';
import { EXAM_TAGS, type ExamMarkTag } from '../../examMarks';
import type { ReaderPreferences, SelectionData } from './types';
export function ReaderTopBar({ title, page, total, progress, mode, onMode, onBack, onSettings, onNotes, onDone, settingsOpen, notesOpen }: {
    title: string;
    page: number;
    total: number;
    progress: number;
    mode: 'ebook' | 'pdf';
    onMode: (m: 'ebook' | 'pdf') => void;
    onBack: () => void;
    onSettings: () => void;
    onNotes: () => void;
    onDone: () => void;
    settingsOpen: boolean;
    notesOpen: boolean;
}) {
    const [timer, setTimer] = useState(timerStore.get);
    useEffect(() => timerStore.subscribe(setTimer), []);
    const time = `${String(Math.floor(timer.left / 60)).padStart(2, '0')}:${String(timer.left % 60).padStart(2, '0')}`;
    return <><header className="reader-topbar"><button className="reader-round" aria-label="Back to library" onClick={onBack}><Icon name="back" size={19}/></button><div className="reader-title"><strong>{title}</strong><small>eBook · p.{page}/{total} · {Math.round(page / total * 100)}%</small></div><button className="reader-timer" aria-label={`${timer.running ? 'Pause' : 'Start'} focus timer, ${time} remaining`} onClick={timerStore.toggle}><span className={`timer-dot ${timer.running ? 'running' : ''}`}/>{time}</button><div className="reader-segment" role="tablist" aria-label="Reading view">{(['ebook', 'pdf'] as const).map((m, i) => <button key={m} role="tab" aria-selected={m === mode} tabIndex={m === mode ? 0 : -1} aria-label={m === 'ebook' ? 'Reader' : 'PDF'} onClick={() => onMode(m)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const next = e.key === 'Home' ? 'ebook' : e.key === 'End' ? 'pdf' : m === 'ebook' ? 'pdf' : 'ebook';
        onMode(next);
        (e.currentTarget.parentElement?.children[next === 'ebook' ? 0 : 1] as HTMLElement)?.focus();
    } }}><Icon name={i ? 'notes' : 'book'} size={16}/><span>{i ? 'PDF' : 'Reader'}</span></button>)}</div><button className="reader-round reader-settings-trigger" aria-label="Reading settings" aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={onSettings}>Aa</button><button className="reader-button reader-notes-trigger" aria-label="Notes" aria-haspopup="dialog" aria-expanded={notesOpen} onClick={onNotes}><Icon name="edit" size={16}/><span>Notes</span></button><button className="reader-button primary" onClick={onDone}>Done</button><div className="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }}/></div></header>{timer.running && <button className="reader-mini-timer" aria-label={`Pause focus timer, ${time} remaining`} onClick={timerStore.toggle}><span className="timer-dot running"/>{time}<Icon name="pause" size={13}/></button>}</>;
}
export function ReaderSettings({ preferences, onChange, onClose }: {
    preferences: ReaderPreferences;
    onChange: (p: ReaderPreferences) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useModalFocus(ref, true, onClose);
    const { theme, toggle } = useTheme();
    useEffect(() => { const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest('.reader-settings-trigger'))
        onClose(); }; document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside); }, [onClose]);
    const patch = (p: Partial<ReaderPreferences>) => onChange({ ...preferences, ...p });
    return <div className="reader-settings" role="dialog" aria-modal="true" aria-label="Reading settings" ref={ref}><div className="reader-panel-heading"><h2>Reading settings</h2><button className="reader-round" aria-label="Close reading settings" onClick={onClose}><Icon name="close" size={17}/></button></div><label className="reader-setting-row">Text size <span><input type="range" min={16} max={26} value={preferences.size} onChange={e => patch({ size: Number(e.target.value) })}/><output>{preferences.size}px</output></span></label><fieldset><legend>Typeface</legend><div className="reader-setting-options">{(['serif', 'sans'] as const).map(v => <button key={v} aria-pressed={preferences.typeface === v} onClick={() => patch({ typeface: v })}>{v === 'serif' ? 'Serif' : 'Sans'}</button>)}</div></fieldset><fieldset><legend>Spacing</legend><div className="reader-setting-options">{([{ value: 1.55, label: 'Tight' }, { value: 1.8, label: 'Cozy' }, { value: 2.1, label: 'Airy' }] as const).map(({ value, label }) => <button key={value} aria-pressed={preferences.spacing === value} onClick={() => patch({ spacing: value })}>{label}</button>)}</div></fieldset><fieldset><legend>Columns</legend><div className="reader-setting-options">{([1, 2] as const).map(v => <button key={v} aria-pressed={preferences.columns === v} onClick={() => patch({ columns: v })}>{v === 1 ? 'One' : 'Two'}</button>)}</div></fieldset><fieldset><legend>Page tone</legend><div className="reader-tone-options">{(['default', 'paper', 'sepia', 'night'] as const).map(tone => <button key={tone} className={`tone-${tone}`} aria-label={`${tone} page tone`} aria-pressed={preferences.tone === tone} onClick={() => patch({ tone })}/>)}</div></fieldset><div className="reader-setting-row"><span>App theme</span><button className="reader-button" onClick={toggle}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15}/>{theme === 'dark' ? 'Light' : 'Dark'}</button></div></div>;
}
export function PageDock({ page, total, mode, zoom, onPage, onZoom }: {
    page: number;
    total: number;
    mode: 'ebook' | 'pdf';
    zoom: number;
    onPage: (p: number) => void;
    onZoom: (z: number) => void;
}) { return <nav className="reader-dock" aria-label="PDF page navigation"><button className="reader-round" aria-label="Previous PDF page" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="back" size={18}/></button><span className="reader-page-label">Page {page} of {total}<small>{Math.round(page / total * 100)}% read</small></span><button className="reader-round" aria-label="Next PDF page" disabled={page >= total} onClick={() => onPage(page + 1)}><Icon name="chevron" size={18}/></button>{mode === 'pdf' && <div className="reader-zoom-controls"><span className="reader-dock-divider"/><button className="reader-round" aria-label="Zoom out" disabled={zoom <= .7} onClick={() => onZoom(Math.max(.7, Math.round((zoom - .1) * 10) / 10))}><Icon name="minus" size={17}/></button><span className="reader-zoom">{Math.round(zoom * 100)}%</span><button className="reader-round" aria-label="Zoom in" disabled={zoom >= 1.6} onClick={() => onZoom(Math.min(1.6, Math.round((zoom + .1) * 10) / 10))}><Icon name="plus" size={17}/></button></div>}</nav>; }
export function SelectionToolbar({ selection, onHighlight, onNote, onAsk, onCard, onExam }: {
    selection: SelectionData;
    onHighlight: () => void;
    onNote: () => void;
    onAsk: () => void;
    onCard: () => void;
    onExam: (tag: ExamMarkTag) => void;
}) { const ref = useRef<HTMLDivElement>(null); const [examOpen, setExamOpen] = useState(false); const [position, setPosition] = useState({ x: selection.x, y: selection.y }); useEffect(() => { const frame = requestAnimationFrame(() => { const box = ref.current?.getBoundingClientRect(); if (box)
    setPosition({ x: Math.max(box.width / 2 + 8, Math.min(selection.x, innerWidth - box.width / 2 - 8)), y: Math.max(box.height + 8, selection.y) }); }); return () => cancelAnimationFrame(frame); }, [selection, examOpen]); return <div ref={ref} className="reader-selection" role="toolbar" aria-label="Selected text actions" style={{ left: position.x, top: position.y }} onPointerDown={e => e.preventDefault()}>{[{ label: 'Highlight', icon: 'highlight', action: onHighlight }, { label: 'Note', icon: 'edit', action: onNote }, { label: 'Ask AI', icon: 'ask', action: onAsk }, { label: 'Card', icon: 'cards', action: onCard }].map(({ label, icon, action }) => <button key={label} onClick={action}><Icon name={icon} size={16}/>{label}</button>)}<button aria-expanded={examOpen} onClick={() => setExamOpen(v => !v)}><Icon name="target" size={16}/>Exam</button>{examOpen && <div className="reader-exam-options" role="group" aria-label="Exam mark types">{(Object.keys(EXAM_TAGS) as ExamMarkTag[]).map(tag => <button key={tag} onClick={() => onExam(tag)}>{EXAM_TAGS[tag].label}</button>)}</div>}</div>; }
