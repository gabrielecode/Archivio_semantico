import { useState } from 'react';
import { Button, inputCls } from './ui';
import { Leaf, ArrowLeft } from 'lucide-react';

export function RegisterForm({ onBackToLogin, onSuccess }: { onBackToLogin: () => void; onSuccess: (u: any) => void }) {
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Le password non coincidono.');
            return;
        }
        if (password.length < 8) {
            setError('La password deve essere di almeno 8 caratteri.');
            return;
        }
        if (/^\d+$/.test(password)) {
            setError('La password non può contenere solo numeri.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name, email, password, inviteCode })
            });
            const data = await res.json();
            if (res.ok) {
                onSuccess(data.user);
            } else {
                setError(data.error || 'Errore durante la registrazione');
            }
        } catch {
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md text-stone-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <Leaf size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-serif font-semibold text-stone-900">Registrazione</h2>
                    <p className="text-stone-600 text-base">Crea un nuovo account</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">ID utente (es. nome.cognome)</label>
                    <input type="text" value={id} onChange={e => setId(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="3-64 caratteri alfanumerici" />
                </div>
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">Nome visualizzato</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Il tuo nome" />
                </div>
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="tua@email.it" />
                </div>
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">Password</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Minimo 8 caratteri" />
                </div>
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">Conferma password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Ripeti password" />
                </div>
                <div>
                    <label className="block text-base font-semibold text-stone-800 mb-1">Codice d'invito</label>
                    <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Codice segreto" />
                </div>
                {error && <p className="text-red-600 text-base p-3 bg-red-50 rounded-xl">{error}</p>}
                <Button type="submit" loading={loading} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                    Registrati
                </Button>
                <div className="text-center pt-2">
                    <button type="button" onClick={onBackToLogin} className="text-emerald-700 hover:underline text-base font-medium flex items-center justify-center gap-1 mx-auto">
                        <ArrowLeft size={16} /> Torna al Login
                    </button>
                </div>
            </form>
        </div>
    );
}

export function ForgotForm({ onBackToLogin, mailActive }: { onBackToLogin: () => void; mailActive: boolean }) {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!mailActive) {
        return (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md text-stone-900 text-center space-y-4">
                <h2 className="text-2xl font-serif font-semibold text-stone-900">Recupero Password</h2>
                <p className="text-stone-700 text-lg">Il recupero via email non è attivo in questo momento.</p>
                <p className="text-stone-600 text-base font-medium">Contatta l'amministratore per reimpostare le tue credenziali.</p>
                <Button onClick={onBackToLogin} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                    Torna al Login
                </Button>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await fetch('/api/forgot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message || "Se l'indirizzo è registrato riceverai un'email.");
            } else {
                setError(data.error || 'Errore durante la richiesta');
            }
        } catch {
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md text-stone-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <Leaf size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-serif font-semibold text-stone-900">Recupero Password</h2>
                    <p className="text-stone-600 text-base">Inserisci la tua email</p>
                </div>
            </div>
            {message ? (
                <div className="space-y-4 text-center">
                    <p className="text-emerald-800 text-lg bg-emerald-50 p-4 rounded-xl">{message}</p>
                    <Button onClick={onBackToLogin} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                        Torna al Login
                    </Button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-base font-semibold text-stone-800 mb-1">Email registrata</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="tua@email.it" autoFocus />
                    </div>
                    {error && <p className="text-red-600 text-base p-3 bg-red-50 rounded-xl">{error}</p>}
                    <Button type="submit" loading={loading} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                        Invia istruzioni
                    </Button>
                    <div className="text-center pt-2">
                        <button type="button" onClick={onBackToLogin} className="text-emerald-700 hover:underline text-base font-medium flex items-center justify-center gap-1 mx-auto">
                            <ArrowLeft size={16} /> Torna al Login
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}

export function ResetForm({ token, onBackToLogin }: { token: string; onBackToLogin: () => void }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmPassword) {
            setError('Le password non coincidono.');
            return;
        }
        if (newPassword.length < 8) {
            setError('La password deve essere di almeno 8 caratteri.');
            return;
        }
        if (/^\d+$/.test(newPassword)) {
            setError('La password non può contenere solo numeri.');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
            } else {
                setError(data.error || 'Link non valido o scaduto');
            }
        } catch {
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md text-stone-900">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <Leaf size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-serif font-semibold text-stone-900">Nuova Password</h2>
                    <p className="text-stone-600 text-base">Imposta la tua nuova password</p>
                </div>
            </div>
            {success ? (
                <div className="space-y-4 text-center">
                    <p className="text-emerald-800 text-lg bg-emerald-50 p-4 rounded-xl">Password aggiornata con successo! Ora puoi effettuare il login.</p>
                    <Button onClick={onBackToLogin} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                        Vai al Login
                    </Button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-base font-semibold text-stone-800 mb-1">Nuova password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Minimo 8 caratteri" autoFocus />
                        <p className="text-sm text-stone-500 mt-1">Minimo 8 caratteri, non solo numeri.</p>
                    </div>
                    <div>
                        <label className="block text-base font-semibold text-stone-800 mb-1">Conferma nuova password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls + ' text-lg py-3'} required placeholder="Ripeti password" />
                    </div>
                    {error && <p className="text-red-600 text-base p-3 bg-red-50 rounded-xl">{error}</p>}
                    <Button type="submit" loading={loading} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                        Aggiorna password
                    </Button>
                </form>
            )}
        </div>
    );
}
