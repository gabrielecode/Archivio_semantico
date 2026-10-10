import {useState, useRef, useEffect, useCallback} from 'react';
import {Archive} from './types';
import {newArchive, exportArchiveJson} from './utils/archive';
import {Button, Toast, ConfirmDialog, Modal} from './components/ui';
import {Leaf, Search, Database, Settings2, LogOut, Menu, RefreshCw, HelpCircle} from 'lucide-react';
import {DataTab} from './components/DataTab';
import {StructureTab} from './components/StructureTab';
import {SearchTab} from './components/SearchTab';
import {EmbedBar} from './components/EmbedBar';
import {ArchivePicker} from './components/ArchivePicker';
import GuideContent from './components/GuideContent';
import {calculateEmbHash} from './utils/chunk';
import {openStore, Store, subscribe} from './utils/store';

export default function App({user, onLogout}: {user: {id: string, name: string}, onLogout: () => void}) {
    const [tab, setTab] = useState<'ricerca' | 'dati' | 'struttura'>('ricerca');
    const [archive, setArchive] = useState<Archive | null>(null);
    const [archiveId, setArchiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');
    const [dirty, setDirty] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [showArchivePicker, setShowArchivePicker] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const storeRef = useRef<Store | null>(null);
    const archiveRef = useRef<Archive | null>(null);
    const timerRef = useRef<number | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<any>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const store = await openStore(user.id);
                storeRef.current = store;
                const id = await store.getLast();
                let lastId = id;
                if (!lastId) {
                    const list = await store.list();
                    if (list.length > 0) lastId = list[0].id;
                    else {
                        const a = newArchive('Il mio archivio');
                        lastId = crypto.randomUUID();
                        await store.put(lastId, a);
                        await store.setLast(lastId);
                    }
                }
                const a = await store.get(lastId!);
                if (a) { setArchive(a); setArchiveId(lastId); archiveRef.current = a; }
                setLoading(false);
            } catch (e: any) { setSaveError(e.message); setLoading(false); }
        })();
        const unsub = subscribe(user.id, (msg) => { if (msg.id === archiveId) setConflict(true); });
        return () => unsub();
    }, [user?.id, archiveId]);

    useEffect(() => {
        archiveRef.current = archive;
        if (dirty && !conflict) {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, 1200) as any;
        }
    }, [archive, dirty, conflict]);

    const flush = async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!dirty || !storeRef.current || !archiveId || conflict) return;
        setSaveState('saving');
        try {
            await storeRef.current.put(archiveId, archiveRef.current!);
            setDirty(false);
            setSaveState('saved');
        } catch (e: any) { setSaveState('error'); setSaveError(e.message); }
    };

    useEffect(() => {
        const handleVisibility = () => { if (document.hidden) flush(); };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    const updateArchive = useCallback((fn: (a: Archive) => Archive) => {
        setArchive(prev => {
            if (!prev) return null;
            const next = fn(prev);
            return {...next, modificato: new Date().toISOString()};
        });
        setDirty(true);
    }, []);

    const handleLogout = () => {
        setConfirmDialog({
            title: 'Logout',
            message: 'Vuoi uscire? Le modifiche salvate in locale rimarranno sul dispositivo.',
            onConfirm: async () => {
                await flush();
                onLogout();
                setConfirmDialog(null);
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const navItems = [ {id: 'ricerca', icon: Search, label: 'Ricerca'}, {id: 'dati', icon: Database, label: 'Dati'}, {id: 'struttura', icon: Settings2, label: 'Struttura'}];
    const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'ArrowRight') setTab(navItems[(index + 1) % navItems.length].id as any);
        else if (e.key === 'ArrowLeft') setTab(navItems[(index - 1 + navItems.length) % navItems.length].id as any);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-emerald-700" /></div>;
    if (!archive) return <div className="min-h-screen flex items-center justify-center text-red-600 p-4 text-center">{saveError}<br/><Button onClick={() => {const a=newArchive('Locale'); setArchive(a); setArchiveId('local'); archiveRef.current=a;}}>Continua senza salvataggio locale</Button></div>;

    return (
        <div className="min-h-screen bg-stone-50">
            <header className="sticky top-0 bg-white border-b z-10">
                <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Leaf className="text-emerald-700 shrink-0" />
                        <input aria-label="Nome archivio" value={archive.nome} onChange={e => updateArchive(a => ({...a, nome: e.target.value}))} className="text-xl font-serif font-semibold border-none bg-transparent truncate max-w-[50vw]" />
                    </div>
                    <div className="flex items-center gap-2 sm:hidden relative" ref={menuRef}>
                        <Button variant="ghost" onClick={() => setShowMenu(!showMenu)} aria-label="Menu"><Menu size={16} /></Button>
                        {showMenu && (
                            <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg py-2 min-w-[200px] z-25">
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowArchivePicker(true); setShowMenu(false);}}>Archivi</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => { const a = newArchive('Nuovo'); const id = crypto.randomUUID(); flush(); setArchive(a); setArchiveId(id); archiveRef.current=a; setDirty(true); setShowMenu(false); }}>Nuovo</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {exportArchiveJson(archive); setShowMenu(false);}}>Esporta JSON</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowGuideModal(true); setShowMenu(false);}}><HelpCircle size={16} />Guida</Button>
                                <Button variant="ghost" className="w-full justify-start text-red-600" onClick={() => {handleLogout(); setShowMenu(false);}}><LogOut size={16} />Esci</Button>
                            </div>
                        )}
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setShowArchivePicker(true)}>Archivi</Button>
                        <Button variant="ghost" onClick={() => { const a = newArchive('Nuovo'); const id = crypto.randomUUID(); flush(); setArchive(a); setArchiveId(id); archiveRef.current=a; setDirty(true); }}>Nuovo</Button>
                        <Button variant="ghost" onClick={() => exportArchiveJson(archive)}>Esporta JSON</Button>
                        <Button variant="ghost" aria-label="Guida" onClick={() => setShowGuideModal(true)}><HelpCircle size={16} /></Button>
                        <Button variant="ghost" onClick={handleLogout}><LogOut size={16} /></Button>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center text-sm py-1">
                    <div className={saveState==='error'?'text-red-600':''}>{saveState==='saving'?'Salvataggio...':saveState==='saved'?'Salvato in locale':saveState==='error'?`Errore: ${saveError}`:''} {saveState==='error' && <Button size="sm" variant="ghost" onClick={flush}>Riprova</Button>}</div>
                    <div>{new Date(archive.modificato).toLocaleString('it-IT')}</div>
                </div>
                {conflict && <div className="bg-amber-100 border-b border-amber-300 p-2 text-center text-sm">Questo archivio è stato modificato in un'altra scheda.<Button variant="ghost" size="sm" onClick={async () => { const a = await storeRef.current!.get(archiveId!); setArchive(a); archiveRef.current=a; setDirty(false); setConflict(false); }}>Ricarica</Button><Button variant="ghost" size="sm" onClick={() => setConflict(false)}>Sovrascrivi</Button></div>}
                <EmbedBar archive={archive} user={user} onNeedLogin={() => {}} onApply={results => {
                    updateArchive(a => ({...a, records: a.records.map(r => { const x = results.find((z: any) => z.id === r.id); return x && calculateEmbHash(r) === x.hash ? {...r, chunks: x.chunks, embHash: x.hash} : r; })}));
                }} toast={(msg, type) => setToast({message: msg, type})} />
            </header>
            
            <main id="main" className="max-w-6xl mx-auto p-4">
                <div id="ricerca-panel" role="tabpanel" className={tab === 'ricerca' ? '' : 'hidden'}><SearchTab archive={archive} onOpenRec={id=>{setSelectedId(id); setTab('dati');}} onGoData={()=>setTab('dati')} /></div>
                <div id="dati-panel" role="tabpanel" className={tab === 'dati' ? '' : 'hidden'}><DataTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} onGoStructure={() => setTab('struttura')} selectedId={selectedId} setSelectedId={setSelectedId} setConfirmDialog={setConfirmDialog} /></div>
                <div id="struttura-panel" role="tabpanel" className={tab === 'struttura' ? '' : 'hidden'}><StructureTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} /></div>
            </main>

            <footer className="text-center p-8 text-sm text-stone-500">
                <p>Strumento di consultazione, non sostituisce un parere medico</p>
                <p className="text-xs">I risultati sono similarità semantica, non diagnosi</p>
            </footer>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
            {showArchivePicker && <ArchivePicker store={storeRef.current!} currentId={archiveId} onOpen={async id => { const a = await storeRef.current!.get(id); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onCreate={() => {}} onImported={async a => { const id = crypto.randomUUID(); await storeRef.current!.put(id, a); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onClose={() => setShowArchivePicker(false)} toast={(msg, type) => setToast({message: msg, type})} />}
            
            {showGuideModal && (
                <Modal title="Guida all'uso" onClose={() => setShowGuideModal(false)} className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <GuideContent />
                </Modal>
            )}
        </div>
    );
}
