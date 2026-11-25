import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Rec } from '../types';
import { Button, inputCls } from './ui';
import { CheckCheck, Plus, RefreshCw, ScanSearch, Tag, X } from 'lucide-react';
import {
  getRecordTags,
  mergeRecordTags,
  normalizeMtcText,
  suggestTagsForRecord,
} from '../utils/tagSuggestions';

interface TagManagerPanelProps {
  archive: Archive;
  record: Rec;
  onUpdateTags: (nextTags: string[]) => void;
  onToast?: (message: string) => void;
}

export function TagManagerPanel({
  archive,
  record,
  onUpdateTags,
  onToast,
}: TagManagerPanelProps) {
  const [manualInput, setManualInput] = useState('');
  const [dismissedNorms, setDismissedNorms] = useState<string[]>([]);
  const [scanNotice, setScanNotice] = useState<string | null>(null);

  useEffect(() => {
    setDismissedNorms([]);
    setScanNotice(null);
    setManualInput('');
  }, [record.id]);

  const currentTags = useMemo(() => getRecordTags(record), [record]);

  const allSuggestions = useMemo(() => {
    return suggestTagsForRecord(record, archive, 12);
  }, [record, archive]);

  const visibleSuggestions = useMemo(() => {
    const dismissedSet = new Set(dismissedNorms);
    return allSuggestions.filter((s) => !dismissedSet.has(normalizeMtcText(s.tag)));
  }, [allSuggestions, dismissedNorms]);

  const hasAnalyzableText = useMemo(() => {
    const hasTitle = Boolean(record.titolo?.trim());
    const hasBody = Boolean(record.contenuto?.trim() || record.fonte?.trim());
    const hasCampi = Object.values(record.campi || {}).some((v) => {
      if (Array.isArray(v)) return v.some((item) => String(item ?? '').trim() !== '');
      return typeof v === 'string' && v.trim() !== '';
    });
    return hasTitle || hasBody || hasCampi;
  }, [record.titolo, record.contenuto, record.fonte, record.campi]);

  const handleAddManualTags = () => {
    const parts = manualInput
      .split(/[;,]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    const merged = mergeRecordTags(currentTags, parts);
    if (merged.length === currentTags.length) {
      setManualInput('');
      return;
    }

    onUpdateTags(merged);
    setManualInput('');
    setScanNotice(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const normRemove = normalizeMtcText(tagToRemove);
    const next = currentTags.filter((t) => normalizeMtcText(t) !== normRemove);
    onUpdateTags(next);
  };

  const handleAcceptSuggestion = (tag: string) => {
    const next = mergeRecordTags(currentTags, [tag]);
    onUpdateTags(next);
    setScanNotice(null);
  };

  const handleAcceptAll = () => {
    if (visibleSuggestions.length === 0) return;
    const next = mergeRecordTags(
      currentTags,
      visibleSuggestions.map((s) => s.tag)
    );
    const addedCount = next.length - currentTags.length;
    onUpdateTags(next);
    setScanNotice(null);
    if (addedCount > 0) {
      onToast?.(`Aggiunti ${addedCount} tag suggeriti`);
    }
  };

  const handleDismissSuggestion = (tag: string) => {
    const norm = normalizeMtcText(tag);
    setDismissedNorms((prev) => (prev.includes(norm) ? prev : [...prev, norm]));
  };

  const handleAnalyzeClick = () => {
    setDismissedNorms([]);
    if (allSuggestions.length === 0) {
      setScanNotice('Nessun nuovo tag pertinente rilevato dal contenuto');
    } else {
      setScanNotice(
        allSuggestions.length === 1
          ? 'Trovato 1 tag coerente con la nomenclatura MTC'
          : `Trovati ${allSuggestions.length} tag coerenti con la nomenclatura MTC`
      );
    }
  };

  return (
    <div className="bg-card-bg rounded-[2.5rem] p-8 border border-border-primary shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bg-alt rounded-lg flex items-center justify-center text-accent">
            <Tag size={18} />
          </div>
          <div>
            <h3 className="font-bold text-text-primary tracking-tight">Tag &amp; Nomenclatura MTC</h3>
            <p className="text-xs text-text-muted">
              Analisi automatica su termini, sindromi, organi e tag presenti nell&apos;archivio
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={ScanSearch}
          onClick={handleAnalyzeClick}
          title="Rianalizza il contenuto della scheda rispetto alla nomenclatura MTC dell'archivio"
        >
          Analizza contenuto
        </Button>
      </div>

      {/* Active tags */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Tag attivi ({currentTags.length})
          </span>
        </div>

        {currentTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-alt text-text-primary border border-border-primary"
              >
                <span className="text-accent font-bold">#</span>
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-0.5 p-0.5 rounded-md text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  aria-label={`Rimuovi tag ${tag}`}
                  title={`Rimuovi tag "${tag}"`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">
            Nessun tag assegnato a questa scheda.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddManualTags();
              }
            }}
            placeholder="Aggiungi tag manualmente (separati da virgola)..."
            className={`${inputCls} py-2.5 flex-1`}
          />
          <Button
            variant="secondary"
            size="md"
            icon={Plus}
            onClick={handleAddManualTags}
            disabled={!manualInput.trim()}
            className="sm:w-auto"
          >
            Aggiungi
          </Button>
        </div>
      </div>

      {/* Suggestions */}
      <div className="border-t border-border-primary pt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Tag suggeriti ({visibleSuggestions.length})
          </span>
          <div className="flex items-center gap-2">
            {dismissedNorms.length > 0 && (
              <button
                type="button"
                onClick={() => setDismissedNorms([])}
                className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-bg-alt"
              >
                <RefreshCw size={12} />
                Ripristina scartati ({dismissedNorms.length})
              </button>
            )}
            {visibleSuggestions.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                icon={CheckCheck}
                onClick={handleAcceptAll}
              >
                Aggiungi tutti ({visibleSuggestions.length})
              </Button>
            )}
          </div>
        </div>

        {scanNotice && (
          <p className="text-xs font-medium text-accent bg-accent/10 border border-accent/20 rounded-xl px-3 py-2">
            {scanNotice}
          </p>
        )}

        {visibleSuggestions.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {visibleSuggestions.map((item) => (
              <div
                key={item.tag}
                className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-bg-alt/70 border border-border-primary hover:border-accent/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleAcceptSuggestion(item.tag)}
                  className="flex-1 min-w-0 text-left flex items-start gap-2 group cursor-pointer"
                  title={`Aggiungi tag "${item.tag}"`}
                >
                  <span className="mt-0.5 w-5 h-5 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <Plus size={13} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary group-hover:text-accent truncate transition-colors">
                      {item.tag}
                    </span>
                    <span className="block text-[11px] text-text-muted truncate">
                      {item.reason}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDismissSuggestion(item.tag)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-bg transition-colors shrink-0"
                  aria-label={`Ignora suggerimento ${item.tag}`}
                  title="Ignora suggerimento"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">
            {!hasAnalyzableText
              ? 'Compila titolo, campi MTC o contenuto per suggerire tag coerenti con la nomenclatura dell’archivio.'
              : archive.records.length === 0
                ? 'Aggiungi altre schede o tag nell’archivio per popolare la nomenclatura MTC di riferimento.'
                : 'Nessun nuovo tag suggerito: i termini MTC rilevati sono già presenti nei tag della scheda.'}
          </p>
        )}
      </div>
    </div>
  );
}
