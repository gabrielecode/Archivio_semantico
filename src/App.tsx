import {useState, useRef, useEffect, useCallback} from 'react';
import {Archive} from './types';
import {newArchive, openArchive, saveArchive} from './utils/archive';
import {Button, Toast, ConfirmDialog, Modal} from './components/ui';
import {Leaf, Search, Database, Settings2, Key, Save, FolderOpen, FilePlus, Menu} from 'lucide-react';
import {DataTab} from './components/DataTab';
import {StructureTab} from './components/StructureTab';
import {SearchTab} from './components/SearchTab';
import {EmbedBar} from './components/EmbedBar';
import {ImportPanel} from './components/ImportPanel';
import {calculateEmbHash} from './utils/chunk';

export default function App() {
    const [tab, setTab] = useState<'ricerca' | 'dati' | 'struttura'>('ricerca');
    const [archive, setArchive] = useState<Archive>(newArchive('Nuovo Archivio'));
    const [dirty, setDirty] = useState(false);
    const [adminToken, setAdminToken] = useState('');
    const [showAdminModal, setShowAdminModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => { document.title = `${dirty?'* ':''}${archive.nome} - Ricerca semantica MTC`; }, [archive.nome, dirty]);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false); };
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMenu(false); };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);
        return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('keydown', handleEsc); };
    }, []);

    const [newArchiveModal, setNewArchiveModal] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<any>(null);
    const [newArchiveName, setNewArchiveName] = useState('Nuovo archivio');
    const fileHandle = useRef<any>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const saveHandlers = useRef({ handleSave: (saveAs: boolean) => {} });
    saveHandlers.current.handleSave = async (saveAs: boolean) => {
        try {
            const {handle, success, errore} = await saveArchive(archive, fileHandle, saveAs);
            if (success) {
                fileHandle.current = handle;
                setDirty(false);
                setToast({message: handle === null ? 'File scaricato nella cartella Download' : 'Archivio salvato', type: 'success'});
            } else if (errore && errore !== 'Annullato') {
                setToast({message: errore, type: 'error'});
            }
        } catch (e: any) {
            setToast({message: e.message || 'Errore salvataggio', type: 'error'});
        }
    };

    const updateArchive = useCallback((fn: (a: Archive) => Archive) => {
        setArchive(prev => {
            const next = fn(prev);
            return {...next, modificato: new Date().toISOString()};
        });
        setDirty(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveHandlers.current.handleSave(e.shiftKey);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [dirty]);

    const handleNuovo = () => {
        if (dirty) {
            setConfirmDialog({
                title: 'Scartare le modifiche?',
                message: 'Hai delle modifiche non salvate. Vuoi proseguire?',
                onConfirm: () => { setConfirmDialog(null); setNewArchiveModal(true); },
                onCancel: () => setConfirmDialog(null)
            });
        } else {
            setNewArchiveModal(true);
        }
    };

    const handleApri = async () => {
        const proceed = async () => {
            try {
                const result = await openArchive();
                if (result) {
                    setArchive(result.archive);
                    fileHandle.current = result.handle;
                    setDirty(false);
                    setToast({message: 'Archivio aperto', type: 'success'});
                }
            } catch (e: any) {
                setToast({message: e.message || 'Errore apertura', type: 'error'});
            }
        };
        if (dirty) {
            setConfirmDialog({
                title: 'Scartare le modifiche?',
                message: 'Hai delle modifiche non salvate. Vuoi proseguire?',
                onConfirm: () => { setConfirmDialog(null); proceed(); },
                onCancel: () => setConfirmDialog(null)
            });
        } else {
            await proceed();
        }
    };

    const navItems = [ {id: 'ricerca', icon: Search, label: 'Ricerca'}, {id: 'dati', icon: Database, label: 'Dati'}, {id: 'struttura', icon: Settings2, label: 'Struttura'}];
    const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowRight') setTab(navItems[(index + 1) % navItems.length].id as any);
        else if (e.key === 'ArrowLeft') setTab(navItems[(index - 1 + navItems.length) % navItems.length].id as any);
    };

    return (
        <div className="min-h-screen bg-stone-50">
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-emerald-700 focus:text-white">Vai al contenuto</a>
            <header className="sticky top-0 bg-white border-b z-10">
                <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Leaf className="text-emerald-700 shrink-0" />
                        <input aria-label="Nome archivio" value={archive.nome} onChange={e => updateArchive(a => ({...a, nome: e.target.value}))} className="text-xl font-serif font-semibold border-none bg-transparent truncate max-w-[50vw]" />
                    </div>
                    <div className="flex items-center gap-2 sm:hidden relative" ref={menuRef}>
                        <Button variant="ghost" onClick={() => setShowMenu(!showMenu)}><Menu size={16} /></Button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg py-2 min-w-[200px]">
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {handleNuovo(); setShowMenu(false);}}><FilePlus size={16} />Nuovo</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {handleApri(); setShowMenu(false);}}><FolderOpen size={16} />Apri</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {saveHandlers.current.handleSave(false); setShowMenu(false);}}><Save size={16} />Salva</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {saveHandlers.current.handleSave(true); setShowMenu(false);}}>Salva con nome</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowImportModal(true); setShowMenu(false);}}>Importa/Esporta</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowAdminModal(true); setShowMenu(false);}}><Key size={16} /></Button>
                            </div>
                        )}
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Button variant="ghost" aria-label="Nuovo archivio" onClick={handleNuovo}><FilePlus size={16} />Nuovo</Button>
                        <Button variant="ghost" aria-label="Apri archivio" onClick={handleApri}><FolderOpen size={16} />Apri</Button>
                        <Button variant="secondary" onClick={() => saveHandlers.current.handleSave(false)}><Save size={16} />Salva</Button>
                        <Button variant="primary" onClick={() => saveHandlers.current.handleSave(true)}>Salva con nome</Button>
                        <Button variant="ghost" onClick={() => setShowImportModal(true)}>Importa/Esporta</Button>
                        <Button variant="ghost" onClick={() => setShowAdminModal(true)}><Key size={16} className={adminToken ? 'text-emerald-600' : ''} /></Button>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center text-sm text-stone-500 py-1">
                    <div>{new Intl.NumberFormat('it-IT').format(archive.records.length)} voci | {dirty ? <span className="text-amber-600">Modifiche non salvate</span> : <span className="text-emerald-700">Salvato</span>}</div>
                    <div>Ultima modifica: {new Date(archive.modificato).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'})}</div>
                </div>
                <nav className="max-w-6xl mx-auto px-4 flex gap-6" role="tablist">
                    {navItems.map((t, i) => (
                        <button key={t.id} role="tab" aria-selected={tab === t.id} aria-controls={`${t.id}-panel`} onKeyDown={(e) => handleTabKeyDown(e, i)} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 py-3 border-b-2 ${tab === t.id ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-stone-600'}`}>
                            <t.icon size={18} />{t.label}
                        </button>
                    ))}
                </nav>
                <EmbedBar archive={archive} adminToken={adminToken} onNeedToken={() => setShowAdminModal(true)} onApply={results => {
                    if (results.length === 0) return;
                    updateArchive(a => ({...a, records: a.records.map(r => {
                        const x = results.find((z: any) => z.id === r.id);
                        return x && calculateEmbHash(r) === x.hash ? {...r, chunks: x.chunks, embHash: x.hash} : r;
                    })}));
                }} toast={(msg, type) => setToast({message: msg, type})} />
            </header>
            
            <main id="main" className="max-w-6xl mx-auto p-4">
                <div id="ricerca-panel" role="tabpanel" className={tab === 'ricerca' ? '' : 'hidden'}>
                    <SearchTab archive={archive} onOpenRec={id=>{setSelectedId(id); setTab('dati');}} onGoData={()=>setTab('dati')} />
                </div>
                <div id="dati-panel" role="tabpanel" className={tab === 'dati' ? '' : 'hidden'}>
                    <DataTab 
                        archive={archive} 
                        setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} 
                        setDirty={setDirty} 
                        onGoStructure={() => setTab('struttura')}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        setConfirmDialog={setConfirmDialog}
                    />
                </div>
                <div id="struttura-panel" role="tabpanel" className={tab === 'struttura' ? '' : 'hidden'}>
                    <StructureTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} />
                </div>
            </main>

            <footer className="text-center p-8 text-sm text-stone-500">
                <p>Strumento di consultazione, non sostituisce un parere medico</p>
                <p className="text-xs">I risultati sono similarità semantica, non diagnosi</p>
            </footer>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
            {showAdminModal && (
                <Modal title="Token Admin" onClose={() => setShowAdminModal(false)}>
                    <input type="password" autoComplete="off" value={adminToken} onChange={e => setAdminToken(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg bg-white focus:border-emerald-700 focus:ring-1 ring-emerald-700" />
                </Modal>
            )}
            {showImportModal && <ImportPanel archive={archive} setArchive={a => updateArchive(a)} setDirty={setDirty} onClose={() => setShowImportModal(false)} toast={(msg, type) => setToast({message: msg, type})} />}
            {newArchiveModal && (
                <Modal title="Nuovo archivio" onClose={() => setNewArchiveModal(false)} footer={
                    <Button onClick={() => { if(newArchiveName) { setArchive(newArchive(newArchiveName)); fileHandle.current=null; setDirty(false); setToast({message: 'Nuovo archivio creato', type: 'success'}); setNewArchiveModal(false); } }}>Conferma</Button>
                }>
                    <input autoFocus value={newArchiveName} onChange={e => setNewArchiveName(e.target.value)} className="w-full p-2 border border-stone-300 rounded-lg bg-white focus:border-emerald-700 focus:ring-1 ring-emerald-700" onKeyDown={e => { if(e.key==='Enter' && newArchiveName) { setArchive(newArchive(newArchiveName)); fileHandle.current=null; setDirty(false); setToast({message: 'Nuovo archivio creato', type: 'success'}); setNewArchiveModal(false); }}} />
                </Modal>
            )}
        </div>
    );
}
