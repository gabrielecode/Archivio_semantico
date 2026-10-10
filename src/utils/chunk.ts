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

export function buildHeader(rec: Rec): string {
    const fieldsStr = Object.entries(rec.campi)
        .filter(([_, v]) => v !== '' && v !== null && v !== undefined)
        .map(([k, v]) => ` | ${k}: ${v}`)
        .join('');
    const tagsPart = rec.tags.length > 0 ? ` | tag: ${rec.tags.join(', ')}` : '';
    return `${rec.titolo} (${rec.tipo})${tagsPart}${fieldsStr}`.substring(0, 300);
}

export function splitChunks(rec: Rec): { testo: string; embedding: number[] }[] {
    const content = rec.contenuto.replace(/\r\n/g, '\n');
    const header = buildHeader(rec);

    const paragraphs = content.split('\n\n').map(p => p.trim()).filter(p => p !== '');
    const chunks: { testo: string; embedding: number[] }[] = [];
    
    if (paragraphs.length === 0) {
        chunks.push({ testo: header, embedding: [] });
        return chunks;
    }

    let currentText = '';
    const MAX_LEN = 1900 - header.length - 2; // header + ": " + text
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
