import {useState, useEffect} from 'react';
import {Button, inputCls} from './ui';
import {Leaf} from 'lucide-react';

export function LoginScreen({
    embedded = false,
    onLogin,
    onRegister,
    onForgot
}: {
    embedded?: boolean;
    onLogin?: (user: {id: string, name: string}) => void;
    onRegister?: () => void;
    onForgot?: () => void;
}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [health, setHealth] = useState<{ registration?: boolean; mail?: boolean } | null>(null);

    useEffect(() => {
        fetch('/api/health')
            .then(res => res.json())
            .then(data => setHealth(data))
            .catch(() => {});
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({username, password})
            });
            const data = await res.json();
            if (res.ok) {
                if (onLogin) onLogin(data.user);
                else window.location.reload();
            } else {
                setError(data.error || 'Credenziali non valide');
            }
        } catch {
            setError('Errore di connessione');
        } finally {
            setLoading(false);
        }
    };

    const content = (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-200 w-full max-w-md">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                    <Leaf size={28} />
                </div>
                <div>
                    <h2 className="text-2xl font-serif font-semibold text-stone-900">Accesso</h2>
                    <p className="text-stone-600 text-base">Inserisci le tue credenziali</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-base font-medium text-stone-700 mb-1.5">Nome utente o ID</label>
                    <input 
                        type="text" 
                        value={username} 
                        onChange={e => setUsername(e.target.value)} 
                        className={inputCls + ' text-lg py-3'} 
                        required 
                        autoFocus 
                    />
                </div>
                <div>
                    <label className="block text-base font-medium text-stone-700 mb-1.5">Password</label>
                    <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className={inputCls + ' text-lg py-3'} 
                        required 
                    />
                    <div className="flex justify-between items-center mt-1.5">
                        {onForgot && (
                            <button
                                type="button"
                                onClick={onForgot}
                                className="text-sm text-emerald-700 hover:underline font-medium"
                            >
                                Password dimenticata?
                            </button>
                        )}
                        {!health?.mail && onForgot && (
                            <span className="text-xs text-stone-500">Contatta l'amministratore</span>
                        )}
                    </div>
                </div>
                {error && <p className="text-red-600 text-base p-3 bg-red-50 rounded-lg">{error}</p>}
                <Button type="submit" loading={loading} className="w-full text-lg min-h-[48px] bg-emerald-700 text-white hover:bg-emerald-800">
                    Accedi
                </Button>
                {health?.registration && onRegister && (
                    <div className="text-center pt-2 border-t border-stone-100">
                        <button
                            type="button"
                            onClick={onRegister}
                            className="text-emerald-700 hover:underline text-base font-medium"
                        >
                            Registrati con codice d'invito
                        </button>
                    </div>
                )}
            </form>
        </div>
    );

    if (embedded) {
        return content;
    }

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
            {content}
        </div>
    );
}
