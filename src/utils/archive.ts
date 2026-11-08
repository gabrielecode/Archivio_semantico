import {Archive, Rec, EMB_MODEL, EMB_DIM, ARCHIVE_VERSION} from '../types';
import * as XLSX from 'xlsx';
import templatesData from '../templates.json';

export const DEFAULT_CAMPI = [
  {chiave:'pinyin',etichetta:'Pinyin / Nome cinese'},
  {chiave:'sinonimi',etichetta:'Sinonimi'},
  {chiave:'natura',etichetta:'Natura / Categoria'},
  {chiave:'indicazioni',etichetta:'Indicazioni'},
  {chiave:'controindicazioni',etichetta:'Controindicazioni'}
];

export function newArchive(nome: string): Archive {
  return {
    version: ARCHIVE_VERSION,
    nome,
    creato: new Date().toISOString(),
    modificato: new Date().toISOString(),
    model: EMB_MODEL,
    dim: EMB_DIM,
    schema: {
        campi: DEFAULT_CAMPI,
        tipi: ['Sintomo', 'Punto di agopuntura', 'Meridiano', 'Erba/Formula', 'Sindrome', 'Teoria/Concetto', 'Documento', 'Nota'],
        templates: templatesData as any
    },
    records: []
  };
}

export function upgradeArchiveIfNeeded(archive: Archive): boolean {
    if (archive.model !== EMB_MODEL || archive.dim !== EMB_DIM) {
        archive.model = EMB_MODEL;
        archive.dim = EMB_DIM;
        archive.records.forEach(r => {
            r.chunks = [];
            r.embHash = '';
        });
        (archive as any).__upgraded = true;
        return true;
    }
    return false;
}

export function parseArchive(json: any): Archive {
    if (typeof json !== 'object' || json === null) throw new Error('File JSON non valido');
    
    const base = newArchive('Imported');
    const records = Array.isArray(json) ? json.map(r => normalizeRecord(r)) : (json.records || []).map((r: any) => normalizeRecord(r));

    const archive: Archive = {
        version: ARCHIVE_VERSION,
        nome: typeof json.nome === 'string' ? json.nome : 'Imported',
        creato: isValidISO(json.creato) ? json.creato : new Date().toISOString(),
        modificato: isValidISO(json.modificato) ? json.modificato : new Date().toISOString(),
        model: json.model || base.model,
        dim: typeof json.dim === 'number' ? json.dim : base.dim,
        schema: {
            campi: (json.schema?.campi || []).filter((c: any) => c.chiave && c.etichetta),
            tipi: Array.from(new Set([...base.schema.tipi, ...json.schema?.tipi || [], ...records.map((r: Rec) => r.tipo)]))
        },
        records: records.map((r: Rec) => {
            r.chunks = r.chunks.filter(c => typeof c.testo === 'string' && Array.isArray(c.embedding) && c.embedding.every(v => Number.isFinite(v)));
            if (r.chunks.length === 0) r.embHash = '';
            return r;
        })
    };

    upgradeArchiveIfNeeded(archive);
    return archive;
}

function isValidISO(date: any) {
    return typeof date === 'string' && !isNaN(Date.parse(date));
}

function normalizeRecord(r: any): Rec {
    const tipo = r.tipo || r.categoria || r.Tipo || 'Sintomo';
    const categoria = r.categoria || r.Categoria || tipo;
    const rawTags = Array.isArray(r.tags) ? r.tags : (typeof r.Tags === 'string' ? r.Tags.split(';') : (Array.isArray(r.tag) ? r.tag : []));
    const tags = rawTags.map((t: any) => String(t).trim()).filter((t: string) => t !== '');
    const outlinks = Array.isArray(r.outlinks) ? r.outlinks.map((o: any) => String(o).trim()).filter((o: string) => o !== '') : [];
    
    // Improved campi normalization for Excel/JSON imports
    const campi: Record<string, any> = {};
    const rawCampi = r.campi || {};
    
    // If coming from Excel, fields might be prefixed with "campo_" or named directly by label
    Object.entries(r).forEach(([key, value]) => {
        if (key.startsWith('campo_')) {
            const fieldId = key.replace('campo_', '');
            if (typeof value === 'string' && (fieldId.includes('immagine') || fieldId.includes('image') || fieldId.includes('video') || fieldId.includes('lista') || fieldId.includes('sintomi') || fieldId.includes('combinazioni'))) {
                const separator = fieldId.includes('immagine') || fieldId.includes('image') || fieldId.includes('video') ? '|' : ';';
                campi[fieldId] = value.split(separator).map(s => s.trim()).filter(Boolean);
            } else {
                campi[fieldId] = value;
            }
        }
    });

    // Merge with existing campi if any
    Object.entries(rawCampi).forEach(([k, v]) => {
        campi[k] = v;
    });

    return {
        id: r.id || r.ID || crypto.randomUUID(),
        titolo: r.titolo || r.Titolo || 'Senza titolo',
        tipo,
        categoria,
        contenuto: r.contenuto || r.Contenuto || '',
        tags,
        tag: tags,
        outlinks,
        fonte: r.fonte || r.Fonte || '',
        campi,
        creato: r.creato || r.Creato || new Date().toISOString(),
        modificato: r.modificato || r.Modificato || new Date().toISOString(),
        embHash: r.embHash || '',
        chunks: Array.isArray(r.chunks) ? r.chunks : []
    };
}

export function exportArchiveJson(archive: Archive) {
    const data = JSON.stringify(archive);
    const blob = new Blob([data], {type: 'application/json'});
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `${archive.nome.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile(): Promise<Archive | null> {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return resolve(null);
            try {
                resolve(parseArchive(JSON.parse(await file.text())));
            } catch (e) {
                reject(new Error('File JSON non valido'));
            }
        };
        input.click();
    });
}

export function exportExcel(archive: Archive) {
    const data = archive.records.map(r => {
        const row: any = {
            ID: r.id,
            Titolo: r.titolo,
            Tipo: r.tipo,
            Categoria: r.categoria,
            Contenuto: r.contenuto,
            Tags: r.tags.join('; '),
            Fonte: r.fonte,
            Creato: r.creato,
            Modificato: r.modificato
        };
        
        // Export dynamic fields
        Object.entries(r.campi).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                // Use | for images/videos and ; for lists
                const separator = key.includes('immagine') || key.includes('image') || key.includes('video') ? '|' : '; ';
                row[`campo_${key}`] = value.join(separator);
            } else {
                row[`campo_${key}`] = value;
            }
        });
        
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Archivio');
    XLSX.writeFile(wb, `${archive.nome}.xlsx`);
}

export function templateExcel(archive: Archive) {
    const data = [{ Titolo: 'Esempio', Tipo: archive.schema.tipi[0], Contenuto: '', Tags: '', Fonte: '', ...archive.schema.campi.reduce((acc, c) => ({...acc, [c.etichetta]: ''}), {}) }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `Template.xlsx`);
}
