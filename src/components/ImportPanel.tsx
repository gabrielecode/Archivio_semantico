import {Archive, Rec} from '../types';
import {Button, Modal} from './ui';
import * as XLSX from 'xlsx';
import {useState} from 'react';
import {exportExcel, templateExcel} from '../utils/archive';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');

export function ImportPanel({archive, setArchive, setDirty, onClose, toast}: {
    archive: Archive, setArchive: (fn: (a: Archive) => Archive) => void, setDirty: (d: boolean) => void, onClose: () => void, toast: (msg: string, type: 'success' | 'error') => void
}) {
    const [preview, setPreview] = useState<{data: any[], unmatched: string[]} | null>(null);

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast('File troppo grande (>5MB)', 'error'); e.target.value = ''; return; }
        
        const reader = new FileReader();
        reader.onload = (progressEvent) => {
            try {
                const data = new Uint8Array(progressEvent.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, {defval: '', raw: false});
                if (json.length > 2000) { toast('Troppe righe (max 2000)', 'error'); return; }
                
                const headers = Object.keys(json[0] || {});
                const headerMap = new Map();
                const unmatched: string[] = [];
                
                headers.forEach(h => {
                    const n = norm(h);
                    if (n === 'titolo') headerMap.set(h, 'titolo');
                    else if (n === 'tipo') headerMap.set(h, 'tipo');
                    else if (n === 'contenuto') headerMap.set(h, 'contenuto');
                    else if (n === 'tags' || n === 'tag') headerMap.set(h, 'tags');
                    else if (n === 'fonte') headerMap.set(h, 'fonte');
                    else {
                        const campo = archive.schema.campi.find(c => norm(c.etichetta) === n || norm(c.chiave) === n);
                        if (campo) headerMap.set(h, campo.chiave);
                        else unmatched.push(h);
                    }
                });

                const records = json.map((r: any) => {
                    const rec: any = {campi: {}};
                    Object.entries(r).forEach(([k, v]) => {
                        const target = headerMap.get(k);
                        if (target === 'titolo') rec.titolo = String(v).trim();
                        else if (target === 'tipo') rec.tipo = String(v);
                        else if (target === 'contenuto') rec.contenuto = String(v);
                        else if (target === 'tags') rec.tags = String(v).split(',').map((t: string) => t.trim()).filter(Boolean);
                        else if (target === 'fonte') rec.fonte = String(v);
                        else if (target) rec.campi[target] = String(v);
                    });
                    if (!rec.titolo) return null;
                    return rec;
                }).filter(Boolean);

                setPreview({data: records.filter(r => r.titolo), unmatched});
            } catch (e) {
                toast('File non leggibile', 'error');
            }
            e.target.value = '';
        };
        reader.onerror = () => { toast('File non leggibile', 'error'); e.target.value = ''; };
        reader.readAsArrayBuffer(file);
    };

    const doImport = () => {
        if (!preview) return;
        const importedRecords: Rec[] = preview.data.map(r => ({
            id: crypto.randomUUID(),
            titolo: r.titolo,
            tipo: archive.schema.tipi.find(t => t.toLowerCase() === (r.tipo || '').toLowerCase()) || r.tipo || archive.schema.tipi[0],
            contenuto: r.contenuto || '',
            tags: r.tags || [],
            fonte: r.fonte || '',
            campi: r.campi || {},
            creato: new Date().toISOString(),
            modificato: new Date().toISOString(),
            embHash: '',
            chunks: []
        }));
        setArchive(a => ({...a, records: [...a.records, ...importedRecords]}));
        setDirty(true);
        toast(`Importate ${importedRecords.length} voci`, 'success');
        onClose();
    };

    return (
        <Modal title="Importa / Esporta" onClose={onClose}>
            <div className="space-y-4">
                <input type="file" onChange={handleFile} accept=".xlsx, .xls, .csv" />
                {preview && (
                    <div className="space-y-2">
                        <div>Anteprima: {preview.data.length} righe. {preview.unmatched.length > 0 && <span className="text-amber-600">Colonne ignorate: {preview.unmatched.join(', ')}</span>}</div>
                        <Button onClick={doImport}>Importa</Button>
                    </div>
                )}
                <div className="border-t pt-4 flex gap-2">
                    <Button onClick={() => exportExcel(archive)}>Esporta Excel</Button>
                    <Button onClick={() => templateExcel(archive)}>Scarica Template</Button>
                </div>
            </div>
        </Modal>
    );
}
