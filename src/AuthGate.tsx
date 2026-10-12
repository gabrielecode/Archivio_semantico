import { useState, useEffect } from 'react';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    sendPasswordResetEmail, 
    signOut, 
    User 
} from 'firebase/auth';
import { auth, googleProvider } from './lib/firebase';
import { Button } from './components/ui';
import { RefreshCw, LogOut } from 'lucide-react';
import App from './App';

export default function AuthGate() {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setFirebaseUser(user);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    const translateFirebaseError = (err: any) => {
        const code = err?.code || '';
        if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
            return 'Credenziali non valide';
        }
        if (code.includes('email-already-in-use')) {
            return 'Email già registrata';
        }
        if (code.includes('weak-password')) {
            return 'La password deve essere di almeno 8 caratteri';
        }
        if (code.includes('invalid-email')) {
            return 'Indirizzo email non valido';
        }
        if (code.includes('too-many-requests')) {
            return 'Troppi tentativi falliti, riprova più tardi';
        }
        return 'Errore durante l\'autenticazione, riprova';
    };

    const handleGoogleLogin = async () => {
        setErrorMsg(null);
        setSubmitting(true);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (e: any) {
            setErrorMsg(translateFirebaseError(e));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (e: any) {
            setErrorMsg(translateFirebaseError(e));
        } finally {
            setSubmitting(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        if (password.length < 8) {
            setErrorMsg('La password deve essere di almeno 8 caratteri');
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg('Le password non coincidono');
            return;
        }
        setSubmitting(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);
            setInfoMsg('Account creato. Ti abbiamo inviato un\'email di verifica.');
            setMode('login');
        } catch (e: any) {
            setErrorMsg(translateFirebaseError(e));
        } finally {
            setSubmitting(false);
        }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSubmitting(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setInfoMsg('Se l\'indirizzo è registrato riceverai un\'email');
            setMode('login');
        } catch (e: any) {
            setInfoMsg('Se l\'indirizzo è registrato riceverai un\'email');
            setMode('login');
        } finally {
            setSubmitting(false);
        }
    };

    const handleResendVerification = async () => {
        if (!firebaseUser) return;
        setSubmitting(true);
        try {
            await sendEmailVerification(firebaseUser);
            setInfoMsg('Email di verifica inviata nuovamente.');
        } catch (e: any) {
            setErrorMsg('Impossibile inviare l\'email di verifica, riprova più tardi.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!firebaseUser) return;
        setSubmitting(true);
        try {
            await firebaseUser.reload();
            setFirebaseUser({ ...auth.currentUser! });
        } catch (e: any) {
            // ignore
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <RefreshCw className="animate-spin text-emerald-700" size={32} />
            </div>
        );
    }

    const isGoogleUser = firebaseUser?.providerData.some(p => p.providerId === 'google.com');
    if (firebaseUser && !isGoogleUser && !firebaseUser.emailVerified) {
        return (
            <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6 text-stone-900 text-base">
                    <h1 className="text-2xl font-serif font-bold text-center text-stone-900">Controlla la tua email</h1>
                    <p className="text-stone-700 text-base text-center">
                        Abbiamo inviato un link di verifica a <span className="font-semibold">{firebaseUser.email}</span>. Clicca sul link per attivare il tuo account.
                    </p>
                    {infoMsg && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{infoMsg}</div>}
                    {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}
                    <div className="space-y-3">
                        <Button className="w-full py-3 text-base" onClick={handleCheckVerification} disabled={submitting}>
                            Ho verificato
                        </Button>
                        <Button variant="secondary" className="w-full py-3 text-base" onClick={handleResendVerification} disabled={submitting}>
                            Reinvia email
                        </Button>
                        <Button variant="ghost" className="w-full py-3 text-base text-red-600" onClick={() => signOut(auth)}>
                            <LogOut size={18} className="mr-2" /> Esci
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (firebaseUser) {
        const userInfo = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || 'Utente',
            email: firebaseUser.email || undefined
        };
        return (
            <App 
                user={userInfo} 
                onLogout={() => signOut(auth)} 
            />
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6 text-stone-900 text-base">
                <h1 className="text-2xl font-serif font-bold text-center text-stone-900">
                    {mode === 'login' && 'Accedi al tuo account'}
                    {mode === 'register' && 'Crea un account'}
                    {mode === 'forgot' && 'Password dimenticata'}
                </h1>

                {infoMsg && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{infoMsg}</div>}
                {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}

                {mode === 'login' && (
                    <div className="space-y-4">
                        <Button 
                            variant="secondary" 
                            className="w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-900"
                            onClick={handleGoogleLogin}
                            disabled={submitting}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            Continua con Google
                        </Button>

                        <div className="flex items-center my-4">
                            <div className="flex-grow border-t border-stone-200"></div>
                            <span className="px-3 text-stone-500 text-sm">oppure con email</span>
                            <div className="flex-grow border-t border-stone-200"></div>
                        </div>

                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                                <input 
                                    type="email" 
                                    required 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    placeholder="nome@esempio.it"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={password} 
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                    placeholder="••••••••"
                                />
                            </div>
                            <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                                Accedi
                            </Button>
                        </form>

                        <div className="flex justify-between items-center text-sm pt-2">
                            <button onClick={() => { setMode('register'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium">
                                Crea un account
                            </button>
                            <button onClick={() => { setMode('forgot'); setErrorMsg(null); setInfoMsg(null); }} className="text-stone-600 hover:underline">
                                Password dimenticata?
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                            <input 
                                type="email" 
                                required 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                placeholder="nome@esempio.it"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Password (minimo 8 caratteri)</label>
                            <input 
                                type="password" 
                                required 
                                minLength={8}
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Conferma password</label>
                            <input 
                                type="password" 
                                required 
                                minLength={8}
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                placeholder="••••••••"
                            />
                        </div>
                        <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                            Registrati
                        </Button>
                        <div className="text-center pt-2">
                            <button type="button" onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium text-sm">
                                Hai già un account? Accedi
                            </button>
                        </div>
                    </form>
                )}

                {mode === 'forgot' && (
                    <form onSubmit={handleForgot} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-1">Email registrata</label>
                            <input 
                                type="email" 
                                required 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                placeholder="nome@esempio.it"
                            />
                        </div>
                        <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                            Invia istruzioni
                        </Button>
                        <div className="text-center pt-2">
                            <button type="button" onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium text-sm">
                                Torna al login
                            </button>
                        </div>
                    </form>
                )}
            </div>

            <div className="max-w-md w-full mt-6 p-4 bg-stone-200/60 rounded-xl text-stone-700 text-xs leading-relaxed text-center">
                I tuoi archivi restano salvati solo nel tuo browser. Quando cerchi o generi gli embedding, i testi vengono inviati a Google Gemini per il calcolo e non vengono salvati sul nostro server. L'amministratore gestisce solo gli account (email e nome) e non può vedere i tuoi dati. Esporta spesso un backup JSON: se cambi dispositivo o browser, importalo.
            </div>
        </div>
    );
}
