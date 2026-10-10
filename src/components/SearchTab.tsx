import React, {useState, useRef, useMemo, useEffect} from 'react';
import {Search} from 'lucide-react';
import {Archive, Rec, EMB_DIM} from '../types';
import {fetchEmbeddings} from '../utils/api';
import {Button, Badge, EmptyState} from './ui';
import {buildHeader} from '../utils/chunk';

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

export const SearchTab = ({archive, onOpenRec, onGoData}: {archive: Archive, onOpenRec: (id: string) => void, onGoData: () => void}) => {
    const [query, setQuery] = useState('');
    const [tipo, setTipo] = useState('');
    const [tag, setTag] = useState('');
    const [results, setResults] = useState<{id: string, score: number, chunkText: string}[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [topN, setTopN] = useState(10);
    const abortController = useRef<AbortController | null>(null);
    const queryCache = useRef<{q: string, vec: number[]} | null>(null);

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

        if (abortController.current) abortController.current.abort();
        abortController.current = new AbortController();

        try {
            let vec: number[];
            if (queryCache.current?.q === q) {
                vec = queryCache.current.vec;
            } else {
                const vecs = await fetchEmbeddings([q.trim()], 'query', undefined, abortController.current.signal);
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
            if (e instanceof Error && e.name !== 'AbortError') setError('Errore durante la ricerca');
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
    const topScore = displayedResults && displayedResults.length > 0 ? displayedResults[0].score : 1;

    if (validRecords.length === 0) return <EmptyState icon={Search} title="Nessuna voce indicizzata" text="Vai in Dati e premi Genera embedding" action={{label: 'Vai a Dati', onClick: onGoData}} />;

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="Cerca..." className="flex-1 px-4 py-2 rounded-lg border border-stone-300" />
                <Button onClick={handleSearch} loading={loading} icon={Search} aria-label="Cerca">Cerca</Button>
            </div>
            
            <div className="flex gap-4">
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-300">
                    <option value="">Tutti i tipi</option>
                    {archive.schema.tipi.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={tag} onChange={e => setTag(e.target.value)} className="px-3 py-1.5 rounded-lg border border-stone-300">
                    <option value="">Tutti i tag</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">{error}</div>}

            {results !== null && results.length === 0 && <p className="text-stone-500">Nessun risultato trovato.</p>}

            {displayedResults && (
                <div className="space-y-4">
                    {displayedResults.map(res => {
                        const rec = archive.records.find(r => r.id === res.id);
                        if (!rec) return null;
                        const header = buildHeader(rec);
                        const snippet = res.chunkText.startsWith(`${header}: `) ? res.chunkText.substring(header.length + 2) : res.chunkText;
                        
                        return (
                            <div key={res.id} onClick={() => onOpenRec(res.id)} className="p-4 bg-white rounded-lg border border-stone-200 cursor-pointer hover:border-emerald-500">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-stone-900">{rec.titolo}</h4>
                                    <Badge type={rec.tipo} />
                                </div>
                                <div className="flex gap-1 mb-2">
                                    {rec.tags.map(t => <span key={t} className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-xs">{t}</span>)}
                                </div>
                                <div className="w-full bg-stone-100 h-1.5 rounded-full mb-2">
                                    <div className="bg-emerald-600 h-1.5 rounded-full" style={{width: `${Math.min(100, (res.score / topScore) * 100)}%`}} title={`${(res.score * 100).toFixed(2)}% similarità coseno`} />
                                </div>
                                <p className="text-stone-600 line-clamp-3 text-sm">{snippet}</p>
                            </div>
                        );
                    })}
                    {results && results.length > topN && <Button onClick={() => setTopN(topN + 10)} variant="secondary">Mostra altri 10</Button>}
                </div>
            )}
            
            <p className="text-xs text-stone-400 mt-8">Strumento di consultazione, non sostituisce un parere medico.</p>
        </div>
    );
};
