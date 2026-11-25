import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Search, History, BookOpen, List } from 'lucide-react';
import { Archive, Template } from '../types';
import { fetchEmbeddings, fetchSummary, SummarizeSource } from '../utils/api';
import { Button, EmptyState } from './ui';
import { buildHeader } from '../utils/chunk';
import { useTranslation } from '../utils/i18n';
import { SuggestionsBox } from './SuggestionsBox';
import templatesData from '../templates.json';

const templates = templatesData as Template[];

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export const SearchTab = ({
  archive,
  onOpenRec,
  onGoData,
  updateArchive,
}: {
  archive: Archive;
  onOpenRec: (id: string) => void;
  onGoData: () => void;
  updateArchive: (fn: (a: Archive) => Archive) => void;
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tipo, setTipo] = useState('');
  const [tag, setTag] = useState('');
  const [results, setResults] = useState<{ id: string; score: number; chunkText: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topN, setTopN] = useState(10);
  const [recent, setRecent] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'summary' | 'list'>('summary');
  const [summaryData, setSummaryData] = useState<{
    markdown: string;
    sources: { n: number; id: string; titolo: string }[];
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const summaryAbortController = useRef<AbortController | null>(null);
  const queryCache = useRef<{ key: string; vec: number[] } | null>(null);
  const summaryCache = useRef<
    Map<string, { markdown: string; sources: { n: number; id: string; titolo: string }[] }>
  >(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      abortController.current?.abort();
      summaryAbortController.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tcm_recent_searches');
      if (saved) setRecent(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  const saveRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, 5);
      try {
        localStorage.setItem('tcm_recent_searches', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem('tcm_recent_searches');
    } catch {
      // ignore
    }
  };

  const templateNameMap = useMemo(() => new Map(templates.map((tpl) => [tpl.id, tpl.name])), []);
  const allTipi = useMemo(() => Array.from(new Set(archive.records.map((r) => r.tipo).filter(Boolean))), [archive.records]);
  const allTags = useMemo(() => Array.from(new Set(archive.records.flatMap((r) => r.tags))), [archive.records]);
  const validRecords = useMemo(() => archive.records.filter((r) => r.chunks.length > 0), [archive.records]);

  const filteredRecords = useMemo(() => {
    return validRecords.filter((r) => {
      const matchesTipo = !tipo || r.tipo === tipo;
      const matchesTag = !tag || r.tags.includes(tag);
      return matchesTipo && matchesTag;
    });
  }, [validRecords, tipo, tag]);

  const lexicalSearch = useCallback(
    (q: string): { id: string; score: number; chunkText: string }[] => {
      const normalizedQuery = normalizeText(q.trim());
      const words = normalizedQuery.split(/\s+/).filter(Boolean);
      if (words.length === 0) return [];

      const matches: { id: string; score: number; chunkText: string }[] = [];
      for (const r of archive.records) {
        if (tipo && r.tipo !== tipo) continue;
        if (tag && !r.tags.includes(tag)) continue;

        const campiList = Object.values(r.campi || {})
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .filter(Boolean);
        const campiValues = campiList.join(' ');
        const campiSnippet = campiList.filter((v) => String(v).trim() !== (r.titolo || '').trim()).join(' · ');
        const titleNorm = normalizeText(r.titolo || '');
        const fullTextNorm = normalizeText(`${r.titolo || ''} ${r.contenuto || ''} ${(r.tags || []).join(' ')} ${campiValues}`);

        const titleMatch = titleNorm.includes(normalizedQuery);
        const allWordsMatch = words.every((w) => fullTextNorm.includes(w));
        if (titleMatch || allWordsMatch) {
          matches.push({
            id: r.id,
            score: titleMatch ? 0.9 : 0.6,
            chunkText: r.contenuto || campiSnippet,
          });
        }
      }
      return matches;
    },
    [archive.records, tipo, tag]
  );

  const generateSummary = useCallback(
    async (q: string, searchResults: { id: string; score: number; chunkText: string }[]) => {
      const trimmed = q.trim();
      if (!trimmed || searchResults.length === 0) {
        setSummaryData(null);
        setSummaryError(false);
        setSummaryLoading(false);
        return;
      }

      const topEntries = searchResults
        .slice(0, 6)
        .map((res) => {
          const rec = archive.records.find((r) => r.id === res.id);
          return rec ? { res, rec } : null;
        })
        .filter(
          (x): x is { res: { id: string; score: number; chunkText: string }; rec: Archive['records'][number] } =>
            x !== null
        );

      if (topEntries.length === 0) {
        setSummaryData(null);
        setSummaryError(false);
        setSummaryLoading(false);
        return;
      }

      const cacheKey = `${trimmed.toLowerCase()}::${topEntries
        .map(({ rec }) => `${rec.id}@${rec.modificato}`)
        .join('|')}`;

      const cached = summaryCache.current.get(cacheKey);
      if (cached) {
        setSummaryData(cached);
        setSummaryError(false);
        setSummaryLoading(false);
        return;
      }

      summaryAbortController.current?.abort();
      const controller = new AbortController();
      summaryAbortController.current = controller;

      const apiSources: SummarizeSource[] = [];
      const uiSources: { n: number; id: string; titolo: string }[] = [];

      topEntries.forEach(({ res, rec }) => {
        const header = buildHeader(rec);
        const rawText = (res.chunkText || rec.contenuto || header || rec.titolo || '').trim();
        if (!rawText) return;
        const n = apiSources.length + 1;
        const titolo = (rec.titolo || 'Senza titolo').trim();
        const campo = (templateNameMap.get(rec.tipo) || rec.tipo || 'Scheda').trim();
        apiSources.push({
          n,
          titolo: titolo.slice(0, 300),
          campo: campo.slice(0, 200),
          testo: rawText.slice(0, 1500),
        });
        uiSources.push({ n, id: rec.id, titolo });
      });

      if (apiSources.length === 0) {
        setSummaryData(null);
        setSummaryError(false);
        setSummaryLoading(false);
        return;
      }

      setSummaryLoading(true);
      setSummaryError(false);

      try {
        const resp = await fetchSummary(trimmed.slice(0, 500), apiSources, controller.signal);
        if (controller.signal.aborted) return;
        const entry = { markdown: resp.markdown, sources: uiSources };
        summaryCache.current.set(cacheKey, entry);
        setSummaryData(entry);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setSummaryData(null);
        setSummaryError(true);
      } finally {
        if (!controller.signal.aborted) {
          setSummaryLoading(false);
        }
      }
    },
    [archive.records, templateNameMap]
  );

  const performSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      setError(null);
      saveRecent(trimmed);

      const lexical = lexicalSearch(trimmed);
      if (filteredRecords.length === 0) {
        const lexicalSorted = lexical.sort((a, b) => b.score - a.score);
        setLoading(false);
        setResults(lexicalSorted);
        void generateSummary(trimmed, lexicalSorted);
        return;
      }

      setLoading(true);
      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      try {
        const cacheKey = `${archive.model}\0${trimmed}`;
        let vec: number[];
        let expectedDim = archive.dim;

        if (queryCache.current?.key === cacheKey) {
          vec = queryCache.current.vec;
          expectedDim = vec.length;
        } else {
          const resp = await fetchEmbeddings([trimmed], 'query', abortController.current.signal, archive.model);
          vec = resp.vectors[0];
          expectedDim = resp.dim;
          queryCache.current = { key: cacheKey, vec };
        }

        const merged = new Map<string, { id: string; score: number; chunkText: string }>();
        for (const item of lexical) {
          merged.set(item.id, item);
        }

        const normalizedQuery = normalizeText(trimmed);

        for (const r of filteredRecords) {
          let bestChunkScore = -1;
          let bestChunkText = '';

          for (const chunk of r.chunks) {
            if (chunk.embedding.length !== expectedDim) continue;
            const score = cosineSimilarity(vec, chunk.embedding);
            if (score > bestChunkScore) {
              bestChunkScore = score;
              bestChunkText = chunk.testo;
            }
          }

          if (bestChunkScore !== -1) {
            const titleNormalized = normalizeText(r.titolo);
            const tagsNormalized = r.tags.map(normalizeText);
            const hasMatch = titleNormalized.includes(normalizedQuery) || tagsNormalized.some((tg) => tg.includes(normalizedQuery));
            const finalScore = bestChunkScore + (hasMatch ? 0.05 : 0);
            const existing = merged.get(r.id);
            if (!existing || finalScore > existing.score) {
              merged.set(r.id, { id: r.id, score: finalScore, chunkText: bestChunkText });
            }
          }
        }

        const newResults = Array.from(merged.values()).sort((a, b) => b.score - a.score);
        setResults(newResults);
        void generateSummary(trimmed, newResults);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          const lexicalSorted = lexical.sort((a, b) => b.score - a.score);
          setResults(lexicalSorted);
          setError('Ricerca semantica temporaneamente non disponibile: mostrati i risultati testuali.');
          void generateSummary(trimmed, lexicalSorted);
        }
      } finally {
        setLoading(false);
      }
    },
    [archive.model, archive.dim, filteredRecords, lexicalSearch, saveRecent, generateSummary]
  );

  const handleSearch = () => performSearch(query);

  useEffect(() => {
    if (results !== null && query.trim().length >= 2) {
      void performSearch(query);
    }
  }, [tipo, tag]);

  const displayedResults = results?.slice(0, topN);

  const getRelevanceText = (score: number) => {
    if (score >= 0.75) return { label: t('veryRelevant'), cls: 'text-emerald-700 dark:text-emerald-400' };
    if (score >= 0.55) return { label: t('relevant'), cls: 'text-blue-700 dark:text-blue-400' };
    return { label: t('possibleRelevant'), cls: 'text-amber-700 dark:text-amber-400' };
  };

  if (archive.records.length === 0) {
    return <EmptyState icon={Search} title={t('noIndexedVoices')} text={t('noIndexedSub')} action={{ label: t('goToData'), onClick: onGoData }} />;
  }

  return (
    <div className="space-y-6 text-text-primary text-base">
      <div className="space-y-3">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                summaryAbortController.current?.abort();
                setSummaryData(null);
                setSummaryError(false);
                setSummaryLoading(false);
                if (val.trim().length >= 2) {
                  setError(null);
                  setResults(lexicalSearch(val).sort((a, b) => b.score - a.score));
                } else {
                  setResults(null);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              placeholder="Cerca una scheda per nome o significato"
              className="w-full pl-4 pr-10 py-3 text-base rounded-xl border border-border-primary bg-card-bg text-text-primary focus:ring-2 focus:ring-accent focus:outline-none min-h-[44px]"
            />
            {query && (
              <button
                onClick={() => {
                  summaryAbortController.current?.abort();
                  setQuery('');
                  setResults(null);
                  setSummaryData(null);
                  setSummaryError(false);
                  setSummaryLoading(false);
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/50 hover:text-text-primary px-1.5 py-0.5 text-sm font-bold"
                title="Cancella ricerca"
              >
                ✕
              </button>
            )}
          </div>
          <Button onClick={handleSearch} loading={loading} icon={Search} className="px-6 min-h-[44px] text-base font-semibold whitespace-nowrap shrink-0">
            {t('searchBtn')}
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted pt-1">
              <span className="font-medium flex items-center gap-1">
                <History size={14} className="text-text-muted/50" /> {t('recentSearches')}:
              </span>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setQuery(r);
                    void performSearch(r);
                  }}
                  className="px-2.5 py-0.5 bg-card-bg hover:bg-bg-alt rounded border border-border-primary text-xs"
                >
                  {r}
                </button>
              ))}
              <button onClick={clearRecent} className="text-xs text-red-600 hover:underline ml-2">
                {t('clearHistory')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border-primary text-sm bg-card-bg text-text-primary min-h-[40px]"
        >
          <option value="">{t('allTypes')}</option>
          {allTipi.map((tp) => (
            <option key={tp} value={tp}>
              {templateNameMap.get(tp) || tp}
            </option>
          ))}
        </select>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="px-3 py-2 rounded-xl border border-border-primary text-sm bg-card-bg text-text-primary min-h-[40px]"
        >
          <option value="">{t('allTags')}</option>
          {allTags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900">{error}</div>}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 bg-card-bg rounded-2xl border border-border-primary shadow-sm animate-pulse space-y-3">
              <div className="h-5 bg-bg-alt rounded w-1/3" />
              <div className="h-4 bg-bg-alt/50 rounded w-full" />
              <div className="h-4 bg-bg-alt/50 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {results !== null && results.length === 0 && !loading && (
        <div className="p-8 bg-card-bg rounded-2xl border border-border-primary text-center space-y-3">
          <p className="font-semibold text-text-primary text-lg">{t('noResults')}</p>
          <p className="text-text-muted text-sm">{t('noResultsSuggestions')}</p>
        </div>
      )}

      {results === null && !loading && <SuggestionsBox archive={archive} onOpenRec={onOpenRec} updateArchive={updateArchive} t={t} />}

      {displayedResults && displayedResults.length > 0 && !loading && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex bg-bg-alt p-1 rounded-xl border border-border-primary">
              <button
                type="button"
                onClick={() => {
                  setViewMode('summary');
                  if (!summaryData && !summaryLoading && !summaryError && results && results.length > 0) {
                    void generateSummary(query, results);
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  viewMode === 'summary'
                    ? 'bg-card-bg text-accent shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <BookOpen size={15} />
                Riassunto
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-card-bg text-accent shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <List size={15} />
                Elenco risultati ({results?.length || 0})
              </button>
            </div>
          </div>

          {viewMode === 'summary' && summaryLoading && (
            <div className="p-6 md:p-8 bg-card-bg rounded-2xl border border-border-primary shadow-sm animate-pulse space-y-4">
              <div className="h-7 bg-bg-alt rounded w-2/5" />
              <div className="h-4 bg-bg-alt/60 rounded w-1/3" />
              <div className="h-5 bg-bg-alt rounded w-1/4 mt-6" />
              <div className="h-4 bg-bg-alt/50 rounded w-full" />
              <div className="h-4 bg-bg-alt/50 rounded w-11/12" />
              <div className="h-4 bg-bg-alt/50 rounded w-4/5" />
            </div>
          )}

          {viewMode === 'summary' && !summaryLoading && summaryData && !summaryError && (() => {
            const sourceMap = new Map(summaryData.sources.map((s) => [s.n, s]));

            const renderInlineText = (text: string): React.ReactNode[] => {
              const tokens = text.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g);
              return tokens.map((tok, idx) => {
                if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
                  return <strong key={idx} className="font-semibold">{renderInlineText(tok.slice(2, -2))}</strong>;
                }
                const citeMatch = tok.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
                if (citeMatch) {
                  const nums = citeMatch[1].split(',').map((n) => parseInt(n.trim(), 10));
                  return (
                    <span key={idx} className="inline-flex items-baseline">
                      {nums.map((num, nIdx) => {
                        const src = sourceMap.get(num);
                        if (!src) {
                          return <span key={nIdx} className="text-text-muted text-xs">[{num}]</span>;
                        }
                        return (
                          <button
                            key={nIdx}
                            type="button"
                            onClick={() => onOpenRec(src.id)}
                            title={`Apri scheda: ${src.titolo}`}
                            className="inline-flex items-center align-super text-[11px] font-bold text-accent hover:underline mx-0.5 cursor-pointer"
                          >
                            [{num}]
                          </button>
                        );
                      })}
                    </span>
                  );
                }
                return <React.Fragment key={idx}>{tok}</React.Fragment>;
              });
            };

            const lines = summaryData.markdown.replace(/\r\n/g, '\n').split('\n');
            const blocks: React.ReactNode[] = [];
            let paragraphLines: string[] = [];
            let listItems: { ordered: boolean; text: string }[] = [];

            const flushParagraph = () => {
              if (paragraphLines.length === 0) return;
              const text = paragraphLines.join(' ').trim();
              if (text) {
                blocks.push(
                  <p key={`p-${blocks.length}`} className="text-text-primary leading-relaxed mb-3.5 text-base">
                    {renderInlineText(text)}
                  </p>
                );
              }
              paragraphLines = [];
            };

            const flushList = () => {
              if (listItems.length === 0) return;
              const isOrdered = listItems[0].ordered;
              const Tag = isOrdered ? 'ol' : 'ul';
              blocks.push(
                <Tag
                  key={`list-${blocks.length}`}
                  className={`${isOrdered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 mb-4 text-text-primary leading-relaxed text-base`}
                >
                  {listItems.map((item, i) => (
                    <li key={i}>{renderInlineText(item.text)}</li>
                  ))}
                </Tag>
              );
              listItems = [];
            };

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line) {
                flushParagraph();
                flushList();
                continue;
              }
              if (line.startsWith('### ')) {
                flushParagraph();
                flushList();
                blocks.push(
                  <h4 key={`h4-${blocks.length}`} className="font-serif text-lg font-bold text-text-primary mt-5 mb-2">
                    {renderInlineText(line.slice(4))}
                  </h4>
                );
                continue;
              }
              if (line.startsWith('## ')) {
                flushParagraph();
                flushList();
                blocks.push(
                  <h3
                    key={`h3-${blocks.length}`}
                    className="font-serif text-xl font-bold text-text-primary border-b border-border-primary pb-1.5 mt-6 mb-3"
                  >
                    {renderInlineText(line.slice(3))}
                  </h3>
                );
                continue;
              }
              if (line.startsWith('# ')) {
                flushParagraph();
                flushList();
                blocks.push(
                  <h2
                    key={`h2-${blocks.length}`}
                    className="font-serif text-2xl font-bold text-text-primary border-b border-border-primary pb-2 mt-4 mb-3"
                  >
                    {renderInlineText(line.slice(2))}
                  </h2>
                );
                continue;
              }
              const ulMatch = line.match(/^[-*]\s+(.+)$/);
              if (ulMatch) {
                flushParagraph();
                if (listItems.length > 0 && listItems[0].ordered) flushList();
                listItems.push({ ordered: false, text: ulMatch[1] });
                continue;
              }
              const olMatch = line.match(/^\d+\.\s+(.+)$/);
              if (olMatch) {
                flushParagraph();
                if (listItems.length > 0 && !listItems[0].ordered) flushList();
                listItems.push({ ordered: true, text: olMatch[1] });
                continue;
              }
              flushList();
              paragraphLines.push(line);
            }
            flushParagraph();
            flushList();

            return (
              <article className="p-6 md:p-8 bg-card-bg rounded-2xl border border-border-primary shadow-sm">
                <header className="border-b border-border-primary pb-4 mb-5">
                  <h2 className="font-serif text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
                    {query.trim()}
                  </h2>
                  <p className="text-xs text-text-muted mt-1">
                    Sintesi enciclopedica generata esclusivamente da {summaryData.sources.length}{' '}
                    {summaryData.sources.length === 1 ? 'scheda' : 'schede'} dell&apos;archivio
                  </p>
                </header>

                <div>{blocks}</div>

                <footer className="border-t border-border-primary pt-4 mt-6">
                  <h4 className="font-serif font-bold text-base text-text-primary mb-2.5">Fonti</h4>
                  <ol className="space-y-1.5 text-sm">
                    {summaryData.sources.map((src) => (
                      <li key={`${src.n}-${src.id}`} className="flex items-baseline gap-2">
                        <span className="font-mono text-xs font-bold text-accent shrink-0">[{src.n}]</span>
                        <button
                          type="button"
                          onClick={() => onOpenRec(src.id)}
                          className="text-left text-text-primary hover:text-accent hover:underline font-medium cursor-pointer"
                        >
                          {src.titolo}
                        </button>
                      </li>
                    ))}
                  </ol>
                </footer>
              </article>
            );
          })()}

          {(viewMode === 'list' || summaryError || (!summaryLoading && !summaryData)) && (
            <div className="space-y-4">
              {displayedResults.map((res) => {
                const rec = archive.records.find((r) => r.id === res.id);
                if (!rec) return null;
                const header = buildHeader(rec);
                const snippet = res.chunkText.startsWith(`${header}: `) ? res.chunkText.substring(header.length + 2) : res.chunkText;
                const rel = getRelevanceText(res.score);

                return (
                  <div
                    key={res.id}
                    onClick={() => onOpenRec(res.id)}
                    className="p-5 bg-card-bg rounded-2xl border border-border-primary shadow-sm cursor-pointer hover:border-accent transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap justify-between items-baseline gap-3">
                      <h4 className="font-serif font-bold text-lg text-text-primary">{rec.titolo}</h4>
                      <div className="flex items-center gap-2 text-xs text-text-muted tabular-nums shrink-0">
                        <span className={`font-semibold ${rel.cls}`}>{rel.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{templateNameMap.get(rec.tipo) || rec.tipo}</span>
                      </div>
                    </div>
                    {rec.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                        {rec.tags.map((tg, idx) => (
                          <React.Fragment key={tg}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>#{tg}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {snippet && snippet.trim() !== rec.titolo.trim() && (
                      <p className="text-text-muted line-clamp-3 text-base leading-relaxed">{snippet}</p>
                    )}
                  </div>
                );
              })}
              {results && results.length > topN && (
                <Button onClick={() => setTopN(topN + 10)} variant="secondary" className="w-full py-3 text-base font-semibold">
                  {t('showMore10')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
