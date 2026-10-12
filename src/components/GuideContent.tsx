import {CheckCircle, Sparkles, Search, FileText, ShieldAlert, HelpCircle, RefreshCw} from 'lucide-react';

export default function GuideContent() {
    return (
        <div className="space-y-16 text-lg text-stone-800 leading-relaxed">
            {/* COME FUNZIONA */}
            <section id="come-funziona" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">Come funziona, in breve</h2>
                <p className="text-xl text-stone-700">
                    Questo programma ti aiuta a ritrovare subito quello che hai scritto, anche se non ricordi le parole esatte.
                </p>
                <div className="grid md:grid-cols-3 gap-6 pt-4">
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">1</div>
                        <h3 className="font-semibold text-xl text-stone-900">Scrivi le tue schede</h3>
                        <p className="text-stone-600">Per ogni argomento (un sintomo, un punto, un'erba, una formula...) compili una scheda, come in uno schedario.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">2</div>
                        <h3 className="font-semibold text-xl text-stone-900">Il programma &apos;legge&apos; le schede</h3>
                        <p className="text-stone-600">Con un solo clic il programma capisce il significato dei tuoi testi. Questo passaggio si chiama indicizzazione.</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">3</div>
                        <h3 className="font-semibold text-xl text-stone-900">Cerchi con parole tue</h3>
                        <p className="text-stone-600">Scrivi cosa cerchi, anche con altre parole (per esempio &apos;mal di schiena&apos; invece di &apos;lombalgia&apos;): il programma ti mostra le schede più adatte.</p>
                    </div>
                </div>
            </section>

            {/* COME INIZIARE */}
            <section id="iniziare" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">Come iniziare: 5 passi</h2>
                <ol className="space-y-6">
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">1</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">Accedi</h3>
                            <p className="text-stone-600">Accedi con Google o con email.</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">2</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">Prepara lo schedario (facoltativo)</h3>
                            <p className="text-stone-600">Nella scheda Struttura trovi i tipi (Sintomo, Erba, Meridiano...) e i campi (Pinyin, Indicazioni...). Quelli proposti vanno già bene: puoi cambiarli quando vuoi.</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">3</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">Scrivi le schede</h3>
                            <p className="text-stone-600">Vai su Dati, premi Nuovo, compila Titolo e Contenuto (gli altri campi aiutano ma non sono obbligatori) e premi Salva.</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">4</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">Premi &apos;Genera embedding&apos;</h3>
                            <p className="text-stone-600">In alto, nella barra verde, premi il pulsante. Aspetta che la barra arrivi in fondo. Va rifatto solo per le schede nuove o modificate.</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">5</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">Cerca</h3>
                            <p className="text-stone-600">Vai su Ricerca, scrivi cosa cerchi e premi Invio. Clicca su un risultato per aprire la scheda.</p>
                        </div>
                    </li>
                </ol>
            </section>

            {/* CONSIGLI */}
            <section id="consigli" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">Consigli per usarlo bene</h2>
                <ul className="space-y-4 bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
                    <li className="flex items-start gap-3">
                        <Sparkles className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">Scrivi frasi complete nel Contenuto: più il testo è chiaro, più la ricerca è precisa.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <FileText className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">Una scheda per argomento: meglio tante schede brevi che una lunga.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <RefreshCw className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">Dopo aver modificato una scheda, ricordati di premere di nuovo &apos;Genera embedding&apos;.</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <Search className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">Per le ricerche serve la connessione a internet.</span>
                    </li>
                </ul>
            </section>

            {/* SALVATAGGIO */}
            <section id="salvataggio" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">Dove finiscono le mie schede? (importante)</h2>
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl space-y-4 text-amber-900">
                    <p className="font-medium text-xl">
                        I tuoi archivi restano salvati solo nel tuo browser. Quando cerchi o generi gli embedding, i testi vengono inviati a un servizio di intelligenza artificiale (OpenRouter e il fornitore del modello) per il calcolo e non vengono salvati sul nostro server. L'amministratore gestisce solo gli account (nome, email, stato) e non può vedere i tuoi dati. Esporta spesso un backup JSON: se cambi dispositivo o browser, importalo.
                    </p>
                    <ul className="space-y-3 pt-2 text-stone-800 list-disc list-inside">
                        <li>Se usi un altro computer o un altro browser, non le troverai.</li>
                        <li>Se cancelli i dati di navigazione, le schede possono andare perse.</li>
                        <li>Ogni tanto fai una copia di sicurezza: menu → &apos;Esporta JSON (backup)&apos;. Conserva il file in un posto sicuro (chiavetta, cartella del cloud).</li>
                        <li>Per rimettere una copia: Archivi → &apos;Importa da JSON&apos;.</li>
                    </ul>
                </div>
            </section>

            {/* DOMANDE FREQUENTI */}
            <section id="domande" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">Domande frequenti</h2>
                <div className="space-y-4">
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>Ho dimenticato la password.</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">Ho dimenticato la password: usa il link nella schermata di accesso.</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>Altri possono leggere le mie schede?</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">No. Le schede restano sul tuo computer. Per capire il significato dei testi, il programma invia temporaneamente le frasi a un servizio di intelligenza artificiale (OpenRouter e il fornitore del modello) e non le conserva sul sito.</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>Posso importare le schede da Excel?</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">Sì. Premi &apos;Importa/Esporta&apos;, scarica il modello di Excel, compilalo e caricalo.</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>La ricerca non trova nulla.</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">Controlla che le schede siano &apos;indicizzate&apos; (in Dati compare il bollino verde). Se no, premi &apos;Genera embedding&apos;.</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>Il programma sostituisce il parere di un medico?</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">No. È solo uno strumento di consultazione e non sostituisce un parere medico.</p>
                    </details>
                </div>
            </section>
        </div>
    );
}
