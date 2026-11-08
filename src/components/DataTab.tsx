import {useState, useMemo, useEffect, useCallback} from 'react';
import {Archive, Rec} from '../types';
import {Button, Badge, Field, inputCls, EmptyState} from './ui';
import {Plus, ChevronLeft, Save, Trash2, Copy, Table as TableIcon, FileText, ChevronRight, Search} from 'lucide-react';
import {useTranslation} from '../utils/i18n';
import {updateRecordOutlinks} from '../utils/parser';
import {WikiContent} from './WikiContent';
import {LinkPanel} from './LinkPanel';
import {DynamicForm} from './DynamicForm';
import {CardPreview} from './CardPreview';
import {Template} from '../types';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

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
  const [editing, setEditing] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);

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
        const tipo = archive.schema.tipi[0] || '';
        const newRec: Rec = {
            id: crypto.randomUUID(),
            titolo: '',
            tipo,
            categoria: tipo,
            contenuto: '',
            tags: [],
            tag: [],
            outlinks: [],
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
    const withOutlinks = updateRecordOutlinks(draft);
    const updated = {...withOutlinks, modificato: now};
    if (isNew) {
        setArchive(a => ({...a, records: [...a.records, updated]}));
    } else {
        setArchive(a => ({...a, records: a.records.map(r => r.id === updated.id ? updated : r)}));
    }
    setDraft(updated);
    setIsNew(false);
    setEditing(false);
    setDirty(true);
  };

  const handleTemplateSave = (campi: any, template: Template) => {
    if (!draft) return;
    const now = new Date().toISOString();
    // Use the primary name field as the title if available
    const nameFieldId = template.fields.find(f => f.id.includes('nome') || f.id.includes('titolo'))?.id;
    const titolo = campi[nameFieldId || ''] || draft.titolo || template.name;
    
    const updated: Rec = {
      ...draft,
      titolo,
      tipo: template.id,
      categoria: template.name,
      campi,
      modificato: now
    };

    const withOutlinks = updateRecordOutlinks(updated);
    if (isNew) {
      setArchive(a => ({...a, records: [...a.records, withOutlinks]}));
    } else {
      setArchive(a => ({...a, records: a.records.map(r => r.id === updated.id ? withOutlinks : r)}));
    }
    
    setDraft(withOutlinks);
    setIsNew(false);
    setEditing(false);
    setDirty(true);
  };

  const handleCreateRecordFromWiki = (title: string) => {
    const newRec: Rec = {
        id: crypto.randomUUID(),
        titolo: title,
        tipo: archive.schema.tipi[0] || 'Sintomo',
        categoria: archive.schema.tipi[0] || 'Sintomo',
        contenuto: `Creato automaticamente tramite link da [[${draft?.titolo || ''}]].\n\n`,
        tags: [],
        tag: [],
        outlinks: [],
        fonte: '',
        campi: {},
        creato: new Date().toISOString(),
        modificato: new Date().toISOString(),
        embHash: '',
        chunks: []
    };
    setArchive(a => ({...a, records: [...a.records, newRec]}));
    setDirty(true);
    setSelectedId(newRec.id);
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
    setEditing(true);
    setTemplateId(null);
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
    <div className="space-y-8 text-text-primary text-base">
        <div className="sticky top-[110px] bg-bg-primary/80 backdrop-blur-sm z-10 py-4 -mx-6 px-6">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 bg-card-bg p-4 rounded-3xl border border-border-primary shadow-sm">
                    <div className="flex items-center gap-1 bg-bg-alt p-1 rounded-2xl border border-border-primary">
                        <Button variant="ghost" size="sm" onClick={() => handleNavigate(-1)} disabled={currentIndex <= 0} className="w-10 h-10 p-0 rounded-xl"><ChevronLeft size={20}/></Button>
                        <div className="px-4 text-xs font-bold text-text-muted tracking-tighter">
                            {currentIndex + 1} <span className="opacity-40">/</span> {filteredRecords.length}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleNavigate(1)} disabled={currentIndex >= filteredRecords.length - 1} className="w-10 h-10 p-0 rounded-xl"><ChevronRight size={20}/></Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex bg-bg-alt p-1 rounded-2xl border border-border-primary mr-2">
                            <button 
                                onClick={() => handleViewChange('Modulo')} 
                                className={`p-2 rounded-xl transition-all ${view === 'Modulo' ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                title={t('viewModule')}
                            >
                                <FileText size={20}/>
                            </button>
                            <button 
                                onClick={() => handleViewChange('Tabella')} 
                                className={`p-2 rounded-xl transition-all ${view === 'Tabella' ? 'bg-card-bg text-accent shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
                                title={t('viewTable')}
                            >
                                <TableIcon size={20}/>
                            </button>
                        </div>
                        
                        <Button variant="ghost" onClick={handleNuovo} icon={Plus} className="hidden sm:flex">Nuova</Button>
                        <Button variant="ghost" onClick={handleDelete} icon={Trash2} className="text-red-600 hover:bg-red-50 hover:text-red-700 p-2 rounded-xl" />
                        <Button variant="primary" onClick={handleSave} disabled={!isDirty} icon={Save} className="px-8 shadow-lg shadow-emerald-900/10">
                            {isDirty ? 'Salva Modifiche' : 'Salvato'}
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted/50" />
                        <input 
                            placeholder="Cerca tra le tue schede..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className={`${inputCls} pl-11 h-12 shadow-sm border-stone-200/60 focus:border-emerald-500`}
                        />
                    </div>
                    <Button variant="secondary" onClick={() => setSearchTerm('')} className="h-12 px-6">Tutte</Button>
                </div>
            </div>
        </div>

        {view === 'Modulo' ? (
            <div className={`${editing ? 'w-full' : 'grid lg:grid-cols-2 gap-12 items-start'} pt-4`}>
                <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                    {editing ? (
                      <DynamicForm 
                        initialValues={draft} 
                        templateId={templateId || undefined}
                        onSave={handleTemplateSave}
                        onCancel={() => {
                          setEditing(false);
                          if (isNew) setSelectedId(filteredRecords[0]?.id || null);
                        }}
                      />
                    ) : (
                      <div className="space-y-8">
                        <CardPreview record={draft} />
                        <div className="flex justify-center">
                          <Button variant="outline" size="lg" onClick={() => setEditing(true)} className="w-full sm:w-auto px-12 rounded-2xl">
                            Modifica Campi Scheda
                          </Button>
                        </div>
                      </div>
                    )}
                </div>

                {!editing && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="bg-card-bg rounded-[2.5rem] p-8 border border-border-primary shadow-sm space-y-6">
                            <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
                                <div className="w-8 h-8 bg-bg-alt rounded-lg flex items-center justify-center text-text-muted">
                                    <FileText size={18} />
                                </div>
                                <h3 className="font-bold text-text-primary tracking-tight">Contenuto Libero & Wiki</h3>
                            </div>
                            <WikiContent
                                content={draft.contenuto}
                                archive={archive}
                                onSelectRecord={id => setSelectedId(id)}
                                onCreateRecord={title => handleCreateRecordFromWiki(title)}
                                editable={true}
                                onChange={val => {
                                  const next = {...draft, contenuto: val};
                                  setDraft(next);
                                  setArchive(a => ({...a, records: a.records.map(r => r.id === draft.id ? next : r)}));
                                  setDirty(true);
                                }}
                            />
                        </div>
                        <LinkPanel
                            archive={archive}
                            currentRecord={draft}
                            onSelectRecord={id => setSelectedId(id)}
                            onCreateRecord={title => handleCreateRecordFromWiki(title)}
                        />
                    </div>
                )}
            </div>
        ) : (
            <div className="bg-card-bg border border-border-primary rounded-[2.5rem] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-bg-alt/80 text-text-muted text-[11px] font-bold uppercase tracking-widest border-b border-border-primary">
                            <th className="px-8 py-5 cursor-pointer hover:text-stone-900 transition-colors" onClick={() => {setSortField('titolo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{t('titleLabel').replace('*', '')}</th>
                            <th className="px-6 py-5 cursor-pointer hover:text-stone-900 transition-colors" onClick={() => {setSortField('tipo'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{t('typeLabel')}</th>
                            <th className="px-6 py-5">{t('tagsLabel')}</th>
                            <th className="px-8 py-5 cursor-pointer hover:text-stone-900 transition-colors text-right" onClick={() => {setSortField('modificato'); setSortDir(sortDir==='asc'?'desc':'asc')}}>{lang === 'de' ? 'Geändert' : 'Modificato'}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bg-alt/50">
                        {filteredRecords.slice(0, 50).map(r => (
                            <tr key={r.id} className="group hover:bg-stone-50/50 cursor-pointer transition-colors" onClick={() => {setSelectedId(r.id); setView('Modulo');}}>
                                <td className="px-8 py-4">
                                    <div className="font-bold text-text-primary group-hover:text-accent transition-colors">{r.titolo}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-3 py-1 bg-bg-alt text-text-muted rounded-full text-[10px] font-bold uppercase tracking-wider group-hover:bg-accent/10 group-hover:text-accent transition-colors">{r.tipo}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {r.tags.slice(0, 3).map(tag => (
                                            <span key={tag} className="text-xs text-stone-400 font-medium">#{tag}</span>
                                        ))}
                                        {r.tags.length > 3 && <span className="text-xs text-stone-300">+{r.tags.length - 3}</span>}
                                    </div>
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <span className="text-stone-400 font-mono text-xs">{new Date(r.modificato).toLocaleDateString(lang === 'de' ? 'de-DE' : 'it-IT')}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredRecords.length === 0 && (
                    <div className="p-20 text-center text-stone-400 font-medium italic">
                        Nessun risultato trovato per "{searchTerm}"
                    </div>
                )}
            </div>
        )}
    </div>
  );
}


