import {useState, useRef, useEffect, useCallback} from 'react';
import {Archive} from './types';
import {newArchive, exportArchiveJson} from './utils/archive';
import {Button, Toast, ConfirmDialog, Modal} from './components/ui';
import {Leaf, Search, Database, Settings2, LogOut, Menu, RefreshCw, HelpCircle, User as UserIcon, Globe, Cloud} from 'lucide-react';
import {DataTab} from './components/DataTab';
import {StructureTab} from './components/StructureTab';
import {SearchTab} from './components/SearchTab';
import {EmbedBar} from './components/EmbedBar';
import {ArchivePicker} from './components/ArchivePicker';
import GuideContent from './components/GuideContent';
import {calculateEmbHash} from './utils/chunk';
import {openStore, Store, subscribe} from './utils/store';
import {useTranslation} from './utils/i18n';
import {useDriveBackup} from './utils/useDriveBackup';
import {DriveBackupDialog} from './components/DriveBackupDialog';

export default function App({user, onLogout}: {user: {id: string, name: string, email?: string}, onLogout: () => void}) {
    const {lang, setLang, t} = useTranslation();
    const [currentUser] = useState(user);
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
    const [showDriveDialog, setShowDriveDialog] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const storeRef = useRef<Store | null>(null);
    const [storeInstance, setStoreInstance] = useState<Store | null>(null);
    const archiveRef = useRef<Archive | null>(null);
    const timerRef = useRef<number | null>(null);
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
    const [confirmDialog, setConfirmDialog] = useState<any>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const driveBackup = useDriveBackup(currentUser.id, currentUser.email, storeInstance);

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
                        const a = newArchive(lang === 'de' ? 'Mein Archiv' : 'Il mio archivio');
                        lastId = crypto.randomUUID();
                        await store.put(lastId, a);
                        await store.setLast(lastId);
                    }
                }
                const a = await store.get(lastId!);
                if (a) { 
                    if ((a as any).__upgraded) setToast({message: lang === 'de' ? 'Index neu generieren: Embedding generieren drücken' : 'Indice da rigenerare: premi Genera embedding', type: 'error'});
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
            title: t('logout'),
            message: lang === 'de' ? 'Möchten Sie sich abmelden? Lokal gespeicherte Änderungen bleiben auf dem Gerät.' : 'Vuoi uscire? Le modifiche salvate in locale rimarranno sul dispositivo.',
            onConfirm: async () => {
                await flush();
                onLogout();
                setConfirmDialog(null);
            },
            onCancel: () => setConfirmDialog(null)
        });
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><RefreshCw className="animate-spin text-emerald-700" /></div>;
    if (!archive) return <div className="min-h-screen flex items-center justify-center text-red-600 p-4 text-center">{saveError}<br/><Button onClick={() => {const a=newArchive('Locale'); setArchive(a); setArchiveId('local'); archiveRef.current=a;}}>{lang === 'de' ? 'Ohne lokales Speichern fortfahren' : 'Continua senza salvataggio locale'}</Button></div>;

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
                            <div className="absolute right-0 top-full mt-2 bg-white border rounded-lg shadow-lg py-2 min-w-[220px] z-25 text-stone-900">
                                <div className="px-4 py-2 border-b border-stone-100 font-semibold text-sm text-stone-700 truncate">{currentUser.email || currentUser.name}</div>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowArchivePicker(true); setShowMenu(false);}}>{t('archives')}</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => { const a = newArchive(lang === 'de' ? 'Neu' : 'Nuovo'); const id = crypto.randomUUID(); flush(); setArchive(a); setArchiveId(id); archiveRef.current=a; setDirty(true); setShowMenu(false); }}>{t('newArchive')}</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {exportArchiveJson(archive); setShowMenu(false);}}>{t('exportJson')}</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowDriveDialog(true); setShowMenu(false);}}><Cloud size={16} />{t('driveBackupMenu')}</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => {setShowGuideModal(true); setShowMenu(false);}}><HelpCircle size={16} />{t('guide')}</Button>
                                <Button variant="ghost" className="w-full justify-start" onClick={() => { setLang(lang === 'it' ? 'de' : 'it'); setShowMenu(false); }}><Globe size={16} />{lang === 'it' ? 'Deutsch' : 'Italiano'}</Button>
                                <Button variant="ghost" className="w-full justify-start text-red-600" onClick={() => {handleLogout(); setShowMenu(false);}}><LogOut size={16} />{t('logout')}</Button>
                            </div>
                        )}
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Button variant="ghost" onClick={() => setShowArchivePicker(true)}>{t('archives')}</Button>
                        <Button variant="ghost" onClick={() => { const a = newArchive(lang === 'de' ? 'Neu' : 'Nuovo'); const id = crypto.randomUUID(); flush(); setArchive(a); setArchiveId(id); archiveRef.current=a; setDirty(true); }}>{t('newArchive')}</Button>
                        <Button variant="ghost" onClick={() => exportArchiveJson(archive)}>{t('exportJson')}</Button>
                        <Button variant="ghost" aria-label="Guida" onClick={() => setShowGuideModal(true)}><HelpCircle size={16} /></Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => setLang(lang === 'it' ? 'de' : 'it')}
                            className="flex items-center gap-1 px-2.5 py-1.5 border border-stone-200 rounded-lg text-xs font-semibold"
                            aria-label="Cambia lingua"
                        >
                            <Globe size={14} className="text-emerald-700" />
                            <span className="uppercase">{lang}</span>
                        </Button>
                        
                        <div className="relative ml-2 pl-2 border-l border-stone-200">
                            <Button variant="ghost" onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm">
                                    {(currentUser.email || currentUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-stone-800 truncate max-w-[150px]">{currentUser.email || currentUser.name}</span>
                            </Button>
                            {showMenu && (
                                <div className="absolute right-0 top-full mt-2 bg-white border rounded-xl shadow-xl py-2 min-w-[220px] z-25 text-stone-900">
                                    <div className="px-4 py-2 border-b border-stone-100">
                                        <p className="font-semibold text-sm text-stone-900 truncate">{currentUser.email || currentUser.name}</p>
                                    </div>
                                    <Button variant="ghost" className="w-full justify-start py-2.5" onClick={() => {setShowDriveDialog(true); setShowMenu(false);}}><Cloud size={16} className="mr-2" />{t('driveBackupMenu')}</Button>
                                    <Button variant="ghost" className="w-full justify-start text-red-600 py-2.5" onClick={() => {handleLogout(); setShowMenu(false);}}><LogOut size={16} />{t('logout')}</Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto px-4 flex justify-between items-center text-sm py-1">
                    <div className={saveState==='error'?'text-red-600':''}>{saveState==='saving'?t('saving'):saveState==='saved'?t('savedLocal'):saveState==='error'?`${t('errorPrefix')}${saveError}`:''} {saveState==='error' && <Button size="sm" variant="ghost" onClick={flush}>{t('retry')}</Button>}</div>
                    <div>{new Date(archive.modificato).toLocaleString(lang === 'de' ? 'de-DE' : 'it-IT')}</div>
                </div>
                {conflict && <div className="bg-amber-100 border-b border-amber-300 p-2 text-center text-sm">{t('conflictMsg')}<Button variant="ghost" size="sm" onClick={async () => { const a = await storeRef.current!.get(archiveId!); if ((a as any).__upgraded) setToast({message: lang === 'de' ? 'Index neu generieren' : 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setDirty(false); setConflict(false); }}>{t('reload')}</Button><Button variant="ghost" size="sm" onClick={() => setConflict(false)}>{t('overwrite')}</Button></div>}
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
            </header>
            
            <main id="main" className="max-w-6xl mx-auto p-4">
                <div id="ricerca-panel" role="tabpanel" className={tab === 'ricerca' ? '' : 'hidden'}><SearchTab archive={archive} onOpenRec={(id: string)=>{setSelectedId(id); setTab('dati');}} onGoData={()=>setTab('dati')} /></div>
                <div id="dati-panel" role="tabpanel" className={tab === 'dati' ? '' : 'hidden'}><DataTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} onGoStructure={() => setTab('struttura')} selectedId={selectedId} setSelectedId={setSelectedId} setConfirmDialog={setConfirmDialog} /></div>
                <div id="struttura-panel" role="tabpanel" className={tab === 'struttura' ? '' : 'hidden'}><StructureTab archive={archive} setArchive={a => updateArchive(typeof a==='function' ? a : () => a)} setDirty={setDirty} /></div>
            </main>

            <footer className="text-center p-8 text-sm text-stone-500 border-t border-stone-200 mt-12 bg-white">
                <p>{t('disclaimerConsultation')}</p>
                <p className="text-xs mb-3">{t('disclaimerSimilarity')}</p>
                <p className="text-sm font-medium text-stone-700">
                    {t('createdBylabel')} <a href="https://sititicino.ch/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-semibold">Connect & Create</a>
                </p>
            </footer>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {confirmDialog && <ConfirmDialog {...confirmDialog} />}
            {showArchivePicker && <ArchivePicker store={storeRef.current!} currentId={archiveId} onOpen={async (id: string) => { const a = await storeRef.current!.get(id); if ((a as any).__upgraded) setToast({message: lang === 'de' ? 'Index neu generieren' : 'Indice da rigenerare', type: 'error'}); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onCreate={() => {}} onImported={async (a: any) => { if ((a as any).__upgraded) setToast({message: lang === 'de' ? 'Index neu generieren' : 'Indice da rigenerare', type: 'error'}); const id = crypto.randomUUID(); await storeRef.current!.put(id, a); setArchive(a); archiveRef.current=a; setArchiveId(id); await storeRef.current!.setLast(id); }} onClose={() => setShowArchivePicker(false)} toast={(msg: string, type: 'success' | 'error') => setToast({message: msg, type})} />}
            
            {showGuideModal && (
                <Modal title={t('guideTitle')} onClose={() => setShowGuideModal(false)} className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <GuideContent />
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
