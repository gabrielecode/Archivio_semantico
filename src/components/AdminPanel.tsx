import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button, EmptyState } from './ui';
import { Shield, Users, RefreshCw, ArrowLeft, Mail, Calendar, Clock } from 'lucide-react';

export function AdminPanel({ onBack }: { onBack: () => void }) {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const q = query(collection(db, 'users'), orderBy('lastLogin', 'desc'));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(list);
        } catch (e: any) {
            console.error('Error fetching users:', e);
            setError(e.message || 'Errore durante il recupero degli utenti');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="min-h-screen bg-stone-50 p-6 sm:p-12 text-stone-900">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button variant="secondary" onClick={onBack} icon={ArrowLeft}>
                            Torna all'App
                        </Button>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-xl font-semibold text-sm">
                            <Shield size={16} /> Area Riservata Admin
                        </div>
                    </div>
                    <Button onClick={fetchUsers} icon={RefreshCw} loading={loading} variant="secondary">
                        Aggiorna
                    </Button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-1">
                        <div className="text-stone-500 text-sm font-medium flex items-center gap-2">
                            <Users size={16} className="text-emerald-700" /> Utenti Registrati
                        </div>
                        <div className="text-3xl font-bold font-serif text-stone-900">{users.length}</div>
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200">
                        {error}
                    </div>
                )}

                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-stone-200 flex justify-between items-center">
                        <h3 className="font-serif font-bold text-xl text-stone-900">Lista Utenti Registrati</h3>
                        <span className="text-sm text-stone-500">{users.length} utenti</span>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-stone-500">Caricamento utenti in corso...</div>
                    ) : users.length === 0 ? (
                        <div className="p-12">
                            <EmptyState icon={Users} title="Nessun utente trovato" text="Nessun utente registrato nel database Firestore." />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-base text-left">
                                <thead className="bg-stone-100 text-stone-700 font-semibold text-sm">
                                    <tr>
                                        <th className="p-4">Utente / Nome</th>
                                        <th className="p-4">Email</th>
                                        <th className="p-4">Ultimo Accesso</th>
                                        <th className="p-4">Registrazione</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-stone-50">
                                            <td className="p-4 font-semibold text-stone-900 flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                                                    {(u.displayName || u.email || 'U')[0].toUpperCase()}
                                                </div>
                                                {u.displayName || 'Utente'}
                                            </td>
                                            <td className="p-4 text-stone-700 flex items-center gap-1.5">
                                                <Mail size={14} className="text-stone-400" /> {u.email}
                                            </td>
                                            <td className="p-4 text-stone-600 text-sm flex items-center gap-1.5">
                                                <Clock size={14} className="text-stone-400" /> {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : '-'}
                                            </td>
                                            <td className="p-4 text-stone-600 text-sm flex items-center gap-1.5">
                                                <Calendar size={14} className="text-stone-400" /> {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
