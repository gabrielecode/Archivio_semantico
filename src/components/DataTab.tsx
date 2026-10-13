import {useState, useMemo, useEffect, useCallback} from 'react';
import {Archive, Rec} from '../types';
import {Button, Badge, Field, inputCls, EmptyState} from './ui';
import {Plus, ChevronLeft, Save, Trash2, Copy, Table as TableIcon, FileText, ChevronRight, SkipBack, SkipForward} from 'lucide-react';
import {useTranslation} from '../utils/i18n';

export function DataTab({archive, setArchive, setDirty, onGoStructure, selectedId, setSelectedId, setConfirmDialog}: {
  archive: Archive, 
  setArchive: (a: Archive | ((a: Archive) => Archive)) => void, 
  setDirty: (d: boolean) => void, 
  onGoStructure: () => void,
  selectedId: string | null,
  setSelectedId: (id: string | null) => void,
  setConfirmDialog: (dialog: any) => void
}) {
  const {t, lang} = useTranslation();
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
        if (archive.records.length > 0 && !draft) {
            setSelectedId(archive.records[0].id);
            return;
        }
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
            title: t('unsavedChanges'),
            message: t('unsavedChangesMsg'),
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
            title: t('unsavedChanges'),
            message: t('discardAndNewMsg'),
            onConfirm: () => { setConfirmDialog(null); createNew(); },
            onCancel: () => setConfirmDialog(null)
        });
    } else {
        createNew();
    }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault();
              handleSave();
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
              e.preventDefault();
              handleNuovo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draft, isDirty]);

  const handleViewChange = (newView: 'Modulo' | 'Tabella') => {
    if (isDirty) {
        setConfirmDialog({
            title: t('unsavedChanges'),
            message: t('unsavedChangesMsg'),
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
    const newRec: Rec = {...draft, id: crypto.randomUUID(), titolo: `${draft.titolo} (${lang === 'de' ? 'Kopie' : 'copia'})`, creato: new Date().toISOString(), modificato: new Date().toISOString()};
    setArchive(a => ({...a, records: [...a.records, newRec]}));
    setSelectedId(newRec.id);
  };

  const handleDelete = () => {
    setConfirmDialog({
        title: t('deleteRecordTitle'),
        message: t('deleteRecordMsg'),
        onConfirm: () => { 
            setArchive(a => ({...a, records: a.records.filter(r => r.id !== selectedId)}));
            setConfirmDialog(null);
            createNew();
        },
        onCancel: () => setConfirmDialog(null)
    });
  };

  if (archive.records.length === 0 && !draft) {
      return (
          <EmptyState 
              icon={FileText} 
              title="Nessuna scheda presente" 
              text="Inizia aggiungendo la tua prima scheda nello schedario." 
              action={{label: "Aggiungi la prima scheda", onClick: () => createNew()}} 
          />
      );
  }

  if (!draft) return null;

  return (
    <div className="space-y-4 text-stone-900 text-base">
        <div className="sticky top-[130px] bg-stone-50 z-10 py-2 space-y-2">
            <div className="flex items-center justify-between gap-4 bg-white p-3 border border-stone-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0} className="min-h-[40px]"><SkipBack size={16}/></Button>
                    <Button variant="ghost" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0} className="min-h-[40px]"><ChevronLeft size={16}/></Button>
                    <span className="text-sm font-semibold px-2">{currentIndex + 1} / {filteredRecords.length}</span>
                    <Button variant="ghost" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1} className="min-h-[40px]"><ChevronRight size={16}/></Button>
                    <Button variant="ghost" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1} className="min-h-[40px]"><SkipForward size={16}/></Button>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={handleNuovo} className="min-h-[40px]"><Plus size={16}/>{t('newBtn')}</Button>
                    <Button variant="ghost" onClick={handleDuplicate} className="min-h-[40px] hidden sm:flex"><Copy size={16}/>{t('duplicateBtn')}</Button>
                    <Button variant="ghost" onClick={handleDelete} className="min-h-[40px] text-red-600"><Trash2 size={16}/>{t('deleteBtn')}</Button>
                    <Button variant="primary" onClick={handleSave} disabled={!isDirty} className="min-h-[40px] px-6 font-semibold"><Save size={16}/>{t('saveBtn')}</Button>
                </div>
                <div className="flex bg-stone-100 rounded-xl p-1">
                    <Button variant={view === 'Modulo' ? 'primary' : 'ghost'} onClick={() => handleViewChange('Modulo')} title={t('viewModule')} className="min-h-[38px]"><FileText size={16}/></Button>
                    <Button variant={view === 'Tabella' ? 'primary' : 'ghost'} onClick={() => handleViewChange('Tabella')} title={t('viewTable')} className="min-h-[38px]"><TableIcon size={16}/></Button>
                </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
                <input placeholder={t('searchFilter')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`${inputCls} min-h-[44px] text-base`} />
                <Button variant="secondary" onClick={() => setSearchTerm('')} className="min-h-[44px]">{t('showAll')}</Button>
                <span className="text-stone-600 font-medium">{filteredRecords.length} {t('recordsOf')} {archive.records.length}</span>
            </div>
        </div>

        {view === 'Modulo' ? (
            <div className="bg-white p-6 sm:p-8 border border-stone-200 rounded-3xl shadow-sm space-y-6">
                <Field label={t('titleLabel')}>
                    <input value={draft.titolo} onChange={e => setDraft({...draft, titolo: e.target.value})} className={`${inputCls} min-h-[44px] text-base`} />
                </Field>
                <div className="grid md:grid-cols-2 gap-4">
                    <Field label={t('typeLabel')}>
                        <select value={draft.tipo} onChange={e => setDraft({...draft, tipo: e.target.value})} className={`${inputCls} min-h-[44px] text-base bg-white`}>
                            {archive.schema.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </Field>
                    <Field label={t('sourceLabel')}>
                        <input value={draft.fonte} onChange={e => setDraft({...draft, fonte: e.target.value})} className={`${inputCls} min-h-[44px] text-base`} />
                    </Field>
                </div>
                <Field label={t('tagsLabel')}>
                    <input value={draft.tags.join(', ')} onChange={e => setDraft({...draft, tags: e.target.value.split(',').map(t => t.trim())})} className={`${inputCls} min-h-[44px] text-base`} placeholder={t('tagsPlaceholder')} />
                </Field>
                {archive.schema.campi.map(campo => (
                    <Field key={campo.chiave} label={campo.etichetta}>
                        {campo.etichetta.toLowerCase().includes('indicazioni') || campo.etichetta.toLowerCase().includes('sinonimi') ? (
                            <textarea value={draft.campi[campo.chiave] || ''} onChange={e => setDraft({...draft, campi: {...draft.campi, [campo.chiave]: e.target.value}})} className={`${inputCls} min-h-[100px] text-base`} />
                        ) : (
                            <input value={draft.campi[campo.chiave] || ''} onChange={e => setDraft({...draft, campi: {...draft.campi, [campo.chiave]: e.target.value}})} className={`${inputCls} min-h-[44px] text-base`} />
                        )}
                    </Field>
                ))}
                <Field label={t('contentLabel')}>
                    <textarea value={draft.contenuto} onChange={e => setDraft({...draft, contenuto: e.target.value})} className={`${inputCls} min-h-[360px] text-base leading-relaxed`} />
                    <div className="text-xs text-stone-500 mt-1">
                        {draft.contenuto.length} {t('chars')} - {Math.ceil(draft.contenuto.length / 1700)} {t('estimatedBlocks')}
                    </div>
                </Field>
            </div>
        ) : (
            <div className="bg-white border border-stone-200 rounded-3xl shadow-sm overflow-x-auto">
                <table className="w-full text-base text-left">
                    <thead className="bg-stone-100 text-stone-700 font-semibold">
                        <tr>
                            <th className="p-3 cursor-pointer" onClick={() => {setSortField('titolo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{t('titleLabel').replace('*', '')}</th>
                            <th className="p-3 cursor-pointer" onClick={() => {setSortField('tipo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{t('typeLabel')}</th>
                            <th className="p-3">{t('tagsLabel')}</th>
                            <th className="p-3 cursor-pointer" onClick={() => {setSortField('modificato'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{lang === 'de' ? 'Geändert' : 'Modificato'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.slice(0, 50).map(r => (
                            <tr key={r.id} className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer" onClick={() => {setSelectedId(r.id); setView('Modulo');}}>
                                <td className="p-3 font-semibold text-stone-900">{r.titolo}</td>
                                <td className="p-3"><span className="px-2.5 py-1 bg-stone-100 rounded-lg text-xs font-medium">{r.tipo}</span></td>
                                <td className="p-3 text-stone-600">{r.tags.join(', ')}</td>
                                <td className="p-3 text-stone-500 text-sm">{new Date(r.modificato).toLocaleDateString(lang === 'de' ? 'de-DE' : 'it-IT')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
}

