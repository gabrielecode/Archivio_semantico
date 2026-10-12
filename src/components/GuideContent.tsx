import {CheckCircle, Sparkles, Search, FileText, ShieldAlert, HelpCircle, RefreshCw} from 'lucide-react';
import { useTranslation } from '../utils/i18n';

export default function GuideContent() {
    const { t } = useTranslation();
    return (
        <div className="space-y-16 text-lg text-stone-800 leading-relaxed">
            {/* COME FUNZIONA */}
            <section id="come-funziona" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">{t('guideHowItWorksTitle')}</h2>
                <p className="text-xl text-stone-700">
                    {t('guideHowItWorksSub')}
                </p>
                <div className="grid md:grid-cols-3 gap-6 pt-4">
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">1</div>
                        <h3 className="font-semibold text-xl text-stone-900">{t('guideStep1Title')}</h3>
                        <p className="text-stone-600">{t('guideStep1Text')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">2</div>
                        <h3 className="font-semibold text-xl text-stone-900">{t('guideStep2Title')}</h3>
                        <p className="text-stone-600">{t('guideStep2Text')}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-xl flex items-center justify-center font-bold text-xl">3</div>
                        <h3 className="font-semibold text-xl text-stone-900">{t('guideStep3Title')}</h3>
                        <p className="text-stone-600">{t('guideStep3Text')}</p>
                    </div>
                </div>
            </section>

            {/* COME INIZIARE */}
            <section id="iniziare" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">{t('guideStartTitle')}</h2>
                <ol className="space-y-6">
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">1</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">{t('guideS1Title')}</h3>
                            <p className="text-stone-600">{t('guideS1Text')}</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">2</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">{t('guideS2Title')}</h3>
                            <p className="text-stone-600">{t('guideS2Text')}</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">3</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">{t('guideS3Title')}</h3>
                            <p className="text-stone-600">{t('guideS3Text')}</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">4</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">{t('guideS4Title')}</h3>
                            <p className="text-stone-600">{t('guideS4Text')}</p>
                        </div>
                    </li>
                    <li className="flex gap-4 items-start bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                        <span className="shrink-0 w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center font-bold text-lg">5</span>
                        <div className="space-y-1">
                            <h3 className="font-semibold text-xl text-stone-900">{t('guideS5Title')}</h3>
                            <p className="text-stone-600">{t('guideS5Text')}</p>
                        </div>
                    </li>
                </ol>
            </section>

            {/* CONSIGLI */}
            <section id="consigli" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">{t('guideTipsTitle')}</h2>
                <ul className="space-y-4 bg-white p-8 rounded-2xl border border-stone-200 shadow-sm">
                    <li className="flex items-start gap-3">
                        <Sparkles className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">{t('guideTip1')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <FileText className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">{t('guideTip2')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <RefreshCw className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">{t('guideTip3')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <Search className="text-emerald-700 shrink-0 mt-1" size={22} />
                        <span className="text-stone-700">{t('guideTip4')}</span>
                    </li>
                </ul>
            </section>

            {/* SALVATAGGIO */}
            <section id="salvataggio" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">{t('guideSaveTitle')}</h2>
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl space-y-4 text-amber-900">
                    <p className="font-medium text-xl">
                        {t('guideSaveText')}
                    </p>
                    <p className="font-medium text-lg text-stone-800 bg-white p-4 rounded-xl border border-stone-200">
                        {t('drivePrivacyNotice')}
                    </p>
                    <ul className="space-y-3 pt-2 text-stone-800 list-disc list-inside">
                        <li>{t('guideSaveLi1')}</li>
                        <li>{t('guideSaveLi2')}</li>
                        <li>{t('guideSaveLi3')}</li>
                        <li>{t('guideSaveLi4')}</li>
                    </ul>
                </div>
            </section>

            {/* DOMANDE FREQUENTI */}
            <section id="domande" className="space-y-6">
                <h2 className="text-3xl font-serif font-semibold text-stone-900 border-b pb-3">{t('guideFaqTitle')}</h2>
                <div className="space-y-4">
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('restoreBackupGuideQ')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('restoreBackupGuideA')}</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('guideFaq1Q')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('guideFaq1A')}</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('guideFaq2Q')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('guideFaq2A')}</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('guideFaq3Q')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('guideFaq3A')}</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('guideFaq4Q')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('guideFaq4A')}</p>
                    </details>
                    <details className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm group">
                        <summary className="font-semibold text-xl text-stone-900 cursor-pointer list-none flex justify-between items-center">
                            <span>{t('guideFaq5Q')}</span>
                            <span className="text-emerald-700 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="mt-4 text-stone-600 pt-3 border-t">{t('guideFaq5A')}</p>
                    </details>
                </div>
            </section>
        </div>
    );
}
