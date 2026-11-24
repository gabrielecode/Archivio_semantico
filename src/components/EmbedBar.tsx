import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Archive, EMBEDDING_MODELS, EmbeddingModelOption } from '../types';
import { Button } from './ui';
import { needsEmbedding, embedRecords } from '../utils/embed';
import { fetchEmbedHealth } from '../utils/api';
import { useTranslation } from '../utils/i18n';

export function EmbedBar({
  archive,
  user,
  onNeedLogin,
  onApply,
  onChangeModel,
  toast,
}: {
  archive: Archive;
  user: { id: string; name: string } | null;
  onNeedLogin: () => void;
  onApply: (results: any, model?: string, dim?: number) => void;
  onChangeModel?: (modelId: string) => void;
  toast: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const pending = useMemo(
    () => archive.records.filter((r) => needsEmbedding(r, archive.dim)).length,
    [archive.records, archive.dim]
  );
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [models, setModels] = useState<EmbeddingModelOption[]>(EMBEDDING_MODELS);
  const [serviceReady, setServiceReady] = useState(true);
  const abortController = useRef<AbortController | null>(null);
  const autoRunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchEmbedHealth(controller.signal).then((health) => {
      setServiceReady(health.embed);
      if (health.models.length > 0) {
        setModels(health.models);
      }
    });
    return () => {
      controller.abort();
      abortController.current?.abort();
      if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
    };
  }, []);

  useEffect(() => {
    if (pending === 0) {
      setFailed(false);
    }
  }, [pending]);

  const runEmbed = useCallback(
    async (force: boolean) => {
      if (!user) {
        onNeedLogin();
        return;
      }
      if (running || !serviceReady) return;

      setRunning(true);
      setProgress(0);
      setTotal(0);
      abortController.current = new AbortController();

      const { results, model, dim, errore } = await embedRecords(
        archive.records,
        (d, tot) => {
          setProgress(d);
          setTotal(tot);
        },
        abortController.current.signal,
        {
          force,
          model: archive.model,
          expectedDim: archive.dim,
        }
      );

      setRunning(false);
      if (results.length > 0) {
        onApply(results, model, dim);
      }

      if (errore) {
        setFailed(true);
        toast(errore, 'error');
      }
    },
    [archive.records, archive.model, archive.dim, user, running, serviceReady, onNeedLogin, onApply, toast]
  );

  useEffect(() => {
    if (pending > 0 && user && !running && !failed && serviceReady) {
      if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
      autoRunTimer.current = setTimeout(() => {
        const now = Date.now();
        if (now - lastRunRef.current > 4000) {
          lastRunRef.current = now;
          void runEmbed(false);
        }
      }, 3000);
    }
    return () => {
      if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
    };
  }, [pending, user, running, failed, serviceReady, runEmbed]);

  return (
    <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900/60 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm text-text-primary">
      <div className="flex flex-wrap items-center gap-3">
        {!serviceReady ? (
          <span className="font-medium text-amber-800 dark:text-amber-300">
            Servizio embedding non configurato sul server
          </span>
        ) : pending > 0 ? (
          <span className="font-medium text-emerald-900 dark:text-emerald-200 tabular-nums">
            {running ? `${t('preparingSearch')}: ${progress} su ${total}` : `${pending} ${t('voicesToPrepare')}`}
          </span>
        ) : (
          <span className="font-semibold text-emerald-800 dark:text-emerald-300">{t('searchReady')}</span>
        )}
        {running && (
          <div className="w-32 bg-emerald-200 dark:bg-emerald-900 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-700 dark:bg-emerald-400 h-full transition-all duration-300"
              style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onChangeModel && (
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <span className="hidden sm:inline">Modello:</span>
            <select
              aria-label="Modello embedding OpenRouter"
              value={archive.model}
              disabled={running}
              onChange={(e) => {
                abortController.current?.abort();
                setFailed(false);
                onChangeModel(e.target.value);
              }}
              className="px-2.5 py-1 rounded-lg border border-border-primary bg-card-bg text-text-primary text-xs font-medium min-h-[32px] disabled:opacity-50"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {pending > 0 && !running && serviceReady && (
          <Button
            variant="primary"
            onClick={() => {
              setFailed(false);
              void runEmbed(false);
            }}
            className="text-sm py-1.5 px-3 min-h-[36px] whitespace-nowrap shrink-0"
          >
            {failed ? 'Riprova' : t('prepareNow')}
          </Button>
        )}
        {running && (
          <Button
            variant="danger"
            onClick={() => abortController.current?.abort()}
            className="text-sm py-1.5 px-3 min-h-[36px] whitespace-nowrap shrink-0"
          >
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
