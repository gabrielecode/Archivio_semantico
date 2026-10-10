import {useState} from 'react';
import {Archive} from '../types';
import {Button, ConfirmDialog} from './ui';
import {Plus, Trash2, Edit2, Check} from 'lucide-react';
import {DEFAULT_CAMPI} from '../utils/archive';

export function StructureTab({archive, setArchive, setDirty}: {
    archive: Archive, setArchive: (a: Archive) => void, setDirty: (d: boolean) => void
}) {
    const [newTipo, setNewTipo] = useState('');
    const [newCampoEtichetta, setNewCampoEtichetta] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<any>(null);
    const [editingTipo, setEditingTipo] = useState<string | null>(null);
    const [editingCampo, setEditingCampo] = useState<string | null>(null);

    const slugify = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    const updateRecords = (updateFn: (r: any) => any) => {
        setArchive({...archive, records: archive.records.map(updateFn)});
        setDirty(true);
    };

    const addTipo = () => {
        const t = newTipo.trim();
        if (t && !archive.schema.tipi.includes(t)) {
            setArchive({...archive, schema: {...archive.schema, tipi: [...archive.schema.tipi, t]}});
            setDirty(true);
            setNewTipo('');
        }
    };

    const renameTipo = (oldT: string, newT: string) => {
        if (oldT === newT) return;
        setArchive({
            ...archive, 
            schema: {...archive.schema, tipi: archive.schema.tipi.map(t => t === oldT ? newT : t)}
        });
        updateRecords(r => r.tipo === oldT ? {...r, tipo: newT, embHash: ''} : r);
        setEditingTipo(null);
    };

    const deleteTipo = (tipo: string) => {
        const count = archive.records.filter(r => r.tipo === tipo).length;
        setConfirmDelete({
            title: 'Eliminare tipo',
            message: `Eliminare il tipo "${tipo}"? Verranno modificate ${count} voci.`,
            danger: true,
            onConfirm: () => {
                setArchive({
                    ...archive, 
                    schema: {...archive.schema, tipi: archive.schema.tipi.filter(t => t !== tipo)}
                });
                updateRecords(r => r.tipo === tipo ? {...r, tipo: archive.schema.tipi[0], embHash: ''} : r);
                setConfirmDelete(null);
            },
            onCancel: () => setConfirmDelete(null)
        });
    };

    const addCampo = () => {
        const etichetta = newCampoEtichetta.trim();
        if (!etichetta) return;
        let chiave = slugify(etichetta);
        let baseChiave = chiave;
        let counter = 2;
        while (archive.schema.campi.some(c => c.chiave === chiave)) {
            chiave = `${baseChiave}_${counter++}`;
        }
        setArchive({...archive, schema: {...archive.schema, campi: [...archive.schema.campi, {chiave, etichetta}]}});
        setDirty(true);
        setNewCampoEtichetta('');
    };

    const renameCampo = (chiave: string, etichetta: string) => {
        setArchive({
            ...archive,
            schema: {...archive.schema, campi: archive.schema.campi.map(c => c.chiave === chiave ? {...c, etichetta} : c)}
        });
        setDirty(true);
        setEditingCampo(null);
    };

    const deleteCampo = (chiave: string) => {
        setConfirmDelete({
            title: 'Eliminare campo',
            message: 'Rimuove il campo da tutte le voci.',
            danger: true,
            onConfirm: () => {
                setArchive({
                    ...archive,
                    schema: {...archive.schema, campi: archive.schema.campi.filter(c => c.chiave !== chiave)}
                });
                updateRecords(r => {
                    const newCampi = {...r.campi};
                    delete newCampi[chiave];
                    return {...r, campi: newCampi, embHash: ''};
                });
                setConfirmDelete(null);
            },
            onCancel: () => setConfirmDelete(null)
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-serif">Struttura Archivio</h2>
            <p className="text-sm text-stone-600">I campi sono metadati brevi (max ~300 caratteri totali nell'intestazione indicizzata); i testi lunghi vanno in Contenuto.</p>

            <div className="bg-white p-4 border rounded">
                <h3 className="font-semibold mb-2">Tipi</h3>
                <div className="space-y-2">
                    {archive.schema.tipi.map(t => (
                        <div key={t} className="flex items-center gap-2">
                            {editingTipo === t ? (
                                <input autoFocus defaultValue={t} onBlur={e => renameTipo(t, e.target.value)} onKeyDown={e => {if(e.key==='Enter') renameTipo(t, (e.target as HTMLInputElement).value)}} className="border rounded p-1 flex-1" />
                            ) : (
                                <span className="flex-1">{t}</span>
                            )}
                            <Button variant="ghost" onClick={() => setEditingTipo(t)}><Edit2 size={14} /></Button>
                            <Button variant="ghost" onClick={() => deleteTipo(t)}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <input value={newTipo} onChange={e => setNewTipo(e.target.value)} placeholder="Nuovo tipo..." className="border rounded p-2 flex-1" />
                        <Button onClick={addTipo}><Plus size={16} /></Button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 border rounded">
                <h3 className="font-semibold mb-2">Campi</h3>
                <div className="space-y-2">
                    {archive.schema.campi.map(c => (
                        <div key={c.chiave} className="flex items-center gap-2">
                            {editingCampo === c.chiave ? (
                                <input autoFocus defaultValue={c.etichetta} onBlur={e => renameCampo(c.chiave, e.target.value)} onKeyDown={e => {if(e.key==='Enter') renameCampo(c.chiave, (e.target as HTMLInputElement).value)}} className="border rounded p-1 flex-1" />
                            ) : (
                                <span className="flex-1">{c.etichetta} <small className="text-stone-400">({c.chiave})</small></span>
                            )}
                            <Button variant="ghost" onClick={() => setEditingCampo(c.chiave)}><Edit2 size={14} /></Button>
                            <Button variant="ghost" onClick={() => deleteCampo(c.chiave)}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                    <div className="flex gap-2">
                        <input value={newCampoEtichetta} onChange={e => setNewCampoEtichetta(e.target.value)} placeholder="Nuovo campo..." className="border rounded p-2 flex-1" />
                        <Button onClick={addCampo}><Plus size={16} /></Button>
                    </div>
                    <Button variant="secondary" onClick={() => {
                        const missing = DEFAULT_CAMPI.filter(dc => !archive.schema.campi.some(c => c.chiave === dc.chiave));
                        if (missing.length > 0) {
                            setArchive({...archive, schema: {...archive.schema, campi: [...archive.schema.campi, ...missing]}});
                            setDirty(true);
                        }
                    }}>Aggiungi campi predefiniti</Button>
                </div>
            </div>
            {confirmDelete && <ConfirmDialog {...confirmDelete} />}
        </div>
    );
}
