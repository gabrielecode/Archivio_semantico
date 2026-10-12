import {useState, useMemo, useEffect, useRef} from 'react';
import {Archive} from '../types';
import {Button} from './ui';
import {needsEmbedding, embedRecords} from '../utils/embed';
import {useTranslation} from '../utils/i18n';

export function EmbedBar({archive, user, onNeedLogin, onApply, toast}: {
    archive: Archive, user: {id: string, name: string} | null, onNeedLogin: () => void, onApply: (results: any) => void, toast: (msg: string, type: 'success' | 'error') => void
}) {
    const {t} = useTranslation();
    const pending = useMemo(() => archive.records.filter(needsEmbedding).length, [archive.records]);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const abortController = useRef<AbortController | null>(null);
    const autoRunTimer = useRef<any>(null);
    const lastRunRef = useRef<number>(0);

    useEffect(() => {
        return () => {
            abortController.current?.abort();
            if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
        };
    }, []);

    const runEmbed = async (force: boolean) => {
        if (!user) {
            onNeedLogin();
            return;
        }

        if (running) return;

        setRunning(true);
        setProgress(0);
        setTotal(0);
        abortController.current = new AbortController();

        const {results, errore} = await embedRecords(archive.records, (d, t) => {
            setProgress(d);
            setTotal(t);
        }, abortController.current.signal, force);

        setRunning(false);
        if (results.length > 0) {
            onApply(results);
        }

        if (errore) {
            toast(t('connectionError'), 'error');
            setTimeout(() => {
                if (pending > 0 && user && !running) {
                    runEmbed(false);
                }
            }, 10000);
        }
    };

    useEffect(() => {
        if (pending > 0 && user && !running) {
            if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
            autoRunTimer.current = setTimeout(() => {
                const now = Date.now();
                if (now - lastRunRef.current > 4000) {
                    lastRunRef.current = now;
                    runEmbed(false);
                }
            }, 3000);
        }
        return () => {
            if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
        };
    }, [pending, user]);

    return (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm text-stone-800">
            <div className="flex items-center gap-3">
                {pending > 0 ? (
                    <span className="font-medium text-emerald-900">
                        {running ? `${t('preparingSearch')}: ${progress} su ${total}` : `${pending} ${t('voicesToPrepare')}`}
                    </span>
                ) : (
                    <span className="font-semibold text-emerald-800">{t('searchReady')}</span>
                )}
                {running && (
                    <div className="w-32 bg-emerald-200 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-700 h-full transition-all duration-300" style={{width: `${total > 0 ? (progress / total) * 100 : 0}%`}} />
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                {pending > 0 && !running && (
                    <Button variant="primary" onClick={() => runEmbed(false)} className="text-sm py-1.5 px-3 min-h-[36px]">
                        {t('prepareNow')}
                    </Button>
                )}
                {running && (
                    <Button variant="danger" onClick={() => abortController.current?.abort()} className="text-sm py-1.5 px-3 min-h-[36px]">
                        {t('cancel')}
                    </Button>
                )}
            </div>
        </div>
    );
}

