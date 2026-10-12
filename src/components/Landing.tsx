import {Leaf, Shield, Laptop, Smartphone, Search, ArrowRight} from 'lucide-react';
import {Button} from './ui';
import GuideContent from './GuideContent';

export function Landing({onLogin}: {onLogin: (user: {id: string, name: string}) => void}) {
    const scrollToAccedi = () => {
        const el = document.getElementById('accedi');
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({behavior: prefersReduced ? 'auto' : 'smooth'});
        }
    };

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({behavior: prefersReduced ? 'auto' : 'smooth'});
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900 font-sans antialiased text-lg">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-emerald-700 focus:text-white">Vai al contenuto principale</a>
            
            <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-stone-200 z-40">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                            <Leaf size={24} />
                        </div>
                        <span className="font-serif font-bold text-xl text-stone-900">Ricerca semantica MTC</span>
                    </div>
                    <nav className="flex items-center gap-6">
                        <button onClick={() => scrollToSection('come-funziona')} className="text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer">
                            Come funziona
                        </button>
                        <button onClick={() => scrollToSection('iniziare')} className="hidden sm:inline text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer">
                            Istruzioni
                        </button>
                        <Button onClick={scrollToAccedi} className="min-h-[48px] text-lg px-6">
                            Accedi
                        </Button>
                    </nav>
                </div>
            </header>

            <main id="main-content">
                <section className="max-w-6xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-stone-900 leading-tight">
                            Ritrova subito quello che hai scritto
                        </h1>
                        <p className="text-2xl text-stone-600 leading-relaxed">
                            Il tuo schedario di Medicina Tradizionale Cinese, con una ricerca che capisce il significato delle parole.
                        </p>
                        <div className="flex flex-wrap gap-4 pt-2">
                            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                <Shield size={20} className="text-emerald-700 shrink-0" />
                                <span>I tuoi dati restano sul tuo computer</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                <Laptop size={20} className="text-emerald-700 shrink-0" />
                                <span>Nessuna installazione</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                <Smartphone size={20} className="text-emerald-700 shrink-0" />
                                <span>Funziona anche da telefono</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
