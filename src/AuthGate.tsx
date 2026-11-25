import React, { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Button } from './components/ui';
import { RefreshCw, Leaf, Shield, Laptop, Smartphone, ArrowRight, Globe, Cloud } from 'lucide-react';
import App from './App';
import GuideContent from './components/GuideContent';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { VerifyEmailView } from './components/VerifyEmailView';
import { useTranslation } from './utils/i18n';
import { revoke } from './utils/drive';

const ADMIN_EMAIL = 'gestsocialgabriele@gmail.com';

export default function AuthGate() {
  const { lang, setLang, t } = useTranslation();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthRevision((v) => v + 1);
      setLoadingAuth(false);
      if (!user) {
        revoke();
      }
    });
    return () => unsubscribe();
  }, []);

  const currentUser = auth.currentUser || firebaseUser;
  const isGoogleUser = Boolean(currentUser?.providerData.some((p) => p.providerId === 'google.com'));
  const isVerifiedUser = Boolean(currentUser && (isGoogleUser || currentUser.emailVerified));

  useEffect(() => {
    if (!currentUser || !isVerifiedUser) return;

    let cancelled = false;
    (async () => {
      const path = `users/${currentUser.uid}`;
      try {
        await currentUser.getIdToken();
        if (cancelled) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(userRef);
        if (cancelled) return;

        const safeEmail = (currentUser.email || '').slice(0, 320);
        const safeDisplayName =
          (currentUser.displayName || currentUser.email?.split('@')[0] || 'Utente').slice(0, 120) || 'Utente';
        const nowIso = new Date().toISOString();

        if (!snap.exists()) {
          const createdAt = currentUser.metadata.creationTime
            ? new Date(currentUser.metadata.creationTime).toISOString()
            : nowIso;
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: safeEmail,
            displayName: safeDisplayName,
            lastLogin: nowIso,
            createdAt,
          });
        } else {
          const existingData = snap.data();
          if (!existingData?.createdAt) {
            const createdAt = currentUser.metadata.creationTime
              ? new Date(currentUser.metadata.creationTime).toISOString()
              : nowIso;
            await setDoc(
              userRef,
              {
                uid: currentUser.uid,
                email: safeEmail,
                displayName: safeDisplayName,
                lastLogin: nowIso,
                createdAt,
              },
              { merge: true }
            );
          } else {
            await updateDoc(userRef, {
              email: safeEmail,
              displayName: safeDisplayName,
              lastLogin: nowIso,
            });
          }
        }
      } catch (e) {
        try {
          handleFirestoreError(e, OperationType.WRITE, path);
        } catch (err) {
          console.error('Error saving user profile:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid, isVerifiedUser, authRevision]);

  const translateFirebaseError = (err: any) => {
    const code = err?.code || '';
    const msg = err?.message || '';
    console.error('Firebase Auth Error:', { code, msg });

    if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
      return null;
    }
    if (code.includes('operation-not-allowed')) {
      return 'L\'accesso tramite Email/Password non è ancora abilitato nella console Firebase (Authentication > Sign-in method > Email/Password). Per accedere subito, clicca sul pulsante "Continua con Google".';
    }
    if (code.includes('unauthorized-domain')) {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'questo dominio';
      return `Dominio non autorizzato su Firebase: aggiungi "${currentHost}" in Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      return 'Credenziali errate o account non ancora registrato. Se è la prima volta, clicca su "Crea un account" in basso oppure usa "Continua con Google".';
    }
    if (code.includes('email-already-in-use')) return t('errorEmailInUse');
    if (code.includes('weak-password')) return t('errorWeakPassword');
    if (code.includes('invalid-email')) return t('errorInvalidEmail');
    if (code.includes('too-many-requests')) return t('errorTooManyRequests');
    if (code.includes('network-request-failed')) {
      return 'Errore di connessione: impossibile raggiungere i server di autenticazione. Verifica la connessione internet o disattiva temporaneamente eventuali ad-blocker.';
    }
    if (code.includes('access-denied') || msg.includes('access_denied')) {
      return 'Accesso negato da Google: aggiungi la tua email agli "Utenti di test" nella Google Cloud Console (OAuth consent screen) oppure pubblica l\'app.';
    }
    return `${t('errorAuthGeneral')}${code ? ` (${code})` : ''}`;
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowLoginModal(false);
    } catch (e: any) {
      const translated = translateFirebaseError(e);
      if (translated) setErrorMsg(translated);
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
      setShowLoginModal(false);
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
    } catch {
      // Avoid enumerating whether email exists
    } finally {
      setInfoMsg(t('passwordResetSent'));
      setMode('login');
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await sendEmailVerification(currentUser);
      setInfoMsg(t('emailSentNotice'));
    } catch {
      setErrorMsg(t('errorAuthGeneral'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await currentUser.reload();
      await auth.currentUser?.getIdToken(true);
      setFirebaseUser(auth.currentUser);
      setAuthRevision((v) => v + 1);
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        setErrorMsg('Email non ancora verificata: controlla la posta o reinvia il link.');
      }
    } catch {
      setErrorMsg(t('errorAuthGeneral'));
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

  if (currentUser && !isVerifiedUser) {
    return (
      <VerifyEmailView
        email={currentUser.email}
        lang={lang}
        setLang={setLang}
        infoMsg={infoMsg}
        errorMsg={errorMsg}
        submitting={submitting}
        onCheckVerification={handleCheckVerification}
        onResendVerification={handleResendVerification}
        onLogout={() => signOut(auth)}
        t={t}
      />
    );
  }

  if (currentUser) {
    const isAdmin = isVerifiedUser && currentUser.email === ADMIN_EMAIL;
    if (showAdmin && isAdmin) {
      return <AdminPanel onBack={() => setShowAdmin(false)} />;
    }
    const userInfo = {
      id: currentUser.uid,
      name: currentUser.displayName || currentUser.email || 'Utente',
      email: currentUser.email || undefined,
    };
    return (
      <App
        user={userInfo}
        onLogout={() => signOut(auth)}
        onOpenAdmin={isAdmin ? () => setShowAdmin(true) : undefined}
      />
    );
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
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
              <div className="flex flex-col">
                <span className="font-serif font-bold text-xl text-stone-900 leading-tight">{t('appName')}</span>
                <span className="text-xs font-semibold text-emerald-800 tracking-wide">Medicina Tradizionale Cinese</span>
              </div>
            </div>
            <nav className="flex items-center gap-4 sm:gap-6">
              <button
                onClick={() => scrollToSection('come-funziona')}
                className="hidden sm:inline text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer text-base whitespace-nowrap"
              >
                {t('howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('iniziare')}
                className="hidden sm:inline text-stone-600 hover:text-emerald-700 font-medium transition-colors cursor-pointer text-base whitespace-nowrap"
              >
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
              <Button onClick={() => setShowLoginModal(true)} className="min-h-[44px] text-base px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold whitespace-nowrap">
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
              <p className="text-xl sm:text-2xl text-stone-600 leading-relaxed">{t('heroSub')}</p>
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
              <p className="text-stone-600 text-lg">{t('quickStartSub')}</p>
              <div className="space-y-4 pt-2">
                <Button
                  variant="secondary"
                  className="w-full py-3.5 text-base font-semibold flex items-center justify-center gap-2 border border-stone-300 bg-white hover:bg-stone-50 text-stone-900"
                  onClick={() => {
                    setMode('login');
                    setShowLoginModal(true);
                  }}
                >
                  {t('loginGoogleEmail')}
                </Button>
                <div className="text-center">
                  <button
                    onClick={() => {
                      setMode('register');
                      setShowLoginModal(true);
                    }}
                    className="text-emerald-700 hover:underline font-medium text-base cursor-pointer"
                  >
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
        <div className="flex items-center justify-center gap-4 text-xs text-stone-600 pt-2 flex-wrap">
          <a href="/manuale.html" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline font-semibold">
            Manuale illustrato (PDF)
          </a>
          <span>•</span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline">
            Informativa sulla Privacy
          </a>
          <span>•</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-700 underline">
            Termini di Servizio
          </a>
        </div>
        <p className="text-sm font-medium text-stone-700 pt-2">
          {t('createdBylabel')}{' '}
          <a href="https://sititicino.ch/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-semibold">
            Connect &amp; Create
          </a>
        </p>
      </footer>

      {showLoginModal && (
        <AuthModal
          mode={mode}
          setMode={setMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          errorMsg={errorMsg}
          infoMsg={infoMsg}
          clearMessages={() => {
            setErrorMsg(null);
            setInfoMsg(null);
          }}
          submitting={submitting}
          onGoogleLogin={handleGoogleLogin}
          onEmailLogin={handleEmailLogin}
          onRegister={handleRegister}
          onForgot={handleForgot}
          onClose={() => setShowLoginModal(false)}
          t={t}
        />
      )}
    </div>
  );
}
