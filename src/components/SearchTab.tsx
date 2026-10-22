import React, {useState, useRef, useMemo, useEffect} from 'react';
import {Search, History, Sparkles} from 'lucide-react';
import {Archive, EMB_DIM} from '../types';
import {fetchEmbeddings} from '../utils/api';
import {Button, EmptyState} from './ui';
import {buildHeader} from '../utils/chunk';
import {useTranslation} from '../utils/i18n';
import {SuggestionsBox} from './SuggestionsBox';

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

export const SearchTab = ({archive, onOpenRec, onGoData, updateArchive}: {archive: Archive, onOpenRec: (id: string) => void, onGoData: () => void, updateArchive: (fn: (a: Archive) => Archive) => void}) => {
    const {t} = useTranslation();
    const [query, setQuery] = useState('');
    const [tipo, setTipo] = useState('');
    const [tag, setTag] = useState('');
    const [results, setResults] = useState<{id: string, score: number, chunkText: string}[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topN, setTopN] = useState(10);
    const [recent, setRecent] = useState<string[]>([]);
    const abortController = useRef<AbortController | null>(null);
    const queryCache = useRef<{q: string, vec: number[]} | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        try {
            const saved = localStorage.getItem('tcm_recent_searches');
            if (saved) setRecent(JSON.parse(saved));
        } catch {
            // ignore
        }
    }, []);

    const saveRecent = (q: string) => {
        if (!q.trim()) return;
        const next = [q, ...recent.filter(x => x !== q)].slice(0, 5);
        setRecent(next);
        try {
            localStorage.setItem('tcm_recent_searches', JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    const clearRecent = () => {
        setRecent([]);
        try {
            localStorage.removeItem('tcm_recent_searches');
        } catch {
            // ignore
        }
    };

    const examples = [
        'Deficienza di Qi di Milza',
        'Insonnia e calore al cuore',
        'Dolore lombare e freddo',
        'Stasi di Qi di Fegato'
    ];

    const allTags = useMemo(() => Array.from(new Set(archive.records.flatMap(r => r.tags))), [archive]);
    const validRecords = useMemo(() => archive.records.filter(r => r.chunks.length > 0), [archive]);
    
    const filteredRecords = useMemo(() => {
        return validRecords.filter(r => {
            const matchesTipo = !tipo || r.tipo === tipo;
            const matchesTag = !tag || r.tags.includes(tag);
            return matchesTipo && matchesTag;
        });
    }, [validRecords, tipo, tag]);

    const performSearch = async (q: string) => {
        if (q.trim().length < 2) return;
        setLoading(true);
        setError(null);
        saveRecent(q);

        if (abortController.current) abortController.current.abort();
        abortController.current = new AbortController();

        try {
            let vec: number[];
            if (queryCache.current?.q === q) {
                vec = queryCache.current.vec;
            } else {
                const vecs = await fetchEmbeddings([q.trim()], 'query', abortController.current.signal);
                vec = vecs[0];
                queryCache.current = {q, vec};
            }

            const newResults: {id: string, score: number, chunkText: string}[] = [];
            const normalizedQuery = normalizeText(q.trim());

            for (const r of filteredRecords) {
                let bestChunkScore = -1;
                let bestChunkText = '';
                
                for (const chunk of r.chunks) {
                    if (chunk.embedding.length !== EMB_DIM) continue;
                    const score = cosineSimilarity(vec, chunk.embedding);
                    if (score > bestChunkScore) {
                        bestChunkScore = score;
                        bestChunkText = chunk.testo;
                    }
                }

                if (bestChunkScore !== -1) {
                    const titleNormalized = normalizeText(r.titolo);
                    const tagsNormalized = r.tags.map(normalizeText);
                    const hasMatch = titleNormalized.includes(normalizedQuery) || tagsNormalized.some(t => t.includes(normalizedQuery));
                    const finalScore = bestChunkScore + (hasMatch ? 0.05 : 0);
                    newResults.push({id: r.id, score: finalScore, chunkText: bestChunkText});
                }
            }

            newResults.sort((a, b) => b.score - a.score);
            setResults(newResults);
        } catch (e: unknown) {
            if (e instanceof Error && e.name !== 'AbortError') setError(t('connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => performSearch(query);

    useEffect(() => {
        if (queryCache.current?.q === query && queryCache.current?.q) {
            performSearch(query);
        }
    }, [tipo, tag]);

    const displayedResults = results?.slice(0, topN);

    const getRelevanceLabel = (score: number) => {
        if (score >= 0.75) return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">{t('veryRelevant')}</span>;
        if (score >= 0.55) return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">{t('relevant')}</span>;
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{t('possibleRelevant')}</span>;
    };

    if (validRecords.length === 0) return <EmptyState icon={Search} title={t('noIndexedVoices')} text={t('noIndexedSub')} action={{label: t('goToData'), onClick: onGoData}} />;

    return (
        <div className="space-y-6 text-stone-900 text-base">
            <div className="space-y-3">
                <div className="relative flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            ref={searchRef}
                            value={query} 
                            onChange={e => setQuery(e.target.value)} 
                            onKeyDown={e => e.key === 'Enter' && handleSearch()} 
                            placeholder={`${t('searchPlaceholder')} (premi '/' per cercare)`} 
                            className="w-full pl-4 pr-10 py-3 text-base rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-700 focus:outline-none min-h-[44px]" 
                        />
                        {query && (
                            <button 
                                onClick={() => { setQuery(''); setResults(null); searchRef.current?.focus(); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 px-1.5 py-0.5 text-sm font-bold"
                                title="Cancella ricerca"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <Button onClick={handleSearch} loading={loading} icon={Search} className="px-6 min-h-[44px] text-base font-semibold">
                        {t('searchBtn')}
                    </Button>
                </div>

                <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600">
                        <span className="font-medium flex items-center gap-1"><Sparkles size={14} className="text-emerald-700"/> {t('searchExamples')}</span>
                        {examples.map(ex => (
                            <button 
                                key={ex} 
                                onClick={() => { setQuery(ex); performSearch(ex); }} 
                                className="px-3 py-1 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg text-xs font-medium border border-stone-200 transition-colors"
                            >
                                {ex}
                            </button>
                        ))}
                    </div>

                    {recent.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-stone-600 pt-1">
                            <span className="font-medium flex items-center gap-1"><History size={14} className="text-stone-500"/> {t('recentSearches')}:</span>
                            {recent.map(r => (
                                <button 
                                    key={r} 
                                    onClick={() => { setQuery(r); performSearch(r); }} 
                                    className="px-2.5 py-0.5 bg-white hover:bg-stone-100 rounded border border-stone-200 text-xs"
                                >
                                    {r}
                                </button>
                            ))}
                            <button onClick={clearRecent} className="text-xs text-red-600 hover:underline ml-2">
                                {t('clearHistory')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white min-h-[40px]">
                    <option value="">{t('allTypes')}</option>
                    {archive.schema.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={tag} onChange={e => setTag(e.target.value)} className="px-3 py-2 rounded-xl border border-stone-300 text-sm bg-white min-h-[40px]">
                    <option value="">{t('allTags')}</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">{error}</div>}

            {loading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-5 bg-white rounded-2xl border border-stone-200 shadow-sm animate-pulse space-y-3">
                            <div className="h-5 bg-stone-200 rounded w-1/3"></div>
                            <div className="h-4 bg-stone-100 rounded w-full"></div>
                            <div className="h-4 bg-stone-100 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            )}

            {results !== null && results.length === 0 && !loading && (
                <div className="p-8 bg-white rounded-2xl border border-stone-200 text-center space-y-3">
                    <p className="font-semibold text-stone-800 text-lg">{t('noResults')}</p>
                    <p className="text-stone-600 text-sm">{t('noResultsSuggestions')}</p>
                </div>
            )}

            {results === null && !loading && (
                <SuggestionsBox archive={archive} onOpenRec={onOpenRec} updateArchive={updateArchive} t={t} />
            )}

            {displayedResults && !loading && (
                <div className="space-y-4">
                    {displayedResults.map(res => {
                        const rec = archive.records.find(r => r.id === res.id);
                        if (!rec) return null;
                        const header = buildHeader(rec);
                        const snippet = res.chunkText.startsWith(`${header}: `) ? res.chunkText.substring(header.length + 2) : res.chunkText;
                        
                        return (
                            <div key={res.id} onClick={() => onOpenRec(res.id)} className="p-5 bg-white rounded-2xl border border-stone-200 shadow-sm cursor-pointer hover:border-emerald-500 transition-all space-y-3">
                                <div className="flex justify-between items-start gap-3">
                                    <h4 className="font-serif font-bold text-lg text-stone-900">{rec.titolo}</h4>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {getRelevanceLabel(res.score)}
                                        <span className="px-2.5 py-1 bg-stone-100 text-stone-800 rounded-lg text-xs font-medium">{rec.tipo}</span>
                                    </div>
                                </div>
                                {rec.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {rec.tags.map(t => <span key={t} className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-xs">{t}</span>)}
                                    </div>
                                )}
                                <p className="text-stone-600 line-clamp-3 text-base leading-relaxed">{snippet}</p>
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
    );
};

