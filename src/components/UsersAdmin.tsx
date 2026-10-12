import { useState, useEffect } from 'react';
import { Button } from './ui';
import { Users, X, Plus, Key, Edit, Shield, Trash2, CheckCircle, AlertCircle, RefreshCw, Mail } from 'lucide-react';

interface UsersAdminProps {
    currentUserId: string;
    onClose: () => void;
    toast: (msg: string, type: 'success' | 'error') => void;
}

interface UserItem {
    id: string;
    name: string;
    email?: string;
    role: 'admin' | 'user';
    source: 'env' | 'kv';
    created: string;
}

export default function UsersAdmin({ currentUserId, onClose, toast }: UsersAdminProps) {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [serviceUnavailable, setServiceUnavailable] = useState(false);

    // Modal states for create/edit/reset
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newId, setNewId] = useState('');
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<'admin' | 'user'>('user');

    // Password view modal (for generated/reset password display once)
    const [generatedPasswordModal, setGeneratedPasswordModal] = useState<{ id: string; password: string } | null>(null);

    // Rename modal
    const [renameUserItem, setRenameUserItem] = useState<UserItem | null>(null);
    const [renameVal, setRenameVal] = useState('');

    // Email edit modal
    const [emailUserItem, setEmailUserItem] = useState<UserItem | null>(null);
    const [emailVal, setEmailVal] = useState('');

    // Confirm delete state
    const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        setServiceUnavailable(false);
        try {
            const res = await fetch('/api/users');
            if (res.status === 503) {
                const data = await res.json().catch(() => ({}));
                setServiceUnavailable(true);
                setError(data.error || 'Per modificare gli accessi serve il database (Upstash Redis) collegato a Vercel');
                return;
            }
            if (res.status === 401) {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                return;
            }
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Errore nel caricamento utenti');
            }
            const data = await res.json();
            setUsers(data.users || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$*!';
        let pass = '';
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pass;
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: newId.trim(),
                    name: newName.trim(),
                    email: newEmail.trim() || undefined,
                    password: newPassword,
                    role: newRole
                })
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 503) {
                    setServiceUnavailable(true);
                    throw new Error(data.error || 'Database non configurato');
                }
                throw new Error(data.error || 'Errore nella creazione utente');
            }
            setGeneratedPasswordModal({ id: data.user.id, password: newPassword });
            setShowCreateModal(false);
            setNewId('');
            setNewName('');
            setNewEmail('');
            setNewPassword('');
            setNewRole('user');
            toast('Utente creato con successo', 'success');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleResetPassword = async (userId: string) => {
        const pass = generateRandomPassword();
        if (!window.confirm(`Vuoi reimpostare la password per l'utente "${userId}"?`)) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, action: 'reset-password', newPassword: pass })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore reset password');
            setGeneratedPasswordModal({ id: userId, password: pass });
            toast('Password reimpostata con successo', 'success');
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleToggleRole = async (u: UserItem) => {
        const nextRole = u.role === 'admin' ? 'user' : 'admin';
        if (!window.confirm(`Vuoi cambiare il ruolo di "${u.name}" in ${nextRole === 'admin' ? 'Amministratore' : 'Utente'}?`)) return;

        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: u.id, action: 'role', role: nextRole })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore cambio ruolo');
            toast('Ruolo aggiornato', 'success');
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameUserItem) return;
        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: renameUserItem.id, action: 'rename', name: renameVal.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore rinomina');
            setRenameUserItem(null);
            toast('Utente rinominato con successo', 'success');
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailUserItem) return;
        try {
            const res = await fetch('/api/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: emailUserItem.id, action: 'email', email: emailVal.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore modifica email');
            setEmailUserItem(null);
            toast('Email aggiornata con successo', 'success');
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteUser = async (u: UserItem) => {
        try {
            const res = await fetch('/api/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: u.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Errore eliminazione');
            setDeleteTarget(null);
            toast('Utente eliminato', 'success');
            fetchUsers();
        } catch (err: any) {
            alert(err.message);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-6 text-stone-900 border border-stone-200 my-8">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4">
                    <div className="flex items-center gap-3">
                        <Users className="text-emerald-700" size={28} />
                        <h2 className="text-2xl font-serif font-bold text-stone-950">Gestione Utenti (Amministratore)</h2>
                    </div>
                    <Button variant="ghost" onClick={onClose} aria-label="Chiudi"><X size={24} /></Button>
                </div>

                {serviceUnavailable && (
                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-lg space-y-2">
                        <p className="font-semibold">Database (KV) non disponibile</p>
                        <p>{error}</p>
                    </div>
                )}

                {error && !serviceUnavailable && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-lg flex items-center gap-2">
                        <AlertCircle size={24} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {!serviceUnavailable && (
                    <div className="flex justify-between items-center">
                        <p className="text-stone-600 text-base">Gestisci gli accessi, i ruoli e le credenziali degli utenti registrati.</p>
                        <Button
                            onClick={() => {
                                setNewId('');
                                setNewName('');
                                setNewPassword(generateRandomPassword());
                                setNewRole('user');
                                setShowCreateModal(true);
                            }}
                            className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-5 py-3 flex items-center gap-2"
                        >
                            <Plus size={20} />
                            <span>Nuovo Utente</span>
                        </Button>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <RefreshCw className="animate-spin text-emerald-700" size={36} />
                    </div>
                ) : !serviceUnavailable && (
                    <div className="overflow-x-auto border border-stone-200 rounded-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-100 border-b border-stone-200 text-stone-700 text-base font-semibold">
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Nome</th>
                                    <th className="p-4">Email</th>
                                    <th className="p-4">Ruolo</th>
                                    <th className="p-4">Origine</th>
                                    <th className="p-4 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 text-base">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-stone-50">
                                        <td className="p-4 font-mono font-medium text-stone-900">{u.id}</td>
                                        <td className="p-4 text-stone-900">{u.name}</td>
                                        <td className="p-4 text-stone-700">{u.email || '-'}</td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-stone-100 text-stone-700'}`}>
                                                {u.role === 'admin' ? <Shield size={14} /> : null}
                                                {u.role === 'admin' ? 'Amministratore' : 'Utente'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-stone-500 uppercase text-sm font-semibold">{u.source}</td>
                                        <td className="p-4 text-right space-x-2 whitespace-nowrap">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => { setRenameUserItem(u); setRenameVal(u.name); }}
                                                title="Rinomina"
                                            >
                                                <Edit size={16} /> Rinomina
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => { setEmailUserItem(u); setEmailVal(u.email || ''); }}
                                                title="Modifica email"
                                            >
                                                <Mail size={16} /> Email
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleResetPassword(u.id)}
                                                title="Reimposta password"
                                            >
                                                <Key size={16} /> Password
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleToggleRole(u)}
                                                title="Cambia ruolo"
                                            >
                                                <Shield size={16} /> Ruolo
                                            </Button>
                                            {u.id !== currentUserId && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                                    onClick={() => setDeleteTarget(u)}
                                                    title="Elimina utente"
                                                >
                                                    <Trash2 size={16} /> Elimina
                                                </Button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Modal: Create User */}
                {showCreateModal && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                            <h3 className="text-xl font-serif font-bold text-stone-900">Crea Nuovo Utente</h3>
                            <form onSubmit={handleCreateUser} className="space-y-4">
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">ID (login, es. mario.rossi)</label>
                                    <input
                                        type="text"
                                        required
                                        pattern="^[a-z0-9._@-]{3,64}$"
                                        value={newId}
                                        onChange={e => setNewId(e.target.value.toLowerCase())}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none font-mono"
                                        placeholder="3-64 caratteri alfanumerici"
                                    />
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Nome completo</label>
                                    <input
                                        type="text"
                                        required
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                        placeholder="Mario Rossi"
                                    />
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Email (opzionale)</label>
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                        placeholder="mario@esempio.it"
                                    />
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Password temporanea</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base font-mono focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                        />
                                        <Button type="button" variant="ghost" onClick={() => setNewPassword(generateRandomPassword())}>Genera</Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Ruolo</label>
                                    <select
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value as any)}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none bg-white"
                                    >
                                        <option value="user">Utente standard</option>
                                        <option value="admin">Amministratore</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)}>Annulla</Button>
                                    <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-5 py-3">Crea Utente</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Rename User */}
                {renameUserItem && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                            <h3 className="text-xl font-serif font-bold text-stone-900">Rinomina Utente ({renameUserItem.id})</h3>
                            <form onSubmit={handleRenameSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Nuovo nome</label>
                                    <input
                                        type="text"
                                        required
                                        value={renameVal}
                                        onChange={e => setRenameVal(e.target.value)}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setRenameUserItem(null)}>Annulla</Button>
                                    <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-5 py-3">Salva</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Edit Email */}
                {emailUserItem && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                            <h3 className="text-xl font-serif font-bold text-stone-900">Modifica Email ({emailUserItem.id})</h3>
                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-base font-semibold text-stone-800 mb-1">Nuova email</label>
                                    <input
                                        type="email"
                                        required
                                        value={emailVal}
                                        onChange={e => setEmailVal(e.target.value)}
                                        className="w-full px-4 py-3 border border-stone-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                                        placeholder="mario@esempio.it"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="button" variant="ghost" onClick={() => setEmailUserItem(null)}>Annulla</Button>
                                    <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800 text-base px-5 py-3">Salva Email</Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Modal: Display Generated Password Once */}
                {generatedPasswordModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-70 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 text-center">
                            <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700">
                                <Key size={24} />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-stone-900">Password Generata</h3>
                            <p className="text-stone-600 text-base">
                                Annotala o comunicala all'utente <strong className="font-mono text-stone-900">{generatedPasswordModal.id}</strong>. Per sicurezza, non sarà più possibile visualizzarla.
                            </p>
                            <div className="flex gap-2 items-center">
                                <div className="p-4 bg-stone-100 rounded-xl border border-stone-300 select-all font-mono text-xl font-bold text-stone-900 tracking-wider flex-1 text-center">
                                    {generatedPasswordModal.password}
                                </div>
                                <Button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedPasswordModal.password);
                                        toast('Password copiata negli appunti', 'success');
                                    }}
                                    className="bg-emerald-700 text-white hover:bg-emerald-800 px-5 py-3 text-base h-full"
                                >
                                    Copia
                                </Button>
                            </div>
                            <Button
                                onClick={() => setGeneratedPasswordModal(null)}
                                className="w-full bg-emerald-700 text-white hover:bg-emerald-800 text-base py-3"
                            >
                                Ho annotato la password
                            </Button>
                        </div>
                    </div>
                )}

                {/* Confirm Delete Modal */}
                {deleteTarget && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                            <h3 className="text-xl font-serif font-bold text-red-600">Conferma Eliminazione</h3>
                            <p className="text-stone-700 text-base">
                                Sei sicuro di voler eliminare l'utente <strong className="font-mono text-stone-900">{deleteTarget.name}</strong> ({deleteTarget.id})? Questa azione è irreversibile.
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Annulla</Button>
                                <Button
                                    className="bg-red-600 text-white hover:bg-red-700 text-base px-5 py-3"
                                    onClick={() => handleDeleteUser(deleteTarget)}
                                >
                                    Elimina definitivamente
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
