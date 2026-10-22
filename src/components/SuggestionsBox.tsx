import React, {useMemo} from 'react';
import {Archive, Rec} from '../types';
import {extractWikiLinks, findRecordByTitle, getBacklinks} from '../utils/parser';
import {Lightbulb, Plus, FileText, ArrowRight} from 'lucide-react';
import {Button} from './ui';

interface SuggestionsBoxProps {
    archive: Archive;
    onOpenRec: (id: string) => void;
    updateArchive: (fn: (a: Archive) => Archive) => void;
    t: (key: string) => string;
}

export function SuggestionsBox({archive, onOpenRec, updateArchive, t}: SuggestionsBoxProps) {
    // 1. Ghost nodes (missing concepts) most linked
    const topGhostNodes = useMemo(() => {
        const ghostMap = new Map<string, { title: string; count: number; sources: Set<string> }>();
        
        archive.records.forEach(sourceRec => {
            const wikiLinks = extractWikiLinks(sourceRec.contenuto);
            const outlinks = sourceRec.outlinks || [];
            const allTitles = new Set([...wikiLinks.map(w => w.targetTitle), ...outlinks]);

            allTitles.forEach(targetTitle => {
                const cleanTitle = targetTitle.trim();
                if (!cleanTitle) return;
                const targetRec = findRecordByTitle(archive, cleanTitle);
                if (!targetRec && cleanTitle.toLowerCase() !== sourceRec.titolo.trim().toLowerCase()) {
                    const key = cleanTitle.toLowerCase();
                    if (!ghostMap.has(key)) {
                        ghostMap.set(key, { title: cleanTitle, count: 0, sources: new Set() });
                    }
                    const entry = ghostMap.get(key)!;
                    entry.sources.add(sourceRec.id);
                    entry.count = entry.sources.size;
                }
            });
        });

        return Array.from(ghostMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [archive]);

    // 2. Records with most backlinks but short content (< 300 chars)
    const topShortRecords = useMemo(() => {
        const X = 300;
        const evaluated = archive.records.map(r => {
            const backlinks = getBacklinks(archive, r.titolo);
            const length = (r.contenuto || '').length;
            return {
                record: r,
                backlinkCount: backlinks.length,
                length
            };
        });

        // Filter for records under X chars (or sort all by backlink count desc if none are under X)
        const shortFiltered = evaluated.filter(item => item.length < X);
        const candidates = shortFiltered.length > 0 ? shortFiltered : evaluated;

        return candidates
            .sort((a, b) => b.backlinkCount - a.backlinkCount || a.length - b.length)
            .slice(0, 5);
    }, [archive]);

    const handleCreateGhostRecord = (title: string) => {
        const defaultType = archive.schema.tipi[0] || 'Nota';
        const newRec: Rec = {
            id: 'rec_' + crypto.randomUUID().slice(0, 8),
            titolo: title,
            tipo: defaultType,
            categoria: defaultType,
            contenuto: '',
            tags: [],
            tag: [],
            outlinks: [],
            fonte: '',
            campi: {},
            creato: new Date().toISOString(),
            modificato: new Date().toISOString(),
            embHash: '',
            chunks: []
        };
        updateArchive(a => ({
            ...a,
            records: [newRec, ...a.records]
        }));
        onOpenRec(newRec.id);
    };

    if (topGhostNodes.length === 0 && topShortRecords.length === 0) {
        return null;
    }

    return (
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <Lightbulb size={22} />
                </div>
                <div>
                    <h3 className="font-serif font-bold text-xl text-stone-900">{t('suggestionsTitle')}</h3>
                    <p className="text-sm text-stone-500">{t('suggestionsSub') || "Spunti per arricchire la rete di conoscenze del tuo archivio"}</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Ghost Nodes */}
                <div className="space-y-3 bg-stone-50/70 p-4 rounded-2xl border border-stone-200">
                    <h4 className="font-semibold text-stone-800 text-sm flex items-center justify-between">
                        <span>{t('ghostNodesHeader')}</span>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">{topGhostNodes.length}</span>
                    </h4>
                    {topGhostNodes.length === 0 ? (
                        <p className="text-sm text-stone-500 italic py-2">{t('noGhostNodes')}</p>
                    ) : (
                        <div className="space-y-2">
                            {topGhostNodes.map((ghost, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-stone-200 flex items-center justify-between gap-3 shadow-2xs hover:border-emerald-500 transition-all">
                                    <div className="truncate">
                                        <p className="font-medium text-stone-900 truncate text-sm">[[{ghost.title}]]</p>
                                        <p className="text-xs text-stone-500">{ghost.count} {t('linksSuffix')}</p>
                                    </div>
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleCreateGhostRecord(ghost.title)} 
                                        className="shrink-0 text-xs py-1 px-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium flex items-center gap-1"
                                    >
                                        <Plus size={14} /> {t('createCardBtn')}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Short Records to Expand */}
                <div className="space-y-3 bg-stone-50/70 p-4 rounded-2xl border border-stone-200">
                    <h4 className="font-semibold text-stone-800 text-sm flex items-center justify-between">
                        <span>{t('shortRecordsHeader')}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">{topShortRecords.length}</span>
                    </h4>
                    {topShortRecords.length === 0 ? (
                        <p className="text-sm text-stone-500 italic py-2">{t('noShortRecords')}</p>
                    ) : (
                        <div className="space-y-2">
                            {topShortRecords.map((item, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => onOpenRec(item.record.id)}
                                    className="bg-white p-3 rounded-xl border border-stone-200 flex items-center justify-between gap-3 shadow-2xs cursor-pointer hover:border-emerald-500 transition-all group"
                                >
                                    <div className="truncate">
                                        <p className="font-medium text-stone-900 truncate text-sm group-hover:text-emerald-700 transition-colors">{item.record.titolo}</p>
                                        <p className="text-xs text-stone-500 flex items-center gap-2">
                                            <span>{item.backlinkCount} {t('backlinksSuffix')}</span>
                                            <span>•</span>
                                            <span className={item.length < 150 ? 'text-amber-700 font-semibold' : ''}>{item.length} car.</span>
                                        </p>
                                    </div>
                                    <ArrowRight size={16} className="text-stone-400 group-hover:text-emerald-700 shrink-0 transition-colors" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
