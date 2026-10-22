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
import { auth, googleProvider, db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button, Modal } from './components/ui';
import { RefreshCw, LogOut, Leaf, Shield, Laptop, Smartphone, Search, ArrowRight, HelpCircle, Globe, Cloud, Eye, EyeOff } from 'lucide-react';
import App from './App';
import GuideContent from './components/GuideContent';
import { AdminPanel } from './components/AdminPanel';
import { useTranslation } from './utils/i18n';

export default function AuthGate() {
    const { lang, setLang, t } = useTranslation();
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user);
            setLoadingAuth(false);
            if (user) {
                try {
                    await setDoc(doc(db, 'users', user.uid), {
                        uid: user.uid,
                        email: user.email || '',
                        displayName: user.displayName || user.email?.split('@')[0] || 'Utente',
                        lastLogin: new Date().toISOString(),
                        createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : new Date().toISOString()
                    }, { merge: true });
                } catch (e) {
                    console.error('Error saving user profile:', e);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const translateFirebaseError = (err: any) => {
        const code = err?.code || '';
        if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
            return t('errorInvalidCredentials');
        }
        if (code.includes('email-already-in-use')) {
            return t('errorEmailInUse');
        }
        if (code.includes('weak-password')) {
            return t('errorWeakPassword');
        }
        if (code.includes('invalid-email')) {
            return t('errorInvalidEmail');
        }
        if (code.includes('too-many-requests')) {
            return t('errorTooManyRequests');
        }
        return t('errorAuthGeneral');
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
            setErrorMsg(t('errorWeakPassword'));
            return;
        }
        if (password !== confirmPassword) {
            setErrorMsg(t('errorPasswordMatch'));
            return;
        }
        setSubmitting(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);
            setInfoMsg(t('accountCreatedVerify'));
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
            setInfoMsg(t('passwordResetSent'));
            setMode('login');
        } catch (e: any) {
            setInfoMsg(t('passwordResetSent'));
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
            setInfoMsg(t('emailSentNotice'));
        } catch (e: any) {
            setErrorMsg(t('errorAuthGeneral'));
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
                        {t('checkEmailSub')} <span className="font-semibold">{firebaseUser.email}</span>{t('clickLinkActivate')}
                    </p>
                    {infoMsg && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-sm">{infoMsg}</div>}
                    {errorMsg && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{errorMsg}</div>}
                    <div className="space-y-3">
                        <Button className="w-full py-3 text-base" onClick={handleCheckVerification} disabled={submitting}>
                            {t('verifiedBtn')}
                        </Button>
                        <Button variant="secondary" className="w-full py-3 text-base" onClick={handleResendVerification} disabled={submitting}>
                            {t('resendBtn')}
                        </Button>
                        <Button variant="ghost" className="w-full py-3 text-base text-red-600" onClick={() => signOut(auth)}>
                            <LogOut size={18} className="mr-2" /> {t('logout')}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (firebaseUser) {
        if (showAdmin && firebaseUser.email === 'gestsocialgabriele@gmail.com') {
            return <AdminPanel onBack={() => setShowAdmin(false)} />;
        }
        const userInfo = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || 'Utente',
            email: firebaseUser.email || undefined
        };
        return (
            <App 
                user={userInfo} 
                onLogout={() => signOut(auth)} 
                onOpenAdmin={firebaseUser.email === 'gestsocialgabriele@gmail.com' ? () => setShowAdmin(true) : undefined}
            />
        );
    }

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            el.scrollIntoView({behavior: prefersReduced ? 'auto' : 'smooth'});
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900 font-sans antialiased flex flex-col justify-between">
            <div>
                <header className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-stone-200 z-40">
                    <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                                <Leaf size={24} />
                            </div>
                            <span className="font-serif font-bold text-xl text-stone-900">{t('appName')}</span>
                        </div>
                        <nav className="flex items-center gap-4 sm:gap-6">
                            <button onClick={() => scrollToSection('come-funziona')} className="hidden sm:inline text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer text-base">
                                {t('howItWorks')}
                            </button>
                            <button onClick={() => scrollToSection('iniziare')} className="hidden sm:inline text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer text-base">
                                {t('instructions')}
                            </button>
                            <button 
                                onClick={() => setLang(lang === 'it' ? 'de' : 'it')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-100 cursor-pointer"
                                aria-label="Cambia lingua"
                            >
                                <Globe size={16} className="text-emerald-700" />
                                <span className="uppercase font-semibold">{lang}</span>
                            </button>
                            <Button onClick={() => setShowLoginModal(true)} className="min-h-[44px] text-base px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                                {t('login')}
                            </Button>
                        </nav>
                    </div>
                </header>

                <main className="max-w-6xl mx-auto px-4 py-12 space-y-16">
                    <section className="py-12 lg:py-16 grid lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-8">
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-stone-900 leading-tight">
                                {t('heroTitle')}
                            </h1>
                            <p className="text-xl sm:text-2xl text-stone-600 leading-relaxed">
                                {t('heroSub')}
                            </p>
                            <div className="flex flex-wrap gap-4 pt-2">
                                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                    <Shield size={20} className="text-emerald-700 shrink-0" />
                                    <span>{t('feature1')}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                    <Laptop size={20} className="text-emerald-700 shrink-0" />
                                    <span>{t('feature2')}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                    <Smartphone size={20} className="text-emerald-700 shrink-0" />
                                    <span>{t('feature3')}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm text-stone-700 text-base">
                                    <Cloud size={20} className="text-emerald-700 shrink-0" />
                                    <span>{t('driveBackupMenu')}</span>
                                </div>
                            </div>
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900 text-base leading-relaxed">
                                {t('drivePrivacyNotice')}
                            </div>
                            <div className="pt-4">
                                <Button onClick={() => setShowLoginModal(true)} className="py-4 px-8 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg flex items-center gap-3">
                                    {t('ctaStart')} <ArrowRight size={20} />
                                </Button>
                            </div>
                        </div>
                        <div className="bg-white p-8 sm:p-10 rounded-3xl border border-stone-200 shadow-xl space-y-6">
                            <h3 className="font-serif font-bold text-2xl text-stone-900">{t('quickStart')}</h3>
                            <p className="text-stone-600 text-lg">
                                {t('quickStartSub')}
                            </p>
                            <div className="space-y-4 pt-2">
                                <Button 
                                    variant="secondary" 
                                    className="w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-900"
                                    onClick={() => { setMode('login'); setShowLoginModal(true); }}
                                >
                                    {t('loginGoogleEmail')}
                                </Button>
                                <div className="text-center">
                                    <button onClick={() => { setMode('register'); setShowLoginModal(true); }} className="text-emerald-700 hover:underline font-medium text-base cursor-pointer">
                                        {t('noAccount')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div id="come-funziona" className="bg-white p-6 sm:p-12 rounded-3xl border border-stone-200 shadow-sm">
                        <GuideContent />
                    </div>
                </main>
            </div>

            <footer className="bg-white border-t border-stone-200 text-center p-8 text-sm text-stone-500 mt-20 space-y-2">
                <p>{t('disclaimerConsultation')}</p>
                <p className="text-xs">{t('disclaimerSimilarity')}</p>
                <p className="text-sm font-medium text-stone-700 pt-2">
                    {t('createdBylabel')} <a href="https://sititicino.ch/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-semibold">Connect & Create</a>
                </p>
            </footer>

            {showLoginModal && (
                <Modal title={
                    mode === 'login' ? t('loginAccountTitle') : 
                    mode === 'register' ? t('createAccountTitle') : t('forgotPassword')
                } onClose={() => setShowLoginModal(false)} className="max-w-md">
                    <div className="space-y-6 text-stone-900 text-base py-2">
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
                                    {t('continueGoogle')}
                                </Button>

                                <div className="flex items-center my-4">
                                    <div className="flex-grow border-t border-stone-200"></div>
                                    <span className="px-3 text-stone-500 text-sm">{t('orEmail')}</span>
                                    <div className="flex-grow border-t border-stone-200"></div>
                                </div>

                                <form onSubmit={handleEmailLogin} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-stone-700 mb-1">E-mail</label>
                                        <input 
                                            type="email" 
                                            required 
                                            autoComplete="email"
                                            value={email} 
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                            placeholder={t('emailPlaceholder')}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-stone-700 mb-1">{t('passwordLabel')}</label>
                                        <div className="relative">
                                            <input 
                                                type={showPassword ? 'text' : 'password'} 
                                                required 
                                                autoComplete="current-password"
                                                value={password} 
                                                onChange={e => setPassword(e.target.value)}
                                                className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 pr-12"
                                                placeholder="••••••••"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 p-1"
                                                aria-label="Mostra o nascondi password"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                                        {t('login')}
                                    </Button>
                                </form>

                                <div className="flex justify-between items-center text-sm pt-2">
                                    <button onClick={() => { setMode('register'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium cursor-pointer">
                                        {t('createAccountTitle')}
                                    </button>
                                    <button onClick={() => { setMode('forgot'); setErrorMsg(null); setInfoMsg(null); }} className="text-stone-600 hover:underline cursor-pointer">
                                        {t('forgotPassword')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'register' && (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">E-mail</label>
                                    <input 
                                        type="email" 
                                        required 
                                        autoComplete="email"
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                        placeholder={t('emailPlaceholder')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('min8Chars')}</label>
                                    <div className="relative">
                                        <input 
                                            type={showPassword ? 'text' : 'password'} 
                                            required 
                                            minLength={8}
                                            autoComplete="new-password"
                                            value={password} 
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 pr-12"
                                            placeholder="••••••••"
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 p-1"
                                            aria-label="Mostra o nascondi password"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">{t('confirmPasswordLabel')}</label>
                                    <input 
                                        type="password" 
                                        required 
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                                    {t('createAccountTitle')}
                                </Button>
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium text-sm cursor-pointer">
                                        {t('alreadyHaveAccount')}
                                    </button>
                                </div>
                            </form>
                        )}

                        {mode === 'forgot' && (
                            <form onSubmit={handleForgot} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">E-mail</label>
                                    <input 
                                        type="email" 
                                        required 
                                        autoComplete="email"
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 text-base border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                        placeholder={t('emailPlaceholder')}
                                    />
                                </div>
                                <Button type="submit" className="w-full py-3.5 text-base font-semibold bg-emerald-700 hover:bg-emerald-800 text-white" disabled={submitting}>
                                    {t('sendInstructions')}
                                </Button>
                                <div className="text-center pt-2">
                                    <button type="button" onClick={() => { setMode('login'); setErrorMsg(null); setInfoMsg(null); }} className="text-emerald-700 hover:underline font-medium text-sm cursor-pointer">
                                        {t('backToLogin')}
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="p-3 bg-stone-100 rounded-xl text-stone-700 text-xs leading-relaxed text-center">
                            {t('localNotice')}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

