import {GOOGLE_CLIENT_ID} from '../lib/google';
import {auth, googleDriveProvider} from '../lib/firebase';
import {signInWithPopup, GoogleAuthProvider} from 'firebase/auth';

let tokenClient: any = null;
let currentAccessToken: string | null = null;
let tokenExpiresAt = 0;

export function setAccessToken(token: string, expiresInSeconds = 3600) {
    currentAccessToken = token;
    tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
}

export function getStoredAccessToken(): string | null {
    if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
        return currentAccessToken;
    }
    return null;
}

function loadGsiScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.accounts?.oauth2) {
            resolve();
            return;
        }
        const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Impossibile caricare Google Identity Services')));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Impossibile caricare Google Identity Services'));
        document.head.appendChild(script);
    });
}

export async function connect(loginHint?: string): Promise<string> {
    if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
        return currentAccessToken;
    }

    // Try Google Identity Services (GSI)
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'INCOLLA_QUI_IL_CLIENT_ID') {
        try {
            await loadGsiScript();
            const token = await new Promise<string>((resolve, reject) => {
                try {
                    tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                        client_id: GOOGLE_CLIENT_ID,
                        scope: 'https://www.googleapis.com/auth/drive.file',
                        login_hint: loginHint || undefined,
                        callback: (resp: any) => {
                            if (resp.error) {
                                console.warn('GSI callback error:', resp);
                                reject(new Error(resp.error_description || resp.error || 'DRIVE_RECONNECT'));
                                return;
                            }
                            if (!resp.access_token) {
                                reject(new Error('Nessun token di accesso ricevuto da Google'));
                                return;
                            }
                            currentAccessToken = resp.access_token;
                            tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600 * 1000);
                            resolve(resp.access_token);
                        }
                    });
                    tokenClient.requestAccessToken({prompt: 'consent'});
                } catch (e: any) {
                    reject(e);
                }
            });
            return token;
        } catch (gsiErr: any) {
            console.warn('GSI connection failed, trying Firebase Auth fallback:', gsiErr);
            if (gsiErr.message === 'popup_closed_by_user' || gsiErr.message === 'access_denied') {
                throw gsiErr;
            }
        }
    }

    // Fallback: Firebase Auth with Google Drive scope
    try {
        const result = await signInWithPopup(auth, googleDriveProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
            currentAccessToken = credential.accessToken;
            tokenExpiresAt = Date.now() + 3600 * 1000;
            return credential.accessToken;
        }
        throw new Error('Impossibile ottenere il token di accesso tramite Firebase');
    } catch (fbErr: any) {
        console.error('Firebase Auth connect error:', fbErr);
        throw fbErr;
    }
}

export async function getToken(): Promise<string> {
    if (currentAccessToken && Date.now() < tokenExpiresAt - 60000) {
        return currentAccessToken;
    }

    // Attempt silent refresh if tokenClient is initialized
    if (tokenClient) {
        try {
            const token = await new Promise<string>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('DRIVE_RECONNECT')), 8000);
                tokenClient.callback = (resp: any) => {
                    clearTimeout(timeout);
                    if (resp.error || !resp.access_token) {
                        reject(new Error('DRIVE_RECONNECT'));
                        return;
                    }
                    currentAccessToken = resp.access_token;
                    tokenExpiresAt = Date.now() + (resp.expires_in ? resp.expires_in * 1000 : 3600 * 1000);
                    resolve(resp.access_token);
                };
                try {
                    tokenClient.requestAccessToken({prompt: ''});
                } catch (e) {
                    clearTimeout(timeout);
                    reject(new Error('DRIVE_RECONNECT'));
                }
            });
            return token;
        } catch (e) {
            // silent refresh failed, proceed to full connect
        }
    }

    return await connect();
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
    } catch (e: any) {
        throw new Error(e.message || 'DRIVE_RECONNECT');
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
            throw new Error('Permessi Google Drive insufficienti. Ricollega il tuo account.');
        }
    }
    if (!res.ok) {
        let errText = '';
        try {
            const errJson = await res.json();
            errText = errJson.error?.message || JSON.stringify(errJson);
        } catch (e) {
            errText = await res.text().catch(() => '');
        }
        throw new Error(`Errore Drive (${res.status}): ${errText}`);
    }
    return res;
}

export async function findArchiveFile(archiveId: string, archiveName?: string): Promise<{id: string, name: string, modifiedTime: string} | null> {
    const escapedId = archiveId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q1 = encodeURIComponent(`appProperties has { key='tcmArchiveId' and value='${escapedId}' } and trashed=false`);
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q1}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
    const data = await res.json();
    if (data.files && data.files.length > 0) {
        return data.files[0];
    }
    if (archiveName) {
        const targetName = `Archivio Semantico - ${archiveName}.json`.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const q2 = encodeURIComponent(`name = '${targetName}' and trashed=false`);
        const res2 = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q2}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`);
        const data2 = await res2.json();
        if (data2.files && data2.files.length > 0) {
            return data2.files[0];
        }
    }
    return null;
}

export async function saveArchiveFile(archiveId: string, archiveName: string, jsonContent: string, existingFileId?: string): Promise<string> {
    const fileName = `Archivio Semantico - ${archiveName}.json`;
    const metadata = {
        name: fileName,
        mimeType: 'application/json',
        appProperties: {
            app: 'archivio-semantico',
            tcmArchiveId: archiveId
        }
    };

    const boundary = '-------tcm_drive_' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = new Blob([
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        jsonContent,
        closeDelimiter
    ], { type: `multipart/related; boundary=${boundary}` });

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (existingFileId) {
        url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
        method = 'PATCH';
    }

    try {
        const res = await apiFetch(url, {
            method,
            headers: {
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });
        const data = await res.json();
        return data.id;
    } catch (err: any) {
        // If file was deleted or not found, fall back to creating a new one
        if (existingFileId && (err.message?.includes('404') || err.message?.includes('notFound'))) {
            console.warn(`File ${existingFileId} non trovato su Drive, ricreo come nuovo file`);
            return saveArchiveFile(archiveId, archiveName, jsonContent, undefined);
        }
        throw err;
    }
}

export async function listBackupFiles(): Promise<{id: string, name: string, modifiedTime: string, tcmArchiveId?: string}[]> {
    const q = encodeURIComponent(`(appProperties has { key='app' and value='archivio-semantico' } or name contains 'Archivio Semantico') and trashed=false`);
    const res = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,appProperties)&orderBy=modifiedTime desc&pageSize=100`);
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
