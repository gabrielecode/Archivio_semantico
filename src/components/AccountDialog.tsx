import { useState } from 'react';
import { Button } from './ui';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface AccountDialogProps {
    user: { id: string; name: string; email?: string; role?: string };
    onClose: () => void;
    onUpdateUser: (u: { id: string; name: string; email?: string; role?: string }) => void;
    toast: (msg: string, type: 'success' | 'error') => void;
}

export default function AccountDialog({ user, onClose, onUpdateUser, toast }: AccountDialogProps) {
    const [subTab, setSubTab] = useState<'password' | 'name' | 'email'>('password');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newName, setNewName] = useState(user.name);
    const [newEmail, setNewEmail] = useState(user.email || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (newPassword !== confirmPassword) {
            setError('Le nuove password non coincidono.');
            return;
        }
        if (newPassword.length < 8) {
            setError('La nuova password deve essere di almeno 8 caratteri.');
            return;
        }
        if (/^\d+$/.test(newPassword)) {
            setError('La password non può contenere solo numeri.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'password', currentPassword, newPassword })
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    return;
                }
                throw new Error(data.error || 'Errore durante il cambio password');
            }
            setSuccessMsg('Password aggiornata con successo.');
            toast('Password aggiornata con successo', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNameChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!newName || newName.trim().length < 3) {
            setError('Il nome deve essere di almeno 3 caratteri.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'name', name: newName.trim(), currentPassword })
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    return;
                }
                throw new Error(data.error || 'Errore durante il cambio nome');
            }
            onUpdateUser(data.user);
            setSuccessMsg('Nome utente aggiornato con successo.');
            toast('Nome utente aggiornato con successo', 'success');
            setCurrentPassword('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (!newEmail || !newEmail.includes('@')) {
            setError('Inserisci un indirizzo email valido.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'email', email: newEmail.trim(), currentPassword })
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 401) {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                    return;
                }
                throw new Error(data.error || 'Errore durante il cambio email');
            }
            onUpdateUser(data.user);
            setSuccessMsg('Email aggiornata con successo.');
            toast('Email aggiornata con successo', 'success');
            setCurrentPassword('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 text-stone-900 border border-stone-200">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                    <h2 className="text-xl font-serif font-bold text-stone-950">Il mio account</h2>
                    <Button variant="ghost" onClick={onClose} aria-label="Chiudi"><X size={20} /></Button>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
                    <button
                        type="button"
                        onClick={() => { setSubTab('password'); setError(null); setSuccessMsg(null); }}
                        className={`px-3 py-2 rounded-lg font-medium text-base transition-colors ${subTab === 'password' ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                        Password
                    </button>
                    <button
                        type="button"
                        onClick={() => { setSubTab('name'); setError(null); setSuccessMsg(null); }}
                        className={`px-3 py-2 rounded-lg font-medium text-base transition-colors ${subTab === 'name' ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                        Nome
                    </button>
                    <button
                        type="button"
                        onClick={() => { setSubTab('email'); setError(null); setSuccessMsg(null); }}
                        className={`px-3 py-2 rounded-lg font-medium text-base transition-colors ${subTab === 'email' ? 'bg-emerald-700 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                        Email
                    </button>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-base flex items-center gap-2">
                        <AlertCircle size={20} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-base flex items-center gap-2">
                        <CheckCircle size={20} className="shrink-0" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {subTab === 'password' && (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Password attuale</label>
                            <input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Inserisci la password attuale"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Nuova password</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Minimo 8 caratteri (non solo numeri)"
                            />
                            <p className="text-sm text-stone-500 mt-1">Minimo 8 caratteri, non può contenere solo numeri.</p>
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Conferma nuova password</label>
                            <input
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Ripeti la nuova password"
                            />
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
                            <Button type="submit" disabled={loading} className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-6 py-3 min-h-[44px]">
                                {loading ? 'Salvataggio...' : 'Aggiorna Password'}
                            </Button>
                        </div>
                    </form>
                )}

                {subTab === 'name' && (
                    <form onSubmit={handleNameChange} className="space-y-4">
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">ID utente (fisso)</label>
                            <input
                                type="text"
                                disabled
                                value={user.id}
                                className="w-full px-4 py-3 border border-stone-200 bg-stone-100 rounded-xl text-base text-stone-500 cursor-not-allowed"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Nuovo nome visualizzato</label>
                            <input
                                type="text"
                                required
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Nome e cognome"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Password attuale</label>
                            <input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Inserisci la password attuale"
                            />
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
                            <Button type="submit" disabled={loading} className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-6 py-3 min-h-[44px]">
                                {loading ? 'Salvataggio...' : 'Aggiorna Nome'}
                            </Button>
                        </div>
                    </form>
                )}

                {subTab === 'email' && (
                    <form onSubmit={handleEmailChange} className="space-y-4">
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Nuova email</label>
                            <input
                                type="email"
                                required
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="tua@email.it"
                            />
                        </div>
                        <div>
                            <label className="block text-base font-semibold text-stone-800 mb-1">Password attuale</label>
                            <input
                                type="password"
                                required
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                placeholder="Inserisci la password attuale"
                            />
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <Button type="button" variant="ghost" onClick={onClose}>Annulla</Button>
                            <Button type="submit" disabled={loading} className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-6 py-3 min-h-[44px]">
                                {loading ? 'Salvataggio...' : 'Aggiorna Email'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
