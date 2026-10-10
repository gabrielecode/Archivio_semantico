import {useState} from 'react';
import {Button, inputCls} from './ui';
import {Leaf} from 'lucide-react';

export function LoginScreen({embedded = false, onLogin}: {embedded?: boolean; onLogin?: (user: {id: string, name: string}) => void}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
                    <label className="block text-base font-medium text-stone-700 mb-1.5">Nome utente</label>
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
                </div>
                {error && <p className="text-red-600 text-base p-3 bg-red-50 rounded-lg">{error}</p>}
                <Button type="submit" loading={loading} className="w-full text-lg min-h-[48px]">
                    Accedi
                </Button>
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
