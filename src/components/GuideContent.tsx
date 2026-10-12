import {HelpCircle} from 'lucide-react';
import {useTranslation} from '../utils/i18n';

export default function GuideContent() {
    const {t} = useTranslation();
    return (
        <div className="space-y-10 text-stone-900 text-base leading-relaxed">
            <section className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-stone-900 border-b pb-2">{t('guideHowItWorksTitle')}</h2>
                <p className="text-stone-700">
                    {t('guideHowItWorksSub')}
                </p>
                <div className="grid md:grid-cols-3 gap-6 pt-2">
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-lg">1</div>
                        <h3 className="font-semibold text-lg text-stone-900">{t('guideStep1Title')}</h3>
                        <p className="text-stone-600 text-sm">{t('guideStep1Text')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-lg">2</div>
                        <h3 className="font-semibold text-lg text-stone-900">{t('guideStep2Title')}</h3>
                        <p className="text-stone-600 text-sm">{t('guideStep2Text')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-lg">3</div>
                        <h3 className="font-semibold text-lg text-stone-900">{t('guideStep3Title')}</h3>
                        <p className="text-stone-600 text-sm">{t('guideStep3Text')}</p>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-stone-900 border-b pb-2">{t('guideStartTitle')}</h2>
                <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                    <div className="flex items-start gap-3">
                        <span className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold shrink-0 text-sm">1</span>
                        <div>
                            <h4 className="font-semibold text-stone-900">{t('guideS1Title')}</h4>
                            <p className="text-stone-600 text-sm">{t('guideS1Text')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold shrink-0 text-sm">2</span>
                        <div className="flex items-center gap-2">
                            <div>
                                <h4 className="font-semibold text-stone-900">{t('structureTitle')}</h4>
                                <p className="text-stone-600 text-sm">{t('structureSub')}</p>
                            </div>
                            <span title="Campi: personalizza i tipi di schede e metadati" className="text-emerald-700 cursor-help"><HelpCircle size={18}/></span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold shrink-0 text-sm">3</span>
                        <div>
                            <h4 className="font-semibold text-stone-900">{t('guideS3Title')}</h4>
                            <p className="text-stone-600 text-sm">{t('guideS3Text')}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold shrink-0 text-sm">4</span>
                        <div className="flex items-center gap-2">
                            <div>
                                <h4 className="font-semibold text-stone-900">{t('searchReady')}</h4>
                                <p className="text-stone-600 text-sm">{t('guideS4Text')}</p>
                            </div>
                            <span title="Importa/Esporta: gestisci file JSON ed Excel" className="text-emerald-700 cursor-help"><HelpCircle size={18}/></span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold shrink-0 text-sm">5</span>
                        <div className="flex items-center gap-2">
                            <div>
                                <h4 className="font-semibold text-stone-900">{t('guideS5Title')}</h4>
                                <p className="text-stone-600 text-sm">{t('guideS5Text')}</p>
                            </div>
                            <span title="Backup: salva copie periodiche dei dati" className="text-emerald-700 cursor-help"><HelpCircle size={18}/></span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-2xl font-serif font-bold text-stone-900 border-b pb-2">{t('guideFaqTitle')}</h2>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <details key={i} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm group">
                            <summary className="font-semibold text-stone-900 cursor-pointer list-none flex justify-between items-center text-base">
                                <span>{t(`guideFaq${i > 5 ? 5 : i}Q`)}</span>
                                <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                            </summary>
                            <p className="mt-3 text-stone-600 text-sm pt-3 border-t">{t(`guideFaq${i > 5 ? 5 : i}A`)}</p>
                        </details>
                    ))}
                </div>
            </section>
        </div>
    );
}

