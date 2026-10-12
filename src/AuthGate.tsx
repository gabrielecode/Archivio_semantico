import {useState, useEffect} from 'react';
import {RefreshCw} from 'lucide-react';
import {LoginScreen} from './components/LoginScreen';
import {RegisterForm, ForgotForm, ResetForm} from './components/AuthForms';
import App from './App';

export default function AuthGate() {
    const [user, setUser] = useState<{id: string, name: string, email?: string, role?: string} | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [authView, setAuthView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
    const [resetToken, setResetToken] = useState<string | null>(null);

    const checkAuth = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user || null);
            } else {
                setUser(null);
            }
        } catch (e: any) {
            setError(e.message || 'Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const resetVal = params.get('reset');
        if (resetVal) {
            setResetToken(resetVal);
            setAuthView('reset');
            params.delete('reset');
            const newSearch = params.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
            window.history.replaceState({}, '', newUrl);
        }

        checkAuth();
        const handleUnauthorized = () => setSessionExpired(true);
        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <RefreshCw className="animate-spin text-emerald-700" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 p-4 text-center space-y-4">
                <p className="text-red-600 text-lg">{error}</p>
                <button onClick={checkAuth} className="px-4 py-2 bg-emerald-700 text-white rounded-lg">Riprova</button>
            </div>
        );
    }

    if (sessionExpired) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full space-y-4 text-center">
                    <h2 className="text-2xl font-serif font-semibold text-stone-900">Sessione scaduta</h2>
                    <p className="text-stone-600">Il tuo accesso è scaduto. Effettua nuovamente il login per continuare.</p>
                    <LoginScreen embedded onLogin={(u) => { setUser(u); setSessionExpired(false); }} />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
                {authView === 'login' && (
                    <LoginScreen 
                        embedded 
                        onLogin={(u) => setUser(u)} 
                        onRegister={() => setAuthView('register')} 
                        onForgot={() => setAuthView('forgot')} 
                    />
                )}
                {authView === 'register' && (
                    <RegisterForm 
                        onBackToLogin={() => setAuthView('login')} 
                        onSuccess={(u) => setUser(u)} 
                    />
                )}
                {authView === 'forgot' && (
                    <ForgotForm 
                        onBackToLogin={() => setAuthView('login')} 
                        mailActive={true} 
                    />
                )}
                {authView === 'reset' && resetToken && (
                    <ResetForm 
                        token={resetToken} 
                        onBackToLogin={() => { setResetToken(null); setAuthView('login'); }} 
                    />
                )}
            </div>
        );
    }

    return (
        <App 
            user={user} 
            onLogout={async () => {
                try {
                    await fetch('/api/logout', {method: 'POST'});
                } catch {}
                setUser(null);
            }} 
        />
    );
}
