import {Leaf, Shield, Laptop, Smartphone, Search, ArrowRight} from 'lucide-react';
import {Button} from './ui';
import {LoginScreen} from './LoginScreen';
import GuideContent from './GuideContent';

export function Landing({onLogin}: {onLogin: (user: {id: string, name: string}) => void}) {
    const scrollToAccedi = () => {
        const el = document.getElementById('accedi');
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({behavior: prefersReduced ? 'auto' : 'smooth'});
            const input = el.querySelector('input');
            if (input) input.focus();
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
            
            {/* STICKY TOP BAR */}
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
                {/* HERO SECTION */}
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
                    <div id="accedi" className="flex justify-center lg:justify-end">
                        <LoginScreen embedded onLogin={onLogin} />
                    </div>
                </section>

                {/* MOCK SEARCH PREVIEW */}
                <section className="max-w-4xl mx-auto px-4 pb-16" aria-hidden="true">
                    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-4 opacity-9ogle">
                        <div className="flex gap-2 items-center bg-stone-100 p-3 rounded-xl border border-stone-200">
                            <Search className="text-stone-400 shrink-0" size={22} />
                            <span className="text-stone-500 text-lg">mal di schiena</span>
                            <span className="ml-auto text-xs bg-stone-200 text-stone-600 px-2 py-1 rounded font-medium">Esempio</span>
                        </div>
                        <div className="space-y-3 pt-2">
                            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold text-stone-900">Lombalgia da deficit di Reni</span>
                                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Sintomo</span>
                                </div>
                                <p className="text-stone-600 text-base line-clamp-2">Dolore sordo alla regione lombare che migliora con il riposo e la pressione...</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* GUIDE CONTENT */}
                <section className="max-w-3xl mx-auto px-4 py-12">
                    <GuideContent />
                </section>

                {/* CTA BAND */}
                <section className="bg-emerald-900 text-white py-20 my-16 text-center">
                    <div className="max-w-3xl mx-auto px-4 space-y-6">
                        <h2 className="text-3xl sm:text-4xl font-serif font-bold">Pronto? Accedi</h2>
                        <p className="text-emerald-100 text-xl max-w-xl mx-auto">
                            Inizia subito a organizzare e consultare il tuo schedario clinico.
                        </p>
                        <div>
                            <Button onClick={scrollToAccedi} variant="primary" className="bg-white text-emerald-900 hover:bg-emerald-50 text-xl px-8 py-4 min-h-[56px] font-semibold">
                                Accedi ora <ArrowRight size={22} />
                            </Button>
                        </div>
                    </div>
                </section>
            </main>

            {/* FOOTER */}
            <footer className="bg-white border-t border-stone-200 py-12 text-center text-stone-600 space-y-2">
                <p className="font-medium text-stone-900">Strumento di consultazione, non sostituisce un parere medico.</p>
                <p className="text-sm text-stone-500">Accesso riservato</p>
            </footer>
        </div>
    );
}
