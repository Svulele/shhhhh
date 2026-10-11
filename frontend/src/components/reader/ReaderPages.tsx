import { useEffect, useRef, useState } from 'react';
import { quoteRanges } from './types';
import type { DocumentBundle, PageText, PdfTask, ReaderNote } from './types';
export function ReaderPage({ page, data, loading, error, notes, onPdf }: {
    page: number;
    data?: PageText;
    loading: boolean;
    error?: string;
    notes: ReaderNote[];
    onPdf: () => void;
}) { const blocks = data?.blocks || [], full = blocks.map(b => b.text).join('\n\n'), ranges = quoteRanges(full, notes.filter(n => n.page === page && n.id.startsWith('hl_')).map(n => n.text)); const text = (value: string, index: number) => { const offset = blocks.slice(0, index).reduce((sum, b) => sum + b.text.length + 2, 0), parts: (string | React.ReactNode)[] = []; let cursor = 0; for (const range of ranges) {
    const start = Math.max(0, range.start - offset), end = Math.min(value.length, range.end - offset);
    if (end <= start || start < cursor)
        continue;
    parts.push(value.slice(cursor, start), <mark key={start}>{value.slice(start, end)}</mark>);
    cursor = end;
} parts.push(value.slice(cursor)); return parts; }; return <article className="reader-text-page"><span className="reader-page-eyebrow">PAGE {page}</span>{loading ? <p className="reader-page-status" role="status">Preparing this page…</p> : error ? <p className="reader-page-status" role="status">{error} <button className="reader-button" onClick={onPdf}>Open PDF view</button></p> : !blocks.length ? <p className="reader-page-status">{data?.hasImages ? 'This page contains images.' : 'No readable text on this page.'} <button className="reader-button" onClick={onPdf}>Open PDF view</button></p> : <>{data?.hasImages && <p className="reader-page-status">This page includes figures. <button className="reader-button" onClick={onPdf}>See PDF</button></p>}{blocks.map((block, i) => block.heading ? <h2 key={i}>{text(block.text, i)}</h2> : /^[•▪◦]|^[-–]\s/.test(block.text) ? <ul key={i}><li>{text(block.text, i)}</li></ul> : <p key={i}>{text(block.text, i)}</p>)}</>}</article>; }
function paintHighlights(container: HTMLElement, notes: ReaderNote[]) { container.querySelectorAll('mark').forEach(mark => mark.replaceWith(...Array.from(mark.childNodes))); container.normalize(); const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT), nodes: Text[] = []; let node; while ((node = walker.nextNode()))
    nodes.push(node as Text); const full = nodes.map(n => n.textContent || '').join(''); const ranges = quoteRanges(full, notes.map(n => n.text)); let offset = 0; for (const n of nodes) {
    const length = n.length;
    const slices = ranges.map(r => ({ start: Math.max(0, r.start - offset), end: Math.min(length, r.end - offset) })).filter(r => r.end > r.start).sort((a, b) => a.start - b.start);
    if (slices.length) {
        const frag = document.createDocumentFragment();
        let cursor = 0;
        for (const r of slices) {
            if (r.start < cursor)
                continue;
            frag.append(n.data.slice(cursor, r.start));
            const mark = document.createElement('mark');
            mark.textContent = n.data.slice(r.start, r.end);
            frag.append(mark);
            cursor = r.end;
        }
        frag.append(n.data.slice(cursor));
        n.replaceWith(frag);
    }
    offset += length;
} }
export function PdfPage({ page, bookId, buffer, zoom, active, notes, loadDocument }: {
    page: number;
    bookId: string;
    buffer: ArrayBuffer;
    zoom: number;
    active: boolean;
    notes: ReaderNote[];
    loadDocument: (id: string, buf: ArrayBuffer) => Promise<DocumentBundle>;
}) {
    const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), layer = useRef<HTMLDivElement>(null), [width, setWidth] = useState(680), [ratio, setRatio] = useState(1.414), [error, setError] = useState(''), [rendered, setRendered] = useState(0);
    const latestNotes = useRef(notes);
    useEffect(() => { latestNotes.current = notes; }, [notes]);
    useEffect(() => { const parent = root.current?.parentElement; if (!parent)
        return; const resize = () => setWidth(Math.min(720, Math.max(1, parent.clientWidth))); const frame = requestAnimationFrame(resize); const observer = new ResizeObserver(resize); observer.observe(parent); return () => { cancelAnimationFrame(frame); observer.disconnect(); }; }, []);
    useEffect(() => { if (!active)
        return; const bitmap = canvas.current; let cancelled = false, task: PdfTask | undefined, textTask: PdfTask | undefined, pageProxy: import('./types').PdfSource | undefined; void (async () => { try {
        const { doc, lib } = await loadDocument(bookId, buffer);
        if (cancelled)
            return;
        setError('');
        const pg = await doc.getPage(page); pageProxy = pg;
        if (cancelled)
            return;
        const base = pg.getViewport({ scale: 1 }), viewport = pg.getViewport({ scale: width * zoom / base.width });
        setRatio(base.height / base.width);
        const cv = canvas.current, container = layer.current;
        if (!cv || !container)
            return;
        const dpr = Math.min(devicePixelRatio || 1, document.documentElement.classList.contains('lite') ? 1 : 1.5);
        cv.width = Math.floor(viewport.width * dpr);
        cv.height = Math.floor(viewport.height * dpr);
        cv.style.width = `${viewport.width}px`;
        cv.style.height = `${viewport.height}px`;
        task = pg.render({ canvasContext: cv.getContext('2d')!, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
        await task.promise;
        if (cancelled)
            return;
        const content = await pg.getTextContent();
        if (cancelled)
            return;
        container.replaceChildren();
        container.style.setProperty('--scale-factor', String(viewport.scale));
        textTask = lib.renderTextLayer({ textContentSource: content, container, viewport, textDivs: [] });
        await textTask.promise;
        if (cancelled)
            return;
        paintHighlights(container, latestNotes.current.filter(n => n.page === page && n.id.startsWith('hl_')));
        setRendered(v => v + 1);
    }
    catch (e) {
        if (!cancelled && !(e instanceof Error && e.name === 'RenderingCancelledException'))
            setError('This PDF page could not load. Try switching views or reopening the book.');
    } })(); return () => { cancelled = true; task?.cancel(); textTask?.cancel(); void task?.promise.catch(() => {}).finally(() => pageProxy?.cleanup?.()); if (bitmap) { bitmap.width = 0; bitmap.height = 0; } }; }, [active, page, bookId, buffer, zoom, width, loadDocument]);
    useEffect(() => { if (layer.current)
        paintHighlights(layer.current, notes.filter(n => n.page === page && n.id.startsWith('hl_'))); }, [notes, page, rendered]);
    return <div className="reader-pdf-sheet" ref={root} style={{ width: Math.min(width * zoom, width), minHeight: width * zoom * ratio }}>{error ? <p className="reader-page-status" role="status">{error}</p> : active ? <div style={{ position: 'relative', width: width * zoom, minHeight: width * zoom * ratio }}><canvas ref={canvas} aria-label={`PDF page ${page}`} role="img"/><div className="pdf-text-layer textLayer" ref={layer} aria-label={`Selectable text for PDF page ${page}`}/></div> : <span className="reader-page-status">PDF page {page}</span>}</div>;
}
