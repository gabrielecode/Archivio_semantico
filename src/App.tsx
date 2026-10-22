import {useState, useRef, useEffect, useCallback} from 'react';
import {Archive} from './types';
import {newArchive, exportArchiveJson} from './utils/archive';
import {Button, Toast, ConfirmDialog, Modal} from './components/ui';
import {Leaf, Search, Database, Settings2, LogOut, Menu, RefreshCw, HelpCircle, Globe, Cloud, Plus, Shield, Network} from 'lucide-react';
import {DataTab} from './components/DataTab';
import {StructureTab} from './components/StructureTab';
import {SearchTab} from './components/SearchTab';
import {GraphTab} from './components/GraphTab';
import {EmbedBar} from './components/EmbedBar';
import {ArchivePicker} from './components/ArchivePicker';
import GuideContent from './components/GuideContent';
import {calculateEmbHash} from './utils/chunk';
import {openStore, Store, subscribe} from './utils/store';
import {useTranslation} from './utils/i18n';
import {useDriveBackup} from './utils/useDriveBackup';
import {DriveBackupDialog} from './components/DriveBackupDialog';

export default function App({user, onLogout, onOpenAdmin}: {user: {id: string, name: string, email?: string}, onLogout: () => void, onOpenAdmin?: () => void}) {
    const {lang, setLang, t} = useTranslation();
    const [currentUser] = useState(user);
    const [tab, setTab] = useState<'ricerca' | 'schede' | 'campi' | 'graph'>('ricerca');
    const [archive, setArchive] = useState<Archive | null>(null);
    const [archiveId, setArchiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saveError, setSaveError] = useState('');
    const [dirty, setDirty] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [showArchivePicker, setShowArchivePicker] = useState(false);
    const [showGuideModal, setShowGuideModal] = useState(false);
    const [showDriveDialog, setShowDriveDialog] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showTour, setShowTour] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const storeRef = useRef<Store | null>(null);
    const [storeInstance, setStoreInstance] = useState<Store | null>(null);
    const archiveRef = useRef<Archive | null>(null);
    const timerRef = useRef<number | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<any>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [lastSavedTime, setLastSavedTime] = useState<string>('');
    const [showBackupReminder, setShowBackupReminder] = useState(false);

    const driveBackup = useDriveBackup(currentUser.id, currentUser.email, storeInstance);

    useEffect(() => {
        const tourDismissed = localStorage.getItem('tcm_tour_dismissed');
        if (!tourDismissed) {
            setShowTour(true);
        }
        const lastBackup = localStorage.getItem('tcm_last_backup_date');
        if (!lastBackup || Date.now() - new Date(lastBackup).getTime() > 14 * 24 * 60 * 60 * 1000) {
            setShowBackupReminder(true);
        }
    }, []);

    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const store = await openStore(user.id);
                storeRef.current = store;
                setStoreInstance(store);
                const id = await store.getLast();
                let lastId = id;
                if (!lastId) {
                    const list = await store.list();
                    if (list.length > 0) lastId = list[0].id;
                    else {
                        const defaultName = lang === 'de' ? 'Mein Archiv' : 'Il mio archivio';
                        const a = newArchive(defaultName);
                        lastId = defaultName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '-' + crypto.randomUUID().slice(0, 6);
                        await store.put(lastId, a);
                        await store.setLast(lastId);
                    }
                }
                const a = await store.get(lastId!);
                if (a) { 
                    if ((a as any).__upgraded) setToast({message: lang === 'de' ? 'Index neu generieren' : 'Indice da rigenerare', type: 'error'});
                    setArchive(a); setArchiveId(lastId); archiveRef.current = a; 
                }
                setLoading(false);
            } catch (e: any) { setSaveError(e.message); setLoading(false); }
        })();
        const unsub = subscribe(user.id, (msg) => { if (msg.id === archiveId) setConflict(true); });
        return () => unsub();
    }, [user?.id, archiveId, lang]);

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
            setLastSavedTime(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
        } catch (e: any) { setSaveState('error'); setSaveError(e.message); }
    };

    useEffect(() => {
        const handleVisibility = () => { if (document.hidden) flush(); };
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [dirty]);

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
            title: t('logout'),
            message: lang === 'de' ? 'Möchten Sie sich abmelden?' : 'Vuoi uscire dall\'applicazione?',
            onConfirm: async () => {
                await flush();
                onLogout();
                setConfirmDialog(null);
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    const createNewArchive = () => {
        const baseName = lang === 'de' ? 'Neues Archiv' : 'Nuovo Archivio';
        const a = newArchive(baseName);
        const id = 'archivio_' + crypto.randomUUID().slice(0, 8);
        flush();
        setArchive(a);
        setArchiveId(id);
        archiveRef.current = a;
        setDirty(true);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50"><RefreshCw className="animate-spin text-emerald-700" size={32} /></div>;
    if (!archive) return <div className="min-h-screen flex items-center justify-center text-stone-800 p-4 text-center">{saveError}<br/><Button onClick={() => {const a=newArchive('Locale'); setArchive(a); setArchiveId('local'); archiveRef.current=a;}}>Continua</Button></div>;

    return (
        <div className="min-h-screen bg-stone-50 pb-20 sm:pb-0 text-stone-900 font-sans antialiased">
            <header className="sticky top-0 bg-white border-b border-stone-200 z-30">
                <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Leaf className="text-emerald-700 shrink-0" size={24} />
                        <input aria-label="Nome archivio" value={archive.nome} onChange={e => updateArchive(a => ({...a, nome: e.target.value}))} className="text-xl font-serif font-semibold border-none bg-transparent truncate max-w-[50vw] focus:outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2">
                            <Button variant="ghost" onClick={() => setShowArchivePicker(true)} className="min-h-[40px]">{t('archives')}</Button>
                            <Button variant="ghost" onClick={createNewArchive} className="min-h-[40px]">{t('newArchive')}</Button>
                            <Button variant="ghost" onClick={() => { exportArchiveJson(archive); localStorage.setItem('tcm_last_backup_date', new Date().toISOString()); setShowBackupReminder(false); }} className="min-h-[40px]">{t('exportJson')}</Button>
                            <Button variant="ghost" aria-label="Guida" onClick={() => setShowGuideModal(true)} className="min-h-[40px]"><HelpCircle size={16} /></Button>
                            <Button 
                                variant="ghost" 
                                onClick={() => setLang(lang === 'it' ? 'de' : 'it')}
                                className="flex items-center gap-1 px-3 py-2 border border-stone-200 rounded-xl text-xs font-semibold min-h-[40px]"
                                aria-label="Cambia lingua"
                            >
                                <Globe size={16} className="text-emerald-700" />
                                <span className="uppercase">{lang}</span>
                            </Button>
                        </div>
                        
                        <div className="relative" ref={menuRef}>
                            <Button variant="ghost" onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2 min-h-[40px] px-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                                    {(currentUser.email || currentUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-stone-800 truncate max-w-[120px] hidden sm:inline">{currentUser.email || currentUser.name}</span>
                                <Menu size={18} className="sm:hidden" />
                            </Button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl py-2 min-w-[240px] z-40 text-stone-900">
                                    <div className="px-4 py-2 border-b border-stone-100">
                                        <p className="font-semibold text-sm text-stone-900 truncate">{currentUser.email || currentUser.name}</p>
                                    </div>
                                    <div className="sm:hidden">
                                        <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {setShowArchivePicker(true); setShowMenu(false);}}>{t('archives')}</Button>
                                        <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {createNewArchive(); setShowMenu(false);}}>{t('newArchive')}</Button>
                                        <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => { exportArchiveJson(archive); localStorage.setItem('tcm_last_backup_date', new Date().toISOString()); setShowMenu(false); setShowBackupReminder(false); }}>{t('exportJson')}</Button>
                                        <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {setShowGuideModal(true); setShowMenu(false);}}><HelpCircle size={16} className="mr-2" />{t('guide')}</Button>
                                        <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => { setLang(lang === 'it' ? 'de' : 'it'); setShowMenu(false); }}><Globe size={16} className="mr-2" />{lang === 'it' ? 'Deutsch' : 'Italiano'}</Button>
                                    </div>
                                    {onOpenAdmin && (
                                        <Button variant="ghost" className="w-full justify-start py-2.5 text-emerald-700 font-semibold" onClick={() => {onOpenAdmin(); setShowMenu(false);}}>
                                            <Shield size={16} className="mr-2" /> Area Admin
                                        </Button>
                                    )}
                                    <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {setShowDriveDialog(true); setShowMenu(false);}}><Cloud size={16} className="mr-2" />{t('driveBackupMenu')}</Button>
                                    <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {setShowTour(true); setShowMenu(false);}}><HelpCircle size={16} className="mr-2" />{t('redoTour')}</Button>
                                    <Button variant="ghost" className="w-full justify-start text-red-600 py-2.5" onClick={() => {handleLogout(); setShowMenu(false);}}><LogOut size={16} className="mr-2" />{t('logout')}</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center text-sm py-1.5 bg-stone-50 border-t border-stone-100">
                    <div className={saveState==='error'?'text-red-600 font-medium':''}>
                        {saveState==='saving' ? t('saving') : 
                         dirty ? <span className="text-amber-700 font-medium">{t('unsavedChangesPending')}</span> : 
                         saveState==='saved' ? <span className="text-emerald-700 font-semibold">Salvato ✓ {lastSavedTime}</span> : 
                         <span>Salvato</span>}
                        {saveState==='error' && <Button size="sm" variant="ghost" onClick={flush}>{t('retry')}</Button>}
                    </div>
                    <div className="hidden sm:block text-stone-500">
                        {new Date(archive.modificato).toLocaleString(lang === 'de' ? 'de-DE' : 'it-IT')}
                    </div>
                </div>

                {conflict && (
                    <div className="bg-amber-100 border-b border-amber-300 p-3 text-center text-sm font-medium">
                        {t('conflictMsg')}
                        <Button variant="ghost" size="sm" onClick={async () => { const a = await storeRef.current!.get(archiveId!); if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setDirty(false); setConflict(false); }}>{t('reload')}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setConflict(false)}>{t('overwrite')}</Button>
                    </div>
                )}

                {showBackupReminder && (
                    <div className="bg-amber-50 border-b border-amber-200 p-3 text-center text-sm font-medium flex items-center justify-center gap-3 text-amber-900">
                        <span>{t('backupReminder')}</span>
                        <Button size="sm" onClick={() => { exportArchiveJson(archive); localStorage.setItem('tcm_last_backup_date', new Date().toISOString()); setShowBackupReminder(false); }} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                            {t('makeBackupNow')}
                        </Button>
                    </div>
                )}

                {driveBackup.suspended && (
                    <div className="bg-amber-100 border-b border-amber-300 p-3 text-center text-sm font-semibold flex items-center justify-center gap-3 text-amber-900">
                        <span>{t('backupInPause')}</span>
                        <Button size="sm" onClick={driveBackup.connect} className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                            Collega Google Drive
                        </Button>
                    </div>
                )}

                <EmbedBar archive={archive} user={currentUser} onNeedLogin={() => {}} onApply={(results: any) => {
                    updateArchive(a => ({...a, records: a.records.map(r => { const x = results.find((z: any) => z.id === r.id); return x && calculateEmbHash(r) === x.hash ? {...r, chunks: x.chunks, embHash: x.hash} : r; })}));
                }} toast={(msg: string, type: 'success' | 'error') => setToast({message: msg, type})} />

                {/* Desktop Tabs */}
                <div className="hidden sm:flex max-w-6xl mx-auto px-4 border-t border-stone-100 gap-2 pt-2">
                    <button 
                        onClick={() => setTab('ricerca')} 
                        className={`px-6 py-3 font-medium text-base rounded-t-xl transition-colors flex items-center gap-2 ${tab === 'ricerca' ? 'bg-white border-x border-t border-stone-200 text-emerald-800 font-semibold shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                        <Search size={18} /> Cerca
                    </button>
                    <button 
                        onClick={() => setTab('schede')} 
                        className={`px-6 py-3 font-medium text-base rounded-t-xl transition-colors flex items-center gap-2 ${tab === 'schede' ? 'bg-white border-x border-t border-stone-200 text-emerald-800 font-semibold shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                        <Database size={18} /> Schede ({archive.records.length})
                    </button>
                    <button 
                        onClick={() => setTab('graph')} 
                        className={`px-6 py-3 font-medium text-base rounded-t-xl transition-colors flex items-center gap-2 ${tab === 'graph' ? 'bg-white border-x border-t border-stone-200 text-amber-800 font-semibold shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                        <Network size={18} /> Grafico
                    </button>
                    <button 
                        onClick={() => setTab('campi')} 
                        className={`px-6 py-3 font-medium text-base rounded-t-xl transition-colors flex items-center gap-2 ${tab === 'campi' ? 'bg-white border-x border-t border-stone-200 text-emerald-800 font-semibold shadow-sm' : 'text-stone-600 hover:bg-stone-100'}`}
                    >
                        <Settings2 size={18} /> Campi
                    </button>
                </div>
            </header>
            
            <main id="main" className="max-w-6xl mx-auto p-4 sm:p-6">
                <div role="tabpanel" className={tab === 'ricerca' ? '' : 'hidden'}><SearchTab archive={archive} onOpenRec={(id: string)=>{setSelectedId(id); setTab('schede');}} onGoData={()=>setTab('schede')} /></div>
                <div role="tabpanel" className={tab === 'schede' ? '' : 'hidden'}><DataTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} onGoStructure={() => setTab('campi')} selectedId={selectedId} setSelectedId={setSelectedId} setConfirmDialog={setConfirmDialog} /></div>
                <div role="tabpanel" className={tab === 'graph' ? '' : 'hidden'}><GraphTab archive={archive} onOpenRec={(id: string)=>{setSelectedId(id); setTab('schede');}} /></div>
                <div role="tabpanel" className={tab === 'campi' ? '' : 'hidden'}><StructureTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} /></div>
            </main>

            {/* Mobile Fixed Bottom Navigation */}
            <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 flex justify-around p-2 z-30 shadow-lg" aria-label="Navigazione mobile">
                <button 
                    onClick={() => setTab('ricerca')} 
                    className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium rounded-xl min-h-[48px] ${tab === 'ricerca' ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-stone-600'}`}
                >
                    <Search size={20} />
                    <span>Cerca</span>
                </button>
                <button 
                    onClick={() => setTab('schede')} 
                    className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium rounded-xl min-h-[48px] ${tab === 'schede' ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-stone-600'}`}
                >
                    <Database size={20} />
                    <span>Schede</span>
                </button>
                <button 
                    onClick={() => setTab('graph')} 
                    className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium rounded-xl min-h-[48px] ${tab === 'graph' ? 'text-amber-700 bg-amber-50 font-bold' : 'text-stone-600'}`}
                >
                    <Network size={20} />
                    <span>Grafico</span>
                </button>
                <button 
                    onClick={() => setTab('campi')} 
                    className={`flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium rounded-xl min-h-[48px] ${tab === 'campi' ? 'text-emerald-700 bg-emerald-50 font-bold' : 'text-stone-600'}`}
                >
                    <Settings2 size={20} />
                    <span>Campi</span>
                </button>
            </nav>

            <footer className="text-center p-8 text-sm text-stone-500 border-t border-stone-200 mt-12 bg-white hidden sm:block">
                <p>{t('disclaimerConsultation')}</p>
                <p className="text-xs mb-3">{t('disclaimerSimilarity')}</p>
                <p className="text-sm font-medium text-stone-700">
                    {t('createdBylabel')} <a href="https://sititicino.ch/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-semibold">Connect & Create</a>
                </p>
            </footer>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
            {showArchivePicker && <ArchivePicker store={storeRef.current!} currentId={archiveId} onOpen={async (id: string) => { const a = await storeRef.current!.get(id); if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onCreate={() => {}} onImported={async (a: any) => { if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); const id = crypto.randomUUID(); await storeRef.current!.put(id, a); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onClose={() => setShowArchivePicker(false)} toast={(msg: string, type: 'success' | 'error') => setToast({message: msg, type})} />}
            
            {showGuideModal && (
                <Modal title={t('guideTitle')} onClose={() => setShowGuideModal(false)} className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <GuideContent />
                </Modal>
            )}

            {showTour && (
                <Modal title={t('tourTitle')} onClose={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }} className="max-w-lg">
                    <div className="space-y-4 text-stone-800 text-base">
                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                            <p className="font-semibold">{t('tourStep1')}</p>
                            <p className="font-semibold">{t('tourStep2')}</p>
                            <p className="font-semibold">{t('tourStep3')}</p>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <Button variant="secondary" onClick={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }}>
                                {t('dontShowAgain')}
                            </Button>
                            <Button onClick={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }}>
                                Inizia subito
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {showDriveDialog && storeInstance && (
                <DriveBackupDialog 
                    store={storeInstance} 
                    driveBackup={driveBackup} 
                    onClose={() => setShowDriveDialog(false)} 
                    onOpenArchive={async (id: string, a: Archive) => {
                        setArchive(a); 
                        archiveRef.current = a; 
                        setArchiveId(id); 
                        await storeInstance.setLast(id);
                    }} 
                    toast={(msg, type) => setToast({message: msg, type})} 
                />
            )}
        </div>
    );
}

