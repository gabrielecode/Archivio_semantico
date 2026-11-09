import {useState, useEffect} from 'react';
import {Modal, Button} from './ui';
import {Cloud, RefreshCw, Download, AlertTriangle, CheckCircle, AlertCircle, Unlink} from 'lucide-react';
import {listBackupFiles, downloadBackupFile} from '../utils/drive';
import {parseArchive} from '../utils/archive';
import {Store} from '../utils/store';
import {Archive} from '../types';

interface DriveBackupDialogProps {
    store: Store;
    driveBackup: any;
    onClose: () => void;
    onOpenArchive: (id: string, archive: Archive) => void;
    toast: (msg: string, type: 'success' | 'error') => void;
}

export function DriveBackupDialog({store, driveBackup, onClose, onOpenArchive, toast}: DriveBackupDialogProps) {
    const {connected, includeEmbeddings, suspended, consecutiveErrors, backingUp, lastBackupTime, connect, disconnect, setIncludeEmbeddings, backupNow} = driveBackup;
    const [backups, setBackups] = useState<any[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [manualSaving, setManualSaving] = useState(false);
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [conflictModal, setConflictModal] = useState<{archive: Archive, tcmArchiveId?: string} | null>(null);

    const loadFiles = async () => {
        if (!connected) return;
        setLoadingFiles(true);
        try {
            const files = await listBackupFiles();
            setBackups(files);
        } catch (e: any) {
            console.error('Error loading backups from Drive:', e);
            toast(e.message || 'Errore caricamento elenco backup da Google Drive', 'error');
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        if (connected) {
            loadFiles();
        }
    }, [connected]);

    const handleConnectClick = async () => {
        setConnecting(true);
        try {
            const res = await connect();
            if (res?.success) {
                toast('Google Drive collegato con successo!', 'success');
                loadFiles();
            } else if (res?.error && res.error !== 'popup_closed_by_user') {
                toast(res.error, 'error');
            }
        } catch (e: any) {
            toast(e.message || 'Impossibile connettere Google Drive', 'error');
        } finally {
            setConnecting(false);
        }
    };

    const handleManualBackup = async () => {
        setManualSaving(true);
        try {
            const res = await backupNow(true);
            if (res?.success) {
                toast(res.count ? `Backup completato: ${res.count} archivi salvati su Google Drive` : 'Tutti gli archivi sono già aggiornati su Drive', 'success');
                loadFiles();
            } else if (res?.error) {
                toast(res.error, 'error');
            }
        } catch (e: any) {
            toast(e.message || 'Errore durante il salvataggio su Drive', 'error');
        } finally {
            setManualSaving(false);
        }
    };

    const handleRestoreClick = async (fileId: string) => {
        setRestoringId(fileId);
        try {
            const json = await downloadBackupFile(fileId);
            const archive = parseArchive(json);
            const tcmId = backups.find(b => b.id === fileId)?.tcmArchiveId;
            
            let existing = null;
            if (tcmId) {
                existing = await store.get(tcmId);
            }

            if (existing) {
                setConflictModal({archive, tcmArchiveId: tcmId});
            } else {
                const newId = tcmId || crypto.randomUUID();
                await store.put(newId, archive);
                await store.setLast(newId);
                onOpenArchive(newId, archive);
                toast('Archivio ripristinato con successo da Google Drive', 'success');
                onClose();
            }
        } catch (e: any) {
            toast(e.message || 'Errore durante il ripristino', 'error');
        } finally {
            setRestoringId(null);
        }
    };

    const handleReplace = async () => {
        if (!conflictModal) return;
        const {archive, tcmArchiveId} = conflictModal;
        const id = tcmArchiveId!;
        await store.put(id, archive);
        await store.setLast(id);
        onOpenArchive(id, archive);
        toast('Archivio sostituito con successo', 'success');
        setConflictModal(null);
        onClose();
    };

    const handleCopy = async () => {
        if (!conflictModal) return;
        const {archive} = conflictModal;
        const newId = crypto.randomUUID();
        await store.put(newId, archive);
        await store.setLast(newId);
        onOpenArchive(newId, archive);
        toast('Archivio importato come nuova copia', 'success');
        setConflictModal(null);
        onClose();
    };

    return (
        <Modal title="Backup su Google Drive" onClose={onClose} className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="space-y-6 text-stone-900 text-base py-2">
                {!connected ? (
                    <div className="space-y-6 text-center py-6">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <Cloud size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-xl font-serif font-bold text-stone-900">Salvataggio automatico su Google Drive</h3>
                            <p className="text-stone-600 text-base leading-relaxed max-w-md mx-auto">
                                Collega il tuo Google Drive personale per salvare copie di sicurezza automatiche dei tuoi archivi in modo riservato e sicuro.
                            </p>
                        </div>
                        <div className="pt-2">
                            <Button 
                                onClick={handleConnectClick} 
                                disabled={connecting}
                                className="py-3.5 px-8 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg inline-flex items-center gap-2"
                            >
                                {connecting ? <RefreshCw className="animate-spin" size={20} /> : <Cloud size={20} />}
                                {connecting ? 'Connessione in corso...' : 'Collega Google Drive'}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {suspended && (
                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-300 flex items-start gap-3">
                                <AlertCircle className="text-amber-700 shrink-0 mt-0.5" size={20} />
                                <div className="space-y-2 flex-1">
                                    <p className="font-semibold text-amber-900 text-sm">
                                        Sincronizzazione temporaneamente sospesa
                                    </p>
                                    <p className="text-amber-800 text-xs leading-relaxed">
                                        La sessione di accesso a Google Drive potrebbe essere scaduta. Clicca su &quot;Riconnetti&quot; per rinnovare l&apos;autorizzazione.
                                    </p>
                                    <Button 
                                        size="sm" 
                                        onClick={handleConnectClick}
                                        disabled={connecting}
                                        className="bg-amber-700 hover:bg-amber-800 text-white font-medium text-xs py-1.5 px-3"
                                    >
                                        {connecting ? 'Riconnessione...' : 'Riconnetti Google Drive'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="text-emerald-700 shrink-0" size={26} />
                                <div>
                                    <p className="font-semibold text-emerald-900 text-base">Google Drive collegato</p>
                                    <p className="text-emerald-700 text-xs">
                                        Ultimo backup: {lastBackupTime ? new Date(lastBackupTime).toLocaleString('it-IT') : 'Mai eseguito'}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                onClick={handleManualBackup} 
                                disabled={backingUp || manualSaving} 
                                className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-2 shadow-sm text-sm"
                            >
                                {(backingUp || manualSaving) ? <RefreshCw className="animate-spin" size={16} /> : <Cloud size={16} />}
                                {(backingUp || manualSaving) ? 'Salvataggio...' : 'Salva ora su Drive'}
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
                            <div>
                                <label className="font-semibold text-stone-900 text-sm block cursor-pointer">
                                    Includi vettori semantici (embeddings)
                                </label>
                                <p className="text-stone-500 text-xs">
                                    I file saranno più grandi ma preserveranno l&apos;indice semantico già calcolato.
                                </p>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={includeEmbeddings} 
                                onChange={e => setIncludeEmbeddings(e.target.checked)}
                                className="w-5 h-5 accent-emerald-700 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-serif font-bold text-lg text-stone-900">File di backup su Drive</h3>
                                <Button variant="secondary" onClick={loadFiles} disabled={loadingFiles} className="text-xs py-1.5 px-3">
                                    {loadingFiles ? <RefreshCw className="animate-spin" size={14} /> : 'Aggiorna elenco'}
                                </Button>
                            </div>

                            {loadingFiles ? (
                                <div className="py-8 text-center text-stone-500 flex items-center justify-center gap-2">
                                    <RefreshCw className="animate-spin text-emerald-700" size={20} />
                                    <span>Caricamento file da Google Drive...</span>
                                </div>
                            ) : backups.length === 0 ? (
                                <p className="text-stone-500 italic py-6 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                                    Nessun backup trovato su Google Drive. Clicca su &quot;Salva ora su Drive&quot; per creare il primo backup.
                                </p>
                            ) : (
                                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                    {backups.map(b => (
                                        <div key={b.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-emerald-300 transition-colors">
                                            <div className="min-w-0 pr-3">
                                                <p className="font-semibold text-stone-900 text-sm truncate">{b.name}</p>
                                                <p className="text-[11px] text-stone-500">
                                                    Modificato: {new Date(b.modifiedTime).toLocaleString('it-IT')}
                                                </p>
                                            </div>
                                            <Button 
                                                onClick={() => handleRestoreClick(b.id)} 
                                                disabled={restoringId === b.id}
                                                className="bg-emerald-700 hover:bg-emerald-800 text-white py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                                            >
                                                {restoringId === b.id ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                                                Ripristina
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
                            <Button 
                                variant="ghost" 
                                onClick={disconnect} 
                                className="text-red-600 hover:bg-red-50 text-xs py-2 px-3 font-semibold flex items-center gap-1.5"
                            >
                                <Unlink size={14} /> Scollega Google Drive
                            </Button>
                            <Button variant="secondary" onClick={onClose} className="py-2 px-5 text-sm font-semibold">
                                Chiudi
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {conflictModal && (
                <Modal title="Conflitto Archivio Esistente" onClose={() => setConflictModal(null)} className="max-w-md">
                    <div className="space-y-6 text-stone-900 text-base py-2">
                        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200">
                            <AlertTriangle size={24} className="shrink-0" />
                            <p className="text-sm">Esiste già un archivio locale con lo stesso ID. Come desideri procedere?</p>
                        </div>
                        <div className="space-y-3">
                            <Button onClick={handleReplace} className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold text-sm">
                                Sostituisci esistente
                            </Button>
                            <Button onClick={handleCopy} variant="secondary" className="w-full py-2.5 font-semibold text-sm">
                                Importa come copia
                            </Button>
                            <Button onClick={() => setConflictModal(null)} variant="ghost" className="w-full py-2 text-xs font-medium">
                                Annulla
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
}
