import {useState, useMemo, useEffect, useRef} from 'react';
import {Archive, Rec} from '../types';
import {Button} from './ui';
import {needsEmbedding, embedRecords} from '../utils/embed';
import {calculateEmbHash} from '../utils/chunk';
import {Loader2, AlertCircle} from 'lucide-react';

export function EmbedBar({archive, user, onNeedLogin, onApply, toast}: {
    archive: Archive, user: {id: string, name: string} | null, onNeedLogin: () => void, onApply: (results: any) => void, toast: (msg: string, type: 'success' | 'error') => void
}) {
    const pending = useMemo(() => archive.records.filter(needsEmbedding).length, [archive.records]);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const abortController = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => abortController.current?.abort();
    }, []);

    const runEmbed = async (force: boolean) => {
        if (!user) {
            onNeedLogin();
            return;
        }

        setRunning(true);
        setProgress(0);
        setTotal(0);
        abortController.current = new AbortController();

        const {results, errore} = await embedRecords(archive.records, (d, t) => {
            setProgress(d);
            setTotal(t);
        }, abortController.current.signal, force);

        setRunning(false);
        onApply(results);

        if (errore) {
            toast(`${errore} - indicizzate ${results.length}, riprova per continuare`, 'error');
        } else {
            toast(`Indicizzate ${results.length} voci`, 'success');
        }
    };

    return (
        <div className="bg-emerald-50 border-b border-emerald-200 p-2 flex items-center justify-between">
            <div className="text-sm">
                {pending > 0 ? `${pending} voci da indicizzare` : 'Tutte le voci sono indicizzate'}
                {running && ` (${progress} / ${total})`}
            </div>
            <div className="flex gap-2">
                {!running ? (
                    <>
                        <Button variant="secondary" onClick={() => runEmbed(false)} disabled={pending === 0}>Genera embedding</Button>
                        <Button variant="ghost" onClick={() => confirm('Consuma quota API per tutte le voci') && runEmbed(true)}>Reindicizza tutto</Button>
                    </>
                ) : (
                    <Button variant="destructive" onClick={() => abortController.current?.abort()}>Annulla</Button>
                )}
            </div>
        </div>
    );
}
