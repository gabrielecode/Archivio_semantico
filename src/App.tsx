import {useState, useRef, useEffect, useCallback} from 'react';
import {Archive} from './types';
import {newArchive, exportArchiveJson} from './utils/archive';
import {Button, Toast, ConfirmDialog, Modal} from './components/ui';
import {Leaf, Search, Database, Settings2, LogOut, Menu, RefreshCw, HelpCircle, Globe, Cloud, Plus, Shield, Network, Moon, Sun} from 'lucide-react';
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
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('tcm_theme');
        if (saved) return saved as 'light' | 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('tcm_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

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

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-bg-primary"><RefreshCw className="animate-spin text-accent" size={32} /></div>;
    if (!archive) return <div className="min-h-screen flex items-center justify-center text-text-primary p-4 text-center">{saveError}<br/><Button onClick={() => {const a=newArchive('Locale'); setArchive(a); setArchiveId('local'); archiveRef.current=a;}}>Continua</Button></div>;

    return (
        <div className="min-h-screen bg-bg-primary pb-20 sm:pb-0 text-text-primary font-sans antialiased">
            <header className="sticky top-0 bg-card-bg/80 backdrop-blur-md border-b border-border-primary z-30">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
                    {/* Zone 1: Brand */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
                            <Leaf size={20} />
                        </div>
                        <input 
                            aria-label="Nome archivio" 
                            value={archive.nome} 
                            onChange={e => updateArchive(a => ({...a, nome: e.target.value}))} 
                            className="text-lg font-bold tracking-tight border-none bg-transparent focus:outline-none w-40 sm:w-64 truncate" 
                        />
                    </div>

                    {/* Zone 2: Navigation Links */}
                    <nav className="hidden lg:flex items-center gap-1 bg-stone-100/50 p-1 rounded-2xl">
                        <button 
                            onClick={() => setTab('ricerca')} 
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${tab === 'ricerca' ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-bg-alt'}`}
                        >
                            <Search size={16} /> Ricerca
                        </button>
                        <button 
                            onClick={() => setTab('schede')} 
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${tab === 'schede' ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-bg-alt'}`}
                        >
                            <Database size={16} /> Schede ({archive.records.length})
                        </button>
                        <button 
                            onClick={() => setTab('graph')} 
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${tab === 'graph' ? 'bg-white text-amber-800 shadow-sm' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'}`}
                        >
                            <Network size={16} /> Grafico
                        </button>
                        <button 
                            onClick={() => setTab('campi')} 
                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${tab === 'campi' ? 'bg-bg-primary text-accent shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-bg-alt'}`}
                        >
                            <Settings2 size={16} /> Campi
                        </button>
                    </nav>

                    {/* Zone 3: Primary Action / User */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 mr-2">
                             <Button variant="ghost" size="sm" onClick={toggleTheme} icon={theme === 'light' ? Moon : Sun} />
                             <Button variant="ghost" size="sm" onClick={() => setShowArchivePicker(true)}>{t('archives')}</Button>
                             <Button variant="ghost" size="sm" onClick={() => setShowGuideModal(true)} icon={HelpCircle}>{t('instructions')}</Button>
                        </div>
                        
                        <div className="relative" ref={menuRef}>
                            <button 
                                onClick={() => setShowMenu(!showMenu)} 
                                className="flex items-center gap-2 p-1 pl-3 bg-bg-alt hover:bg-bg-primary rounded-full transition-colors border border-border-primary"
                            >
                                <span className="text-xs font-bold text-text-muted hidden md:block max-w-[100px] truncate">{currentUser.name || currentUser.email}</span>
                                <div className="w-8 h-8 rounded-full bg-card-bg text-accent font-bold flex items-center justify-center text-sm shadow-sm border border-border-primary">
                                    {(currentUser.email || currentUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-3 bg-card-bg border border-border-primary rounded-3xl shadow-2xl py-3 min-w-[260px] z-40 text-text-primary overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                    <div className="px-5 py-3 border-b border-border-primary bg-bg-alt/50">
                                        <p className="font-bold text-sm text-text-primary truncate">{currentUser.name || 'Utente'}</p>
                                        <p className="text-xs text-text-muted truncate">{currentUser.email}</p>
                                    </div>
                                    <div className="p-2 space-y-1">
                                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => {createNewArchive(); setShowMenu(false);}} icon={Plus}>{t('newArchive')}</Button>
                                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => { exportArchiveJson(archive); setShowMenu(false); }} icon={Cloud}>{t('exportJson')}</Button>
                                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => {setShowDriveDialog(true); setShowMenu(false);}} icon={Cloud}>{t('driveBackupMenu')}</Button>
                                        <div className="h-px bg-border-primary my-1 mx-2" />
                                        <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => { setLang(lang === 'it' ? 'de' : 'it'); setShowMenu(false); }} icon={Globe}>{lang === 'it' ? 'Lingua: Italiano' : 'Sprache: Deutsch'}</Button>
                                        {onOpenAdmin && (
                                            <Button variant="ghost" className="w-full justify-start text-sm text-accent font-bold" onClick={() => {onOpenAdmin(); setShowMenu(false);}} icon={Shield}>Area Admin</Button>
                                        )}
                                        <div className="h-px bg-border-primary my-1 mx-2" />
                                        <Button variant="ghost" className="w-full justify-start text-sm text-red-600 font-bold" onClick={() => {handleLogout(); setShowMenu(false);}} icon={LogOut}>{t('logout')}</Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button className="lg:hidden p-2 text-text-muted" onClick={() => setTab(tab === 'ricerca' ? 'schede' : 'ricerca')}>
                            <Menu size={24} />
                        </button>
                    </div>
                </div>

                {/* Sub-header status bar */}
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center text-[11px] h-8 bg-bg-alt/80 border-t border-border-primary">
                    <div className="flex items-center gap-4">
                        <div className={saveState==='error'?'text-red-600 font-bold':''}>
                            {saveState==='saving' ? t('saving') : 
                             dirty ? <span className="text-amber-700 font-bold uppercase tracking-wider">{t('unsavedChangesPending')}</span> : 
                             saveState==='saved' ? <span className="text-accent font-bold uppercase tracking-wider">Sincronizzato {lastSavedTime}</span> : 
                             <span className="uppercase tracking-wider opacity-50">Pronto</span>}
                        </div>
                        {saveState==='error' && <button onClick={flush} className="text-red-700 font-bold underline ml-2 uppercase tracking-wider">Riprova</button>}
                    </div>
                    <div className="text-stone-400 font-medium uppercase tracking-widest">
                        {new Date(archive.modificato).toLocaleString(lang === 'de' ? 'de-DE' : 'it-IT')}
                    </div>
                </div>

                {conflict && (
                    <div className="bg-amber-50 border-b border-amber-200 py-2 px-6 flex items-center justify-center gap-4 text-xs font-bold text-amber-900">
                        <span>{t('conflictMsg')}</span>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={async () => { const a = await storeRef.current!.get(archiveId!); if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setDirty(false); setConflict(false); }}>{t('reload')}</Button>
                            <Button variant="primary" size="sm" onClick={() => setConflict(false)}>{t('overwrite')}</Button>
                        </div>
                    </div>
                )}
            </header>
            
            <main id="main" className="max-w-7xl mx-auto px-6 py-8">
                <div role="tabpanel" className={`animate-in fade-in duration-500 ${tab === 'ricerca' ? '' : 'hidden'}`}>
                    <SearchTab archive={archive} onOpenRec={(id: string)=>{setSelectedId(id); setTab('schede');}} onGoData={()=>setTab('schede')} updateArchive={updateArchive} />
                </div>
                <div role="tabpanel" className={`animate-in fade-in duration-500 ${tab === 'schede' ? '' : 'hidden'}`}>
                    <DataTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} onGoStructure={() => setTab('campi')} selectedId={selectedId} setSelectedId={setSelectedId} setConfirmDialog={setConfirmDialog} />
                </div>
                <div role="tabpanel" className={`animate-in fade-in duration-500 ${tab === 'graph' ? '' : 'hidden'}`}>
                    <GraphTab archive={archive} onOpenRec={(id: string)=>{setSelectedId(id); setTab('schede');}} />
                </div>
                <div role="tabpanel" className={`animate-in fade-in duration-500 ${tab === 'campi' ? '' : 'hidden'}`}>
                    <StructureTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} />
                </div>
            </main>

            {/* Mobile Fixed Bottom Navigation */}
            <nav className="sm:hidden fixed bottom-6 inset-x-6 h-16 bg-card-bg/90 backdrop-blur-xl border border-border-primary flex items-center justify-around px-2 z-30 shadow-2xl rounded-3xl" aria-label="Navigazione mobile">
                <button 
                    onClick={() => setTab('ricerca')} 
                    className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${tab === 'ricerca' ? 'text-accent bg-bg-primary shadow-inner' : 'text-text-muted'}`}
                >
                    <Search size={20} />
                    <span className="text-[10px] font-bold mt-1">Cerca</span>
                </button>
                <button 
                    onClick={() => setTab('schede')} 
                    className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${tab === 'schede' ? 'text-accent bg-bg-primary shadow-inner' : 'text-text-muted'}`}
                >
                    <Database size={20} />
                    <span className="text-[10px] font-bold mt-1">Schede</span>
                </button>
                <button 
                    onClick={() => setTab('graph')} 
                    className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${tab === 'graph' ? 'text-amber-700 bg-amber-50 shadow-inner' : 'text-stone-400'}`}
                >
                    <Network size={20} />
                    <span className="text-[10px] font-bold mt-1">Grafico</span>
                </button>
                <button 
                    onClick={() => setTab('campi')} 
                    className={`flex flex-col items-center justify-center w-14 h-12 rounded-2xl transition-all ${tab === 'campi' ? 'text-accent bg-bg-primary shadow-inner' : 'text-text-muted'}`}
                >
                    <Settings2 size={20} />
                    <span className="text-[10px] font-bold mt-1">Campi</span>
                </button>
            </nav>

            <footer className="text-center p-12 text-sm text-text-muted border-t border-border-primary mt-20 bg-card-bg hidden sm:block">
                <div className="max-w-2xl mx-auto space-y-4">
                    <p className="leading-relaxed">{t('disclaimerConsultation')}</p>
                    <p className="text-[11px] opacity-60">{t('disclaimerSimilarity')}</p>
                    <div className="flex items-center justify-center gap-4 text-xs text-text-muted pt-1">
                        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-accent underline">Informativa sulla Privacy</a>
                        <span>•</span>
                        <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-accent underline">Termini di Servizio</a>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2 text-text-primary font-medium">
                        <span>{t('createdBylabel')}</span>
                        <a href="https://sititicino.ch/" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors font-bold">Connect & Create</a>
                    </div>
                </div>
            </footer>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
            {showArchivePicker && <ArchivePicker store={storeRef.current!} currentId={archiveId} onOpen={async (id: string) => { const a = await storeRef.current!.get(id); if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onCreate={() => {}} onImported={async (a: any) => { if ((a as any).__upgraded) setToast({message: 'Indice da rigenerare', type: 'error'}); const id = crypto.randomUUID(); await storeRef.current!.put(id, a); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onClose={() => setShowArchivePicker(false)} toast={(msg: string, type: 'success' | 'error') => setToast({message: msg, type})} />}
            
            {showGuideModal && (
                <Modal title={t('guideTitle')} onClose={() => setShowGuideModal(false)} className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <GuideContent />
                </Modal>
            )}

            {showTour && (
                <Modal title={t('tourTitle')} onClose={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }} className="max-w-xl">
                    <div className="space-y-6 text-stone-800 text-base">
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-3">
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                                <p className="font-semibold text-stone-900">{t('tourStep1')}</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">2</div>
                                <p className="font-semibold text-stone-900">{t('tourStep2')}</p>
                            </div>
                            <div className="flex gap-3">
                                <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 text-xs font-bold">3</div>
                                <p className="font-semibold text-stone-900">{t('tourStep3')}</p>
                            </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <Button variant="ghost" onClick={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }}>
                                {t('dontShowAgain')}
                            </Button>
                            <Button size="lg" onClick={() => { setShowTour(false); localStorage.setItem('tcm_tour_dismissed', 'true'); }}>
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
