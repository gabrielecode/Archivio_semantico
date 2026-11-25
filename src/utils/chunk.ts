import {Rec, EMB_DIM} from '../types';

function djb2(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return (hash >>> 0).toString(16);
}

export function calculateEmbHash(rec: Rec): string {
    const fields = Object.entries(rec.campi).sort().map(([k, v]) => `${k}:${v}`).join('|');
    const source = `${rec.titolo}|${rec.tipo}|${[...rec.tags].sort().join(',')}|${fields}|${rec.contenuto}`;
    return djb2(source);
}

function isMediaOrLinkKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return (
        lowerKey.includes('immagine') ||
        lowerKey.includes('image') ||
        lowerKey.includes('video') ||
        lowerKey.includes('link')
    );
}

export function buildHeader(rec: Rec): string {
    const fieldsParts: string[] = [];
    
    for (const [key, value] of Object.entries(rec.campi || {})) {
        if (!value || isMediaOrLinkKey(key)) continue;
        
        const raw = Array.isArray(value)
            ? value.filter(v => !!v).join('; ')
            : String(value);
        const trimmed = raw.trim();
        if (!trimmed) continue;

        fieldsParts.push(`${key}: ${trimmed.substring(0, 300)}`);
    }

    const fieldsStr = fieldsParts.length > 0 ? ` | ${fieldsParts.join(' | ')}` : '';
    const tagsPart = (rec.tags || []).length > 0 ? ` | tag: ${rec.tags.join(', ')}` : '';
    const contentPart = rec.contenuto ? ` | contenuto: ${rec.contenuto.replace(/\n/g, ' ')}` : '';
    
    return `${rec.titolo} (${rec.tipo})${tagsPart}${fieldsStr}${contentPart}`.substring(0, 1200);
}

export function splitChunks(rec: Rec): { testo: string; embedding: number[] }[] {
    const content = (rec.contenuto || '').replace(/\r\n/g, '\n');
    const header = buildHeader(rec);

    const paragraphs = content.split('\n\n').map(p => p.trim()).filter(p => p !== '');
    const chunks: { testo: string; embedding: number[] }[] = [];
    
    if (paragraphs.length === 0) {
        const prefix = `${rec.titolo} (${rec.tipo})`;
        const entries: string[] = [];
        if ((rec.tags || []).length > 0) {
            entries.push(`tag: ${rec.tags.join(', ')}`);
        }
        for (const [key, value] of Object.entries(rec.campi || {})) {
            if (!value || isMediaOrLinkKey(key)) continue;
            const raw = Array.isArray(value)
                ? value.filter(v => !!v).join('; ')
                : String(value);
            const trimmed = raw.trim();
            if (trimmed) {
                entries.push(`${key}: ${trimmed}`);
            }
        }

        if (entries.length === 0) {
            chunks.push({ testo: prefix.substring(0, 1500), embedding: [] });
            return chunks;
        }

        const MAX_CHUNK_LEN = 1500;
        const maxBodyLen = Math.max(200, MAX_CHUNK_LEN - prefix.length - 3);
        let currentBody = '';

        const flushBody = () => {
            if (!currentBody) return;
            chunks.push({
                testo: `${prefix} | ${currentBody}`.substring(0, MAX_CHUNK_LEN),
                embedding: [],
            });
            currentBody = '';
        };

        for (const entry of entries) {
            if (entry.length > maxBodyLen) {
                flushBody();
                let remaining = entry;
                while (remaining.length > maxBodyLen) {
                    let cut = remaining.lastIndexOf(' ', maxBodyLen);
                    if (cut < Math.floor(maxBodyLen * 0.5)) cut = maxBodyLen;
                    chunks.push({
                        testo: `${prefix} | ${remaining.substring(0, cut).trimEnd()}`.substring(0, MAX_CHUNK_LEN),
                        embedding: [],
                    });
                    remaining = remaining.substring(cut).trimStart();
                }
                if (remaining) {
                    currentBody = remaining;
                }
            } else if (!currentBody) {
                currentBody = entry;
            } else if (currentBody.length + 3 + entry.length <= maxBodyLen) {
                currentBody += ` | ${entry}`;
            } else {
                flushBody();
                currentBody = entry;
            }
        }
        flushBody();
        return chunks;
    }

    let currentText = '';
    const MAX_LEN = Math.max(500, 1900 - header.length - 2); // header + ": " + text
    const OVERLAP = 150;

    function addChunk(text: string) {
        chunks.push({ testo: `${header}: ${text}`, embedding: [] });
    }

    for (const p of paragraphs) {
        let textToProcess = p;
        if (currentText.length + textToProcess.length + 2 <= MAX_LEN) {
            currentText += (currentText ? '\n\n' : '') + textToProcess;
        } else {
            if (currentText) addChunk(currentText);
            
            // Start new, include overlap
            const overlapText = currentText.substring(Math.max(0, currentText.length - OVERLAP));
            currentText = overlapText + (overlapText ? '\n\n' : '') + textToProcess;
            
            while (currentText.length > MAX_LEN) {
                addChunk(currentText.substring(0, MAX_LEN));
                currentText = currentText.substring(MAX_LEN - OVERLAP);
            }
        }
    }
    if (currentText) addChunk(currentText);

    return chunks;
}
