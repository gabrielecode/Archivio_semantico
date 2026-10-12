import {GOOGLE_CLIENT_ID} from '../lib/google';

let tokenClient: any = null;
let currentAccessToken: string | null = null;
let tokenExpiresAt = 0;

function loadGsiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('DRIVE_RECONNECT'));
        document.head.appendChild(script);
    });
}

export async function connect(loginHint?: string): Promise<string> {
    await loadGsiScript();
    return new Promise((resolve, reject) => {
        try {
            tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/drive.file',
                login_hint: loginHint || undefined,
                callback: (resp: any) => {
                    if (resp.error) {
                        reject(new Error('DRIVE_RECONNECT'));
                        return;
                    }
                    currentAccessToken = resp.access_token;
                    tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600 * 1000);
                    resolve(resp.access_token);
                }
            });
            tokenClient.requestAccessToken({prompt: 'consent'});
        } catch (e) {
            reject(new Error('DRIVE_RECONNECT'));
        }
    });
}

export async function getToken(): Promise<string> {
    if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
        return currentAccessToken;
    }
    await loadGsiScript();
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            try {
                tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: (resp: any) => {
                        if (resp.error) {
                            reject(new Error('DRIVE_RECONNECT'));
                            return;
                        }
                        currentAccessToken = resp.access_token;
                        tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600 * 1000);
                        resolve(resp.access_token);
                    }
                });
            } catch (e) {
                reject(new Error('DRIVE_RECONNECT'));
                return;
            }
        }
        try {
            tokenClient.callback = (resp: any) => {
                if (resp.error) {
                    reject(new Error('DRIVE_RECONNECT'));
                    return;
                }
                currentAccessToken = resp.access_token;
                tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600 * 1000);
                resolve(resp.access_token);
            };
            tokenClient.requestAccessToken({prompt: ''});
        } catch (e) {
            reject(new Error('DRIVE_RECONNECT'));
        }
    });
}

export function revoke() {
    if (currentAccessToken && (window as any).google?.accounts?.oauth2) {
        try {
            (window as any).google.accounts.oauth2.revoke(currentAccessToken!, () => {});
        } catch (e) {}
    }
    currentAccessToken = null;
    tokenExpiresAt = 0;
    tokenClient = null;
}

async function apiFetch(url: string, options: RequestInit = {}, retry = true): Promise<Response> {
    let token = '';
    try {
        token = await getToken();
    } catch (e) {
        throw new Error('DRIVE_RECONNECT');
    }
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(url, {...options, headers});
    if (res.status === 401 && retry) {
        currentAccessToken = null;
        tokenExpiresAt = 0;
        return apiFetch(url, options, false);
    }
    if (res.status === 401) {
        throw new Error('DRIVE_RECONNECT');
    }
    if (res.status === 403) {
        const text = await res.text().catch(() => '');
        if (text.toLowerCase().includes('quota') || text.toLowerCase().includes('storage limit')) {
            throw new Error('Spazio su Google Drive esaurito o quota superata.');
        } else {
            throw new Error('API Google Drive non abilitata o accesso negato.');
        }
    }
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Errore Drive (${res.status}): ${errText}`);
    }
    return res;
}

export async function findArchiveFile(archiveId: string): Promise<{id: string, name: string, modifiedTime: string} | null> {
    const q = encodeURIComponent(`appProperties has { key='tcmArchiveId' and value='${archiveId}' } and trashed=false`);
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`);
    const data = await res.json();
    return data.files?.[0] || null;
}

export async function saveArchiveFile(archiveId: string, archiveName: string, jsonContent: string, existingFileId?: string): Promise<string> {
    const metadata = {
        name: `Archivio Semantico - ${archiveName}.json`,
        mimeType: 'application/json',
        appProperties: {
            app: 'archivio-semantico',
            tcmArchiveId: archiveId
        }
    };
    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
    let method = 'POST';
    if (existingFileId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`;
        method = 'PATCH';
    }
    const initRes = await apiFetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/json',
            'X-Upload-Content-Length': String(new Blob([jsonContent]).size)
        },
        body: JSON.stringify(metadata)
    });
    const location = initRes.headers.get('Location');
    if (!location) throw new Error('Impossibile avviare il caricamento su Google Drive');
    const putRes = await fetch(location, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: jsonContent
    });
    if (!putRes.ok) {
        throw new Error('Errore durante il caricamento del file su Google Drive');
    }
    const data = await putRes.json();
    return data.id;
}

export async function listBackupFiles(): Promise<{id: string, name: string, modifiedTime: string, tcmArchiveId?: string}[]> {
    const q = encodeURIComponent(`appProperties has { key='app' and value='archivio-semantico' } and trashed=false`);
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,appProperties)&orderBy=modifiedTime desc`);
    const data = await res.json();
    return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        tcmArchiveId: f.appProperties?.tcmArchiveId
    }));
}

export async function downloadBackupFile(fileId: string): Promise<any> {
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return await res.json();
}
