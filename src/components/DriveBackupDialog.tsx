import {useState, useEffect} from 'react';
import {Modal, Button} from './ui';
import {Cloud, RefreshCw, Download, Trash2, CheckCircle, AlertTriangle} from 'lucide-react';
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
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [conflictModal, setConflictModal] = useState<{archive: Archive, tcmArchiveId?: string} | null>(null);

    const loadFiles = async () => {
        if (!connected) return;
        setLoadingFiles(true);
        try {
            const files = await listBackupFiles();
            setBackups(files);
        } catch (e: any) {
            toast(e.message || 'Errore caricamento elenco backup', 'error');
        } finally {
            setLoadingFiles(false);
        }
    };

    useEffect(() => {
        if (connected) {
            loadFiles();
        }
    }, [connected]);

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
                toast('Archivio ripristinato con successo', 'success');
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
        toast('Archivio importato come copia', 'success');
        setConflictModal(null);
        onClose();
    };

    return (
        <Modal title="Backup su Google Drive" onClose={onClose} className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="space-y-6 text-stone-900 text-base py-2">
                {!connected ? (
                    <div className="space-y-6 text-center py-4">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                            <Cloud size={32} />
                        </div>
                        <p className="text-stone-700 text-lg leading-relaxed max-w-md mx-auto">
                            Collega il tuo account Google Drive per abilitare il backup automatico sicuro e privato dei tuoi archivi. Nessun dato passa dai nostri server.
                        </p>
                        <Button onClick={connect} className="py-3.5 px-8 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg">
                            Collega Google Drive
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="text-emerald-700 shrink-0" size={24} />
                                <div>
                                    <p className="font-semibold text-emerald-900 text-lg">Google Drive collegato</p>
                                    <p className="text-emerald-700 text-sm">
                                        Ultimo backup: {lastBackupTime ? new Date(lastBackupTime).toLocaleString('it-IT') : 'Mai eseguito'}
                                    </p>
                                </div>
                            </div>
                            <Button onClick={backupNow} disabled={backingUp} className="py-2.5 px-5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold flex items-center gap-2">
                                {backingUp ? <RefreshCw className="animate-spin" size={18} /> : null}
                                Salva ora
                            </Button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
                            <div>
                                <label className="font-semibold text-stone-900 text-base block cursor-pointer">
                                    Includi gli embedding
                                </label>
                                <p className="text-stone-600 text-sm">I file di backup saranno più grandi ma preserveranno l indice semantico.</p>
                            </div>
                            <input 
                                type="checkbox" 
                                checked={includeEmbeddings} 
                                onChange={e => setIncludeEmbeddings(e.target.checked)}
                                className="w-6 h-6 accent-emerald-700 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-serif font-bold text-xl text-stone-900">Ripristina da Drive</h3>
                                <Button variant="secondary" onClick={loadFiles} disabled={loadingFiles} className="text-sm">
                                    {loadingFiles ? <RefreshCw className="animate-spin" size={14} /> : 'Aggiorna elenco'}
                                </Button>
                            </div>

                            {backups.length === 0 ? (
                                <p className="text-stone-600 italic py-4 text-center">Nessun backup trovato su Google Drive.</p>
                            ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                    {backups.map(b => (
                                        <div key={b.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                                            <div>
                                                <p className="font-semibold text-stone-900">{b.name}</p>
                                                <p className="text-xs text-stone-500">Modificato: {new Date(b.modifiedTime).toLocaleString('it-IT')}</p>
                                            </div>
                                            <Button 
                                                onClick={() => handleRestoreClick(b.id)} 
                                                disabled={restoringId === b.id}
                                                className="bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-4 text-sm font-semibold flex items-center gap-1.5"
                                            >
                                                {restoringId === b.id ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                                                Ripristina
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-stone-200 flex justify-between items-center">
                            <Button variant="ghost" onClick={disconnect} className="text-red-600 hover:bg-red-50 py-2 px-4 font-semibold">
                                Scollega Google Drive
                            </Button>
                            <Button variant="secondary" onClick={onClose} className="py-2.5 px-6 font-semibold">
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
                            <p>Esiste già un archivio locale con lo stesso ID. Come desideri procedere?</p>
                        </div>
                        <div className="space-y-3">
                            <Button onClick={handleReplace} className="w-full py-3 bg-amber-700 hover:bg-amber-800 text-white font-semibold">
                                Sostituisci esistente
                            </Button>
                            <Button onClick={handleCopy} variant="secondary" className="w-full py-3 font-semibold">
                                Importa come copia
                            </Button>
                            <Button onClick={() => setConflictModal(null)} variant="ghost" className="w-full py-2 font-medium">
                                Annulla
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
}
