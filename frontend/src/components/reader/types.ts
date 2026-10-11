export interface ReaderBook {
    id: string;
    title: string;
    author: string;
    currentPage: number;
    totalPages: number;
}
export interface ReaderNote {
    id: string;
    bookId: string;
    page: number;
    text: string;
    createdAt: number;
}
export interface TextBlock {
    text: string;
    heading: boolean;
}
export interface PageText {
    blocks: TextBlock[];
    hasImages: boolean;
    totalPages: number;
}
export interface ReaderPreferences {
    size: number;
    typeface: 'serif' | 'sans';
    spacing: 1.55 | 1.8 | 2.1;
    columns: 1 | 2;
    tone: 'default' | 'paper' | 'sepia' | 'night';
}
export interface PdfViewport {
    width: number;
    height: number;
    scale: number;
    transform: number[];
}
export interface PdfTextContent {
    items: unknown[];
    styles: Record<string, unknown>;
}
export interface PdfTask {
    promise: Promise<void>;
    cancel: () => void;
}
export interface PdfSource {
    getViewport: (options: {
        scale: number;
    }) => PdfViewport;
    render: (options: {
        canvasContext: CanvasRenderingContext2D;
        viewport: PdfViewport;
        transform?: number[];
    }) => PdfTask;
    getTextContent: () => Promise<PdfTextContent>;
}
export interface DocumentBundle {
    doc: {
        numPages: number;
        getPage: (page: number) => Promise<PdfSource>;
    };
    lib: {
        renderTextLayer: (options: {
            textContentSource: PdfTextContent;
            container: HTMLElement;
            viewport: PdfViewport;
            textDivs: HTMLElement[];
        }) => PdfTask;
    };
}
export interface SelectionData {
    text: string;
    page: number;
    toPage: number;
    x: number;
    y: number;
    segments?: {
        page: number;
        text: string;
    }[];
}
export const DEFAULT_PREFERENCES: ReaderPreferences = { size: 19, typeface: 'serif', spacing: 1.8, columns: 1, tone: 'default' };
export function readNotes(): ReaderNote[] { try {
    const notes = JSON.parse(localStorage.getItem('shh_notes') || '[]');
    return Array.isArray(notes) ? notes : [];
}
catch {
    return [];
} }
export function writeNotes(notes: ReaderNote[]) { localStorage.setItem('shh_notes', JSON.stringify(notes)); }
export function readPreferences(key: string): ReaderPreferences { try {
    const p = JSON.parse(localStorage.getItem(key) || '{}');
    return { size: Math.min(26, Math.max(16, Number(p.size) || 19)), typeface: p.typeface === 'sans' ? 'sans' : 'serif', spacing: [1.55, 1.8, 2.1].includes(p.spacing) ? p.spacing : 1.8, columns: p.columns === 2 ? 2 : 1, tone: ['paper', 'sepia', 'night'].includes(p.tone) ? p.tone : 'default' };
}
catch {
    return DEFAULT_PREFERENCES;
} }
export function quoteRanges(text: string, quotes: string[]) {
    // DOM selections and PDF text layers disagree about whitespace at line/page breaks.
    // Match without whitespace, then map the match back to the original text offsets.
    const offsets: number[] = [];
    let compact = '';
    for (let i = 0; i < text.length; i++) {
        if (!/\s/.test(text[i])) { compact += text[i]; offsets.push(i); }
    }
    return quotes.flatMap(quote => {
        const target = quote.replace(/\s/g, '');
        const start = target ? compact.indexOf(target) : -1;
        return start < 0 ? [] : [{ start: offsets[start], end: offsets[start + target.length - 1] + 1 }];
    }).sort((a, b) => a.start - b.start);
}
