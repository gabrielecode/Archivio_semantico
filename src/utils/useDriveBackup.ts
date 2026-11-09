import {useState, useEffect, useCallback, useRef} from 'react';
import {Store} from './store';
import {connect, revoke, findArchiveFile, saveArchiveFile} from './drive';
import {Archive} from '../types';

interface DriveConfig {
    connected: boolean;
    includeEmbeddings: boolean;
    last: Record<string, {hash: string, at: string}>;
    consecutiveErrors: number;
    suspended: boolean;
}

async function sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useDriveBackup(userId: string, userEmail?: string, store: Store | null = null) {
    const storageKey = `tcm_drive_${userId}`;
    const [config, setConfig] = useState<DriveConfig>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) {}
        return {connected: false, includeEmbeddings: false, last: {}, consecutiveErrors: 0, suspended: false};
    });
    const [backingUp, setBackingUp] = useState(false);
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                const times = Object.values(parsed.last || {}).map((x: any) => new Date(x.at).getTime());
                if (times.length > 0) return new Date(Math.max(...times)).toISOString();
            }
        } catch (e) {}
        return null;
    });

    const storeRef = useRef(store);
    storeRef.current = store;
    const configRef = useRef(config);
    configRef.current = config;

    const saveConfig = (next: DriveConfig) => {
        setConfig(next);
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (e) {}
    };

    const handleConnect = async (): Promise<{success: boolean, error?: string}> => {
        try {
            await connect(userEmail);
            const next = {...configRef.current, connected: true, suspended: false, consecutiveErrors: 0};
            saveConfig(next);
            await backupNow(true);
            return {success: true};
        } catch (e: any) {
            console.error('Drive connection error:', e);
            const isClosed = e.message === 'popup_closed_by_user';
            const isReconnect = e.message === 'DRIVE_RECONNECT';
            saveConfig({
                ...configRef.current, 
                connected: false, 
                suspended: isReconnect && !isClosed
            });
            if (isClosed) {
                return {success: false, error: 'Accesso annullato dall\'utente.'};
            }
            return {success: false, error: e.message || 'Errore durante la connessione a Google Drive'};
        }
    };

    const handleDisconnect = () => {
        revoke();
        saveConfig({connected: false, includeEmbeddings: false, last: {}, consecutiveErrors: 0, suspended: false});
        setLastBackupTime(null);
    };

    const setIncludeEmbeddings = (val: boolean) => {
        saveConfig({...configRef.current, includeEmbeddings: val});
    };

    const backupNow = useCallback(async (manual = false): Promise<{success: boolean, count?: number, error?: string}> => {
        if (!configRef.current.connected) {
            return {success: false, error: 'Google Drive non è ancora collegato.'};
        }
        if (!manual && configRef.current.suspended) {
            return {success: false, error: 'Sincronizzazione sospesa per errori precedenti. Riconnetti Drive.'};
        }
        if (!storeRef.current) {
            return {success: false, error: 'Archivio locale non pronto.'};
        }
        if (backingUp) {
            return {success: false, error: 'Salvataggio già in corso.'};
        }

        setBackingUp(true);
        try {
            const list = await storeRef.current.list();
            const updatedLast = {...configRef.current.last};
            let count = 0;
            let latestTime = lastBackupTime;

            for (const item of list) {
                const arch = await storeRef.current.get(item.id);
                if (!arch) continue;

                const copy = configRef.current.includeEmbeddings ? arch : {
                    ...arch,
                    records: (arch.records || []).map(r => ({...r, chunks: []}))
                };
                const jsonStr = JSON.stringify(copy, null, 2);
                const hash = await sha256(jsonStr);

                // If not manual, skip unchanged archives
                if (!manual && updatedLast[item.id]?.hash === hash) continue;

                const existing = await findArchiveFile(item.id, arch.nome);
                const fileId = await saveArchiveFile(item.id, arch.nome, jsonStr, existing?.id);
                const at = new Date().toISOString();
                updatedLast[item.id] = {hash, at};
                latestTime = at;
                count++;
            }

            const next = {
                ...configRef.current, 
                last: updatedLast, 
                consecutiveErrors: 0, 
                suspended: false
            };
            saveConfig(next);
            if (latestTime) setLastBackupTime(latestTime);
            localStorage.setItem('tcm_last_backup_date', new Date().toISOString());
            return {success: true, count};
        } catch (e: any) {
            console.error('Backup failure:', e);
            const errs = configRef.current.consecutiveErrors + 1;
            const suspended = errs >= 3 || e.message === 'DRIVE_RECONNECT';
            saveConfig({
                ...configRef.current, 
                consecutiveErrors: errs, 
                suspended, 
                connected: e.message === 'DRIVE_RECONNECT' ? false : configRef.current.connected
            });
            return {success: false, error: e.message || 'Errore durante il salvataggio su Google Drive'};
        } finally {
            setBackingUp(false);
        }
    }, [backingUp, lastBackupTime]);

    useEffect(() => {
        if (!config.connected || config.suspended) return;
        const interval = setInterval(() => {
            backupNow(false);
        }, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [config.connected, config.suspended, backupNow]);

    return {
        connected: config.connected,
        includeEmbeddings: config.includeEmbeddings,
        suspended: config.suspended,
        consecutiveErrors: config.consecutiveErrors,
        backingUp,
        lastBackupTime,
        connect: handleConnect,
        disconnect: handleDisconnect,
        setIncludeEmbeddings,
        backupNow
    };
}
