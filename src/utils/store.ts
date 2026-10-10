import {Archive} from '../types';

const TAB_ID = crypto.randomUUID();

export type Store = {
    list: () => Promise<{id: string, nome: string, modificato: string, count: number}[]>;
    get: (id: string) => Promise<Archive | null>;
    put: (id: string, archive: Archive) => Promise<void>;
    remove: (id: string) => Promise<void>;
    getLast: () => Promise<string | null>;
    setLast: (id: string) => Promise<void>;
    close: () => void;
};

export const openStore = async (userId: string): Promise<Store> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(`tcm:${userId}`, 1);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            db.createObjectStore('archives', {keyPath: 'id'});
            db.createObjectStore('index', {keyPath: 'id'});
            db.createObjectStore('meta', {keyPath: 'k'});
        };
        request.onerror = () => reject(new Error('Archivio locale non disponibile in questo browser (navigazione privata?)'));
        request.onsuccess = (e: any) => {
            const db = e.target.result;
            const channel = new BroadcastChannel(`tcm:${userId}`);
            
            const store: Store = {
                list: () => new Promise(res => {
                    const req = db.transaction('index', 'readonly').objectStore('index').getAll();
                    req.onsuccess = () => res((req.result as any[]).sort((a, b) => new Date(b.modificato).getTime() - new Date(a.modificato).getTime()));
                }),
                get: (id: string) => new Promise(res => {
                    const req = db.transaction('archives', 'readonly').objectStore('archives').get(id);
                    req.onsuccess = () => res(req.result ? req.result.data : null);
                }),
                put: (id: string, archive: Archive) => new Promise((res, rej) => {
                    const tx = db.transaction(['archives', 'index'], 'readwrite');
                    tx.objectStore('archives').put({id, data: archive});
                    tx.objectStore('index').put({id, nome: archive.nome, modificato: archive.modificato, count: archive.records.length});
                    tx.oncomplete = () => {
                        channel.postMessage({id, modificato: archive.modificato, tab: TAB_ID});
                        res();
                    };
                    tx.onerror = (e: any) => {
                        if (e.target.error?.name === 'QuotaExceededError') rej(new Error('Spazio del browser esaurito: esporta un backup JSON e libera spazio'));
                        else rej(e.target.error);
                    };
                }),
                remove: (id: string) => new Promise(res => {
                    const tx = db.transaction(['archives', 'index'], 'readwrite');
                    tx.objectStore('archives').delete(id);
                    tx.objectStore('index').delete(id);
                    tx.oncomplete = () => res();
                }),
                getLast: () => new Promise(res => {
                    const req = db.transaction('meta', 'readonly').objectStore('meta').get('last');
                    req.onsuccess = () => res(req.result ? req.result.v : null);
                }),
                setLast: (id: string) => new Promise(res => {
                    const req = db.transaction('meta', 'readwrite').objectStore('meta').put({k: 'last', v: id});
                    req.onsuccess = () => res();
                }),
                close: () => db.close()
            };
            resolve(store);
        };
    });
};

export const deleteUserDb = (userId: string) => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(`tcm:${userId}`);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
});

export const subscribe = (userId: string, cb: (msg: any) => void) => {
    const channel = new BroadcastChannel(`tcm:${userId}`);
    channel.onmessage = (e) => { if (e.data.tab !== TAB_ID) cb(e.data); };
    return () => channel.close();
};

export const storageInfo = async () => {
    if (!navigator.storage?.estimate) return null;
    if (navigator.storage.persist) await navigator.storage.persist();
    return await navigator.storage.estimate();
};
