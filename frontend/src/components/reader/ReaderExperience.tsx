import { keyboardShortcutsEnabled } from '../../useInputMode'
import useOverlayBack from '../useOverlayBack';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-600.css';
import '@fontsource/newsreader/latin-400-italic.css';
import { memo, useMemo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { addExamMark } from '../../examMarks';
import { ReaderTopBar, ReaderSettings, PageDock, SelectionToolbar } from './ReaderControls';
import { NotesPanel } from './ReaderPanels';
import { ReaderPage, PdfPage } from './ReaderPages';
import { readNotes, writeNotes, readPreferences, type DocumentBundle, type PageText, type ReaderBook, type ReaderNote, type ReaderPreferences, type SelectionData } from './types';
import './reader.css';
interface Props {
    book: ReaderBook;
    buffer: ArrayBuffer;
    currentPage: number;
    totalPages: number;
    settingsKey: string;
    loadDocument: (id: string, buf: ArrayBuffer) => Promise<DocumentBundle>;
    loadText: (id: string, buf: ArrayBuffer, page: number) => Promise<PageText>;
    onPage: (page: number) => void;
    onTotal: (total: number) => void;
    onClose: () => void;
    onDone: (headings: string[]) => void;
    onAsk: (text: string, from: number, to: number) => void;
}
const PageSlot = memo(function PageSlot({ page, root, book, buffer, mode, zoom, notes, loadDocument, loadText, onText, onReady, onPdf }: {
    page: number;
    root: HTMLDivElement | null;
    book: ReaderBook;
    buffer: ArrayBuffer;
    mode: 'ebook' | 'pdf';
    zoom: number;
    notes: ReaderNote[];
    loadDocument: Props['loadDocument'];
    loadText: Props['loadText'];
    onText: (p: number, data: PageText) => void;
    onReady: (p: number) => void;
    onPdf: () => void;
}) {
    const [measuredHeight, setMeasuredHeight] = useState(() => Math.max(900, innerHeight));
    const ref = useRef<HTMLElement>(null), [near, setNear] = useState(false), [data, setData] = useState<PageText>(), [error, setError] = useState('');
    const callbacks = useRef({ onText, onReady });
    useEffect(() => { callbacks.current = { onText, onReady }; }, [onText, onReady]);
    useEffect(() => { if (!root || !ref.current)
        return; const observer = new IntersectionObserver(entries => { if (ref.current && !entries[0].isIntersecting) setMeasuredHeight(ref.current.getBoundingClientRect().height); setNear(entries[0].isIntersecting); if(!entries[0].isIntersecting){setData(undefined);setError('');} }, { root, rootMargin: '380px 0px' }); observer.observe(ref.current); return () => observer.disconnect(); }, [root]);
    useEffect(() => { if (!near || data || error)
        return; let active = true; void Promise.all([loadText(book.id, buffer, page), document.fonts.load('19px Newsreader'), document.fonts.load('600 19px Newsreader')]).then(([value]) => { if (active) {
        setData(value);
        callbacks.current.onText(page, value);
    } }).catch(() => { if (active)
        setError('Text could not be extracted from this page.'); }); return () => { active = false; }; }, [near, data, error, book.id, buffer, page, loadText]);
    useEffect(() => { if (data)
        callbacks.current.onReady(page); }, [data, page, mode]);
    return <section className={`reader-page-slot ${mode === 'pdf' ? 'pdf-slot' : ''} ${data ? 'page-loaded' : ''}`} data-page-number={page} ref={ref} style={!near || (mode === 'ebook' && !data && !error) ? { minHeight: measuredHeight } : undefined}>{!near ? null : mode === 'pdf' ? <PdfPage page={page} bookId={book.id} buffer={buffer} zoom={zoom} active={near} notes={notes} loadDocument={loadDocument}/> : <ReaderPage page={page} data={data} loading={!data && !error} error={error} notes={notes} onPdf={onPdf}/>}</section>;
});
export default function ReaderExperience({ book, buffer, currentPage, totalPages, settingsKey, loadDocument, loadText, onPage, onTotal, onClose, onDone, onAsk }: Props) {
    useOverlayBack(true, onClose);
    const [mode, setMode] = useState<'ebook' | 'pdf'>('ebook'), [preferences, setPreferences] = useState(() => readPreferences(settingsKey)), [settings, setSettings] = useState(false), [notesOpen, setNotesOpen] = useState(false), [notes, setNotes] = useState(readNotes), [selection, setSelection] = useState<SelectionData | null>(null), [zoom, setZoom] = useState(1), [progress, setProgress] = useState(currentPage / totalPages * 100), [stage, setStage] = useState<HTMLDivElement | null>(null), [announcement, setAnnouncement] = useState('');
    const shell = useRef<HTMLDivElement>(null), pageRef = useRef(currentPage), initialPage = useRef(currentPage), pendingInitial = useRef(true), textPages = useRef(new Map<number, PageText>()), bounds = useRef({ min: currentPage, max: currentPage }), latest = useRef({ onPage, onTotal, onDone, onAsk, totalPages });
    useEffect(() => { latest.current = { onPage, onTotal, onDone, onAsk, totalPages }; pageRef.current = currentPage; }, [onPage, onTotal, onDone, onAsk, totalPages, currentPage]);
    useEffect(() => { const app = document.querySelector<HTMLElement>('.app'), was = app?.inert; if (app)
        app.inert = true; const previous = document.activeElement as HTMLElement | null; shell.current?.querySelector<HTMLElement>('button')?.focus(); return () => { if (app)
        app.inert = was || false; if (previous?.isConnected)
        previous.focus(); }; }, []);
    const scrollToPage = useCallback((page: number) => { if (!stage)
        return; const target = stage.querySelector<HTMLElement>(`[data-page-number="${page}"]`); if (target)
        stage.scrollTo({ top: stage.scrollTop + target.getBoundingClientRect().top - stage.getBoundingClientRect().top - 26, behavior: 'instant' }); }, [stage]);
    useEffect(() => { if (stage)
        scrollToPage(initialPage.current); }, [stage, scrollToPage]);
    const onReady = useCallback((page: number) => { if (pendingInitial.current && page === initialPage.current) {
        pendingInitial.current = false;
        requestAnimationFrame(() => scrollToPage(page));
    } }, [scrollToPage]);
    const onText = useCallback((page: number, data: PageText) => { textPages.current.set(page, data); if(textPages.current.size > 12) textPages.current.delete(textPages.current.keys().next().value!); latest.current.onTotal(data.totalPages); }, []);
    const go = useCallback((next: number) => { const page = Math.max(1, Math.min(next, latest.current.totalPages)); pendingInitial.current = false; bounds.current = { min: Math.min(bounds.current.min, page), max: Math.max(bounds.current.max, page) }; latest.current.onPage(page); scrollToPage(page); setSelection(null); }, [scrollToPage]);
    useEffect(() => { if (!stage)
        return; let frame = 0;
        const candidates = new Map<number, HTMLElement>();
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                const element = entry.target as HTMLElement, page = Number(element.dataset.pageNumber);
                if (entry.isIntersecting) candidates.set(page, element); else candidates.delete(page);
            }
        }, { root: stage });
        stage.querySelectorAll<HTMLElement>('[data-page-number]').forEach(element => observer.observe(element));
        const scroll = () => { if (frame)
        return; frame = requestAnimationFrame(() => { frame = 0; setSelection(null); const top = stage.getBoundingClientRect().top + Math.min(100, stage.clientHeight * .15), pages = Array.from(candidates.values()).sort((a, b) => Number(a.dataset.pageNumber) - Number(b.dataset.pageNumber)); const visible = pages.find(el => el.getBoundingClientRect().bottom > top) || pages[pages.length - 1]; if (!visible)
        return; const n = Number(visible.dataset.pageNumber), rect = visible.getBoundingClientRect(), fraction = Math.max(0, Math.min(1, (top - rect.top) / rect.height)); setProgress(Math.round(Math.max(0, Math.min(100, (n - 1 + fraction) / latest.current.totalPages * 100)))); if (n !== pageRef.current && !pendingInitial.current) {
        bounds.current = { min: Math.min(bounds.current.min, n), max: Math.max(bounds.current.max, n) };
        latest.current.onPage(n);
    } }); }; stage.addEventListener('scroll', scroll, { passive: true }); return () => { observer.disconnect(); stage.removeEventListener('scroll', scroll); cancelAnimationFrame(frame); }; }, [stage]);
    useEffect(() => { const key = (e: KeyboardEvent) => { if (settings || notesOpen || (e.target as HTMLElement).closest('input,textarea,select,button,[contenteditable=true]'))
        return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        go(pageRef.current + (e.key === 'ArrowLeft' ? -1 : 1));
    } if (keyboardShortcutsEnabled() && e.key === 'Escape') {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
    } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [go, settings, notesOpen]);
    useEffect(() => { let frame = 0; const capture = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) {
        setSelection(null);
        return;
    } const range = s.getRangeAt(0), start = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement) as Element | null, end = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement) as Element | null; const a = start?.closest<HTMLElement>('[data-page-number]'), b = end?.closest<HTMLElement>('[data-page-number]'); if (!a || !b || !stage?.contains(a) || !stage.contains(b))
        return; const text = s.toString().trim(); if (!text)
        return; const rect = range.getBoundingClientRect(); const segments = Array.from(stage.querySelectorAll<HTMLElement>('[data-page-number]')).filter(el => range.intersectsNode(el)).map(el => { const part = document.createRange(); part.selectNodeContents(el); if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0)
        part.setStart(range.startContainer, range.startOffset); if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0)
        part.setEnd(range.endContainer, range.endOffset); return { page: Number(el.dataset.pageNumber), text: part.toString().replace(/^\s*PAGE \d+\s*/, '').trim() }; }).filter(part => part.text); setSelection({ text, page: Number(a.dataset.pageNumber), toPage: Number(b.dataset.pageNumber), segments, x: rect.left + rect.width / 2, y: rect.top - 8 }); }); }; document.addEventListener('selectionchange', capture); stage?.addEventListener('mouseup', capture); stage?.addEventListener('touchend', capture); const outside = (e: PointerEvent) => { if (!(e.target as Element).closest('.reader-selection') && !stage?.contains(e.target as Node))
        setSelection(null); }; document.addEventListener('pointerdown', outside); return () => { cancelAnimationFrame(frame); document.removeEventListener('selectionchange', capture); stage?.removeEventListener('mouseup', capture); stage?.removeEventListener('touchend', capture); document.removeEventListener('pointerdown', outside); }; }, [stage]);
    useEffect(() => {
        if (!stage) return;
        const dock = shell.current?.querySelector<HTMLElement>('.reader-dock');
        let previous = stage.scrollTop, frame = 0, idle: ReturnType<typeof setTimeout>;
        const measure = () => shell.current?.style.setProperty('--dock-height', `${dock?.getBoundingClientRect().height || 60}px`);
        const observer = new ResizeObserver(measure);
        if (dock) observer.observe(dock);
        measure();
        const reveal = () => dock?.classList.remove('dock-hidden');
        const scroll = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const next = stage.scrollTop;
                if (next > previous + 2 && next > 40 && !dock?.contains(document.activeElement)) dock?.classList.add('dock-hidden');
                else if (next < previous - 2) reveal();
                previous = next;
                clearTimeout(idle); idle = setTimeout(reveal, 1400);
            });
        };
        stage.addEventListener('scroll', scroll, { passive: true });
        stage.addEventListener('click', reveal);
        dock?.addEventListener('focusin', reveal);
        return () => { observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(idle); stage.removeEventListener('scroll', scroll); stage.removeEventListener('click', reveal); dock?.removeEventListener('focusin', reveal); };
    }, [stage]);
    const clearSelection = () => { setSelection(null); window.getSelection()?.removeAllRanges(); };
    const saveNote = (text: string, page = currentPage, highlight = false) => { const note: ReaderNote = { id: `${highlight ? 'hl_' : ''}${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, bookId: book.id, page, text, createdAt: Date.now() }; const all = [...readNotes(), note]; writeNotes(all); setNotes(all); setAnnouncement(highlight ? 'Highlight saved' : 'Note saved'); clearSelection(); };
    const saveCard = () => { if (!selection)
        return; const card = { id: `hl_${Date.now()}`, bookId: book.id, bookTitle: book.title, front: `What does this mean? “${selection.text.slice(0, 80)}${selection.text.length > 80 ? '…' : ''}”`, back: selection.text, fromPage: selection.page, toPage: selection.toPage, difficulty: null, createdAt: Date.now(), nextReview: 0, interval: 1, reviewCount: 0 }; try {
        const cards = JSON.parse(localStorage.getItem('shh_flashcards') || '[]');
        localStorage.setItem('shh_flashcards', JSON.stringify([...cards, card]));
        setAnnouncement('Card saved');
        clearSelection();
    }
    catch {
        setAnnouncement('Card could not be saved. Try again.');
    } };
    const finish = () => { const range = bounds.current, covered: string[] = []; for (let p = range.min; p <= range.max; p++) {
        const data = textPages.current.get(p);
        if (data)
            covered.push(...data.blocks.filter(b => b.heading).map(b => b.text));
    } latest.current.onDone([...new Set(covered)]); };
    const changeMode = useCallback((next: 'ebook' | 'pdf') => { setMode(next); setSelection(null); window.getSelection()?.removeAllRanges(); requestAnimationFrame(() => scrollToPage(pageRef.current)); }, [scrollToPage]);
    const showPdf = useCallback(() => changeMode('pdf'), [changeMode]);
    const changePreferences = (next: ReaderPreferences) => { setPreferences(next); localStorage.setItem(settingsKey, JSON.stringify(next)); };
    const bookNotes = useMemo(() => notes.filter(n => n.bookId === book.id), [notes, book.id]);
    return createPortal(<div ref={shell} className={`reader-shell ${notesOpen ? 'notes-open' : ''} ${selection ? 'selection-active' : ''} ${preferences.columns === 2 ? 'reader-two' : ''} reader-${mode}`} data-tone={preferences.tone} style={{ '--reader-size': `${preferences.size}px`, '--reader-leading': preferences.spacing, '--reader-font': preferences.typeface === 'sans' ? "'Plus Jakarta Sans',sans-serif" : "Newsreader,Georgia,serif" } as CSSProperties}><ReaderTopBar title={book.title} page={currentPage} total={totalPages} progress={progress} mode={mode} onMode={changeMode} onBack={onClose} settingsOpen={settings} notesOpen={notesOpen} onSettings={() => { setSettings(v => !v); setNotesOpen(false); }} onNotes={() => { setNotesOpen(v => !v); setSettings(false); }} onDone={() => void finish()}/><div className="reader-stage" ref={setStage} role="region" aria-label="Book pages" tabIndex={0}><div className="reader-article">{Array.from({ length: totalPages }, (_, i) => <PageSlot key={i + 1} page={i + 1} root={stage} book={book} buffer={buffer} mode={mode} zoom={zoom} notes={bookNotes} loadDocument={loadDocument} loadText={loadText} onText={onText} onReady={onReady} onPdf={showPdf}/>)}</div></div><PageDock page={currentPage} total={totalPages} mode={mode} zoom={zoom} onPage={go} onZoom={setZoom}/>{settings && <ReaderSettings preferences={preferences} onChange={changePreferences} onClose={() => setSettings(false)}/>}{notesOpen && <NotesPanel notes={bookNotes} page={currentPage} onClose={() => { setNotesOpen(false); requestAnimationFrame(() => shell.current?.querySelector<HTMLElement>('.reader-notes-trigger')?.focus()); }} onSave={saveNote} onDelete={id => { const all = readNotes().filter(n => n.id !== id); writeNotes(all); setNotes(all); }}/>}{selection && !settings && !notesOpen && <SelectionToolbar selection={selection} onHighlight={() => { const segments = selection.segments?.length ? selection.segments : [{ page: selection.page, text: selection.text }]; const created = segments.map((segment, i) => ({ id: `hl_${Date.now()}_${i}`, bookId: book.id, page: segment.page, text: segment.text, createdAt: Date.now() })); const all = [...readNotes(), ...created]; writeNotes(all); setNotes(all); setAnnouncement('Highlight saved'); clearSelection(); }} onNote={() => { saveNote(selection.text, selection.page); setNotesOpen(true); }} onAsk={() => { latest.current.onAsk(selection.text, selection.page, selection.toPage); }} onCard={saveCard} onExam={tag => { addExamMark({ bookId: book.id, bookTitle: book.title, page: selection.page, text: selection.text, tag }); setAnnouncement('Exam mark saved'); clearSelection(); }}/>}<span className="reader-sr-only" role="status" aria-live="polite">{announcement}</span></div>, document.body);
}
