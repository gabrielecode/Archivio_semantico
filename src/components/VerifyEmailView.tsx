import { Globe, LogOut } from 'lucide-react';
import { Button } from './ui';
import { Lang } from '../utils/i18n';

interface VerifyEmailViewProps {
  email: string | null;
  lang: Lang;
  setLang: (lang: Lang) => void;
  infoMsg: string | null;
  errorMsg: string | null;
  submitting: boolean;
  onCheckVerification: () => void;
  onResendVerification: () => void;
  onLogout: () => void;
  t: (key: string) => string;
}

export function VerifyEmailView({
  email,
  lang,
  setLang,
  infoMsg,
  errorMsg,
  submitting,
  onCheckVerification,
  onResendVerification,
  onLogout,
  t,
}: VerifyEmailViewProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6 text-stone-900 text-base">
        <div className="flex justify-end">
          <button
            onClick={() => setLang(lang === 'it' ? 'de' : 'it')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-100"
          >
            <Globe size={16} className="text-emerald-700" />
            {lang === 'it' ? 'Deutsch' : 'Italiano'}
          </button>
        </div>
        <h1 className="text-2xl font-serif font-bold text-center text-stone-900">{t('checkEmailTitle')}</h1>
        <p className="text-stone-700 text-base text-center">
          {t('checkEmailSub')} <span className="font-semibold">{email}</span>
          {t('clickLinkActivate')}
        </p>
        {infoMsg && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{infoMsg}</div>}
        {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}
        <div className="space-y-3">
          <Button className="w-full py-3 text-base" onClick={onCheckVerification} disabled={submitting}>
            {t('verifiedBtn')}
          </Button>
          <Button variant="secondary" className="w-full py-3 text-base" onClick={onResendVerification} disabled={submitting}>
            {t('resendBtn')}
          </Button>
          <Button variant="ghost" className="w-full py-3 text-base text-red-600" onClick={onLogout}>
            <LogOut size={18} className="mr-2" /> {t('logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
