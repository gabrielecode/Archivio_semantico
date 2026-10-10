import {useState, useMemo, useEffect, useCallback} from 'react';
import {Archive, Rec} from '../types';
import {Button, Badge, Field, inputCls} from './ui';
import {Plus, ChevronLeft, Save, Trash2, Copy, Table as TableIcon, FileText, ChevronRight, SkipBack, SkipForward, ArrowLeft, ArrowRight, Search} from 'lucide-react';
import {needsEmbedding} from '../utils/embed';

export function DataTab({archive, setArchive, setDirty, onGoStructure, selectedId, setSelectedId, setConfirmDialog}: {
  archive: Archive, 
  setArchive: (a: Archive | ((a: Archive) => Archive)) => void, 
  setDirty: (d: boolean) => void, 
  onGoStructure: () => void,
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  setConfirmDialog: (dialog: any) => void
}) {
  const [view, setView] = useState<'Modulo' | 'Tabella'>('Modulo');
  const [searchTerm, setSearchTerm] = useState('');
  const [draft, setDraft] = useState<Rec | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sortField, setSortField] = useState<keyof Rec>('modificato');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filteredRecords = useMemo(() => {
    let recs = [...archive.records].filter(r => 
        r.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.contenuto.toLowerCase().includes(searchTerm.toLowerCase())
    );
    recs.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });
    return recs;
  }, [archive.records, searchTerm, sortField, sortDir]);

  const currentIndex = useMemo(() => filteredRecords.findIndex(r => r.id === selectedId), [filteredRecords, selectedId]);

  const isDirty = useMemo(() => {
      if (!draft || !selectedId) return false;
      const original = archive.records.find(r => r.id === selectedId);
      if (!original) return true;
      return JSON.stringify(original) !== JSON.stringify(draft);
  }, [draft, selectedId, archive.records]);

  useEffect(() => {
    if (!selectedId) {
        const newRec: Rec = {
            id: crypto.randomUUID(),
            titolo: '',
            tipo: archive.schema.tipi[0] || '',
            contenuto: '',
            tags: [],
            fonte: '',
            campi: {},
            creato: new Date().toISOString(),
            modificato: new Date().toISOString(),
            embHash: '',
            chunks: []
        };
        setDraft(newRec);
        setIsNew(true);
        setSelectedId(newRec.id);
    } else {
        const rec = archive.records.find(r => r.id === selectedId);
        if (rec) {
            setDraft({...rec});
            setIsNew(false);
        }
    }
  }, [selectedId, archive.records, archive.schema.tipi, setSelectedId]);

  const handleSave = () => {
    if (!draft) return;
    const now = new Date().toISOString();
    const updated = {...draft, modificato: now};
    if (isNew) {
        setArchive(a => ({...a, records: [...a.records, updated]}));
    } else {
        setArchive(a => ({...a, records: a.records.map(r => r.id === updated.id ? updated : r)}));
    }
    setDraft(updated);
    setIsNew(false);
    setDirty(true);
  };

  const handleNavigate = (direction: number) => {
    if (isDirty) {
        setConfirmDialog({
            title: 'Modifiche non salvate',
            message: 'Hai delle modifiche non salvate. Salvarle prima di navigare?',
            onConfirm: () => { handleSave(); setConfirmDialog(null); navigate(direction); },
            onCancel: () => { setConfirmDialog(null); navigate(direction); }
        });
    } else {
        navigate(direction);
    }
  };

  const navigate = (direction: number) => {
    const nextIndex = Math.max(0, Math.min(filteredRecords.length - 1, currentIndex + direction));
    setSelectedId(filteredRecords[nextIndex].id);
  };

  const handleNuovo = () => {
    if (isDirty) {
        setConfirmDialog({
            title: 'Modifiche non salvate',
            message: 'Hai delle modifiche non salvate. Vuoi scartarle e creare un nuovo record?',
            onConfirm: () => { setConfirmDialog(null); createNew(); },
            onCancel: () => setConfirmDialog(null)
        });
    } else {
        createNew();
    }
  };

  const handleViewChange = (newView: 'Modulo' | 'Tabella') => {
    if (isDirty) {
        setConfirmDialog({
            title: 'Modifiche non salvate',
            message: 'Hai delle modifiche non salvate. Salvarle prima di cambiare vista?',
            onConfirm: () => { handleSave(); setConfirmDialog(null); setView(newView); },
            onCancel: () => { setConfirmDialog(null); setView(newView); }
        });
    } else {
        setView(newView);
    }
  };

  const createNew = () => {
    setSelectedId(null);
  };

  const handleDuplicate = () => {
    if (!draft) return;
    const newRec: Rec = {...draft, id: crypto.randomUUID(), titolo: `${draft.titolo} (copia)`, creato: new Date().toISOString(), modificato: new Date().toISOString()};
    setArchive(a => ({...a, records: [...a.records, newRec]}));
    setSelectedId(newRec.id);
  };

  const handleDelete = () => {
    setConfirmDialog({
        title: 'Eliminare il record?',
        message: 'Sei sicuro di voler eliminare questo record? Non è possibile annullare.',
        onConfirm: () => { 
            setArchive(a => ({...a, records: a.records.filter(r => r.id !== selectedId)}));
            setConfirmDialog(null);
            createNew();
        },
        onCancel: () => setConfirmDialog(null)
    });
  };

  if (!draft) return null;

  return (
    <div className="space-y-4">
        {/* Toolbar & Filter Bar */}
        <div className="sticky top-[130px] bg-stone-50 z-10 py-2 space-y-2">
            <div className="flex items-center justify-between gap-4 bg-white p-2 border rounded-lg shadow-sm">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0}><SkipBack size={16}/></Button>
                    <Button variant="ghost" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0}><ChevronLeft size={16}/></Button>
                    <span className="text-sm font-medium px-2">{currentIndex + 1} / {filteredRecords.length}</span>
                    <Button variant="ghost" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1}><ChevronRight size={16}/></Button>
                    <Button variant="ghost" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1}><SkipForward size={16}/></Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleNuovo}><Plus size={16}/>Nuovo</Button>
                    <Button variant="ghost" onClick={handleDuplicate}><Copy size={16}/>Duplica</Button>
                    <Button variant="ghost" onClick={handleDelete} className="text-red-600"><Trash2 size={16}/>Elimina</Button>
                    <Button variant="primary" onClick={handleSave} disabled={!isDirty}><Save size={16}/>Salva</Button>
                </div>
                <div className="flex bg-stone-200 rounded-lg p-1">
                    <Button variant={view === 'Modulo' ? 'primary' : 'ghost'} onClick={() => handleViewChange('Modulo')}><FileText size={16}/></Button>
                    <Button variant={view === 'Tabella' ? 'primary' : 'ghost'} onClick={() => handleViewChange('Tabella')}><TableIcon size={16}/></Button>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
                <input placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputCls} />
                <Button variant="ghost" onClick={() => setSearchTerm('')}>Mostra tutti</Button>
                <span>{filteredRecords.length} di {archive.records.length} voci</span>
            </div>
        </div>

        {view === 'Modulo' ? (
            <div className="bg-white p-6 border rounded-lg shadow-sm space-y-4">
                {/* Form fields */}
                <Field label="Titolo*">
                    <input value={draft.titolo} onChange={e => setDraft({...draft, titolo: e.target.value})} className={inputCls} />
                </Field>
                <div className="grid md:grid-cols-2 gap-4">
                    <Field label="Tipo">
                        <select value={draft.tipo} onChange={e => setDraft({...draft, tipo: e.target.value})} className={inputCls}>
                            {archive.schema.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label="Fonte">
                        <input value={draft.fonte} onChange={e => setDraft({...draft, fonte: e.target.value})} className={inputCls} />
                    </Field>
                </div>
                <Field label="Tags">
                    {/* Simplified for now, just input */}
                    <input value={draft.tags.join(', ')} onChange={e => setDraft({...draft, tags: e.target.value.split(',').map(t => t.trim())})} className={inputCls} placeholder="tag1, tag2..." />
                </Field>
                {archive.schema.campi.map(campo => (
                    <Field key={campo.chiave} label={campo.etichetta}>
                        {campo.etichetta.toLowerCase().includes('indicazioni') || campo.etichetta.toLowerCase().includes('sinonimi') ? (
                            <textarea value={draft.campi[campo.chiave] || ''} onChange={e => setDraft({...draft, campi: {...draft.campi, [campo.chiave]: e.target.value}})} className={`${inputCls} min-h-[100px]`} />
                        ) : (
                            <input value={draft.campi[campo.chiave] || ''} onChange={e => setDraft({...draft, campi: {...draft.campi, [campo.chiave]: e.target.value}})} className={inputCls} />
                        )}
                    </Field>
                ))}
                <Field label="Contenuto">
                    <textarea value={draft.contenuto} onChange={e => setDraft({...draft, contenuto: e.target.value})} className={`${inputCls} min-h-[360px]`} />
                    <div className="text-xs text-stone-500 mt-1">
                        {draft.contenuto.length} caratteri - {Math.ceil(draft.contenuto.length / 1700)} blocchi stimati
                    </div>
                </Field>
            </div>
        ) : (
            <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-stone-100">
                        <tr>
                            <th className="p-2 cursor-pointer" onClick={() => {setSortField('titolo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>Titolo</th>
                            <th className="p-2 cursor-pointer" onClick={() => {setSortField('tipo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>Tipo</th>
                            <th className="p-2">Tags</th>
                            <th className="p-2 cursor-pointer" onClick={() => {setSortField('modificato'); setSortDir(sortDir==='asc'?'desc':'asc')}}>Modificato</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.slice(0, 50).map(r => (
                            <tr key={r.id} className="border-t hover:bg-stone-50 cursor-pointer" onClick={() => {setSelectedId(r.id); setView('Modulo');}}>
                                <td className="p-2 font-medium">{r.titolo}</td>
                                <td className="p-2"><Badge type={r.tipo} /></td>
                                <td className="p-2">{r.tags.join(', ')}</td>
                                <td className="p-2">{new Date(r.modificato).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
}
