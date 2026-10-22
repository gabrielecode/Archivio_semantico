import React, {useState, useMemo} from 'react';
import {Archive, Rec} from '../types';
import {getBacklinks, getDistance2Nodes, shortestPath, findRecordByTitle} from '../utils/parser';
import {Link, ArrowUpRight, ArrowDownLeft, Network, Route, Plus} from 'lucide-react';
import {Button} from './ui';

interface LinkPanelProps {
    archive: Archive;
    currentRecord: Rec;
    onSelectRecord: (id: string) => void;
    onCreateRecord: (title: string) => void;
}

export function LinkPanel({
    archive,
    currentRecord,
    onSelectRecord,
    onCreateRecord
}: LinkPanelProps) {
    const [targetPathId, setTargetPathId] = useState<string>('');
    const [showPathModal, setShowPathModal] = useState(false);

    const outlinks = currentRecord.outlinks || [];

    const outlinksRecords = useMemo(() => {
        return outlinks
            .map(title => findRecordByTitle(archive, title))
            .filter(Boolean) as Rec[];
    }, [archive, outlinks]);

    const unresolvedOutlinks = useMemo(() => {
        return outlinks.filter(title => !findRecordByTitle(archive, title));
    }, [archive, outlinks]);

    const backlinks = useMemo(() => {
        return getBacklinks(archive, currentRecord.titolo);
    }, [archive, currentRecord.titolo]);

    const distance2 = useMemo(() => {
        return getDistance2Nodes(archive, currentRecord.id);
    }, [archive, currentRecord.id]);

    const pathResult = useMemo(() => {
        if (!targetPathId) return [];
        return shortestPath(archive, currentRecord.id, targetPathId);
    }, [archive, currentRecord.id, targetPathId]);

    return (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                <Network className="text-amber-700" size={20} />
                <h3 className="font-serif font-semibold text-lg text-stone-900">Knowledge Graph & Connessioni</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Outlinks */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                        <ArrowUpRight size={16} className="text-amber-600" />
                        Outlink ({outlinks.length})
                    </h4>
                    {outlinks.length === 0 ? (
                        <p className="text-sm text-stone-400 italic">Nessun collegamento in uscita (usa [[Titolo]])</p>
                    ) : (
                        <div className="space-y-2">
                            {outlinksRecords.map(rec => (
                                <button
                                    key={rec.id}
                                    onClick={() => onSelectRecord(rec.id)}
                                    className="w-full text-left p-2.5 rounded-xl bg-stone-50 hover:bg-amber-50 border border-stone-200 hover:border-amber-300 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div>
                                        <div className="font-medium text-stone-900 group-hover:text-amber-900 text-sm">{rec.titolo}</div>
                                        <div className="text-xs text-stone-500">{rec.categoria || rec.tipo}</div>
                                    </div>
                                    <Link size={14} className="text-stone-400 group-hover:text-amber-600" />
                                </button>
                            ))}
                            {unresolvedOutlinks.map(title => (
                                <button
                                    key={title}
                                    onClick={() => onCreateRecord(title)}
                                    className="w-full text-left p-2.5 rounded-xl bg-rose-50/50 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div>
                                        <div className="font-medium text-rose-900 text-sm">+ Crea: {title}</div>
                                        <div className="text-xs text-rose-500">Scheda non esistente</div>
                                    </div>
                                    <Plus size={14} className="text-rose-600" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Backlinks */}
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                        <ArrowDownLeft size={16} className="text-emerald-600" />
                        Backlink (Puntano qui: {backlinks.length})
                    </h4>
                    {backlinks.length === 0 ? (
                        <p className="text-sm text-stone-400 italic">Nessuna scheda punta a questa</p>
                    ) : (
                        <div className="space-y-2">
                            {backlinks.map(rec => (
                                <button
                                    key={rec.id}
                                    onClick={() => onSelectRecord(rec.id)}
                                    className="w-full text-left p-2.5 rounded-xl bg-stone-50 hover:bg-emerald-50 border border-stone-200 hover:border-emerald-300 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                    <div>
                                        <div className="font-medium text-stone-900 group-hover:text-emerald-900 text-sm">{rec.titolo}</div>
                                        <div className="text-xs text-stone-500">{rec.categoria || rec.tipo}</div>
                                    </div>
                                    <Link size={14} className="text-stone-400 group-hover:text-emerald-600" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Distance 2 and Shortest Path */}
            <div className="border-t border-stone-100 pt-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-semibold text-stone-800">Esplora Connessioni (Distanza 2)</h4>
                        <p className="text-xs text-stone-500">Schede collegate tramite un intermediario</p>
                    </div>
                    <Button variant="secondary" onClick={() => setShowPathModal(true)} className="text-xs">
                        <Route size={14} className="mr-1.5" /> Percorso più breve...
                    </Button>
                </div>

                {distance2.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">Nessuna connessione a distanza 2 trovata</p>
                ) : (
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                        {distance2.map(({ record }) => (
                            <button
                                key={record.id}
                                onClick={() => onSelectRecord(record.id)}
                                className="inline-flex items-center bg-stone-100 hover:bg-amber-100 text-stone-800 hover:text-amber-900 px-3 py-1.5 rounded-xl text-xs font-medium border border-stone-200 transition-colors cursor-pointer"
                            >
                                {record.titolo}
                                <span className="ml-1.5 text-[10px] text-stone-500">({record.categoria || record.tipo})</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Shortest Path Modal */}
            {showPathModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl space-y-4 border border-stone-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-serif font-semibold text-lg text-stone-900">Trova percorso più breve</h3>
                            <button onClick={() => setShowPathModal(false)} className="text-stone-400 hover:text-stone-700 font-bold text-lg">&times;</button>
                        </div>
                        <p className="text-sm text-stone-600">Seleziona una scheda di arrivo per calcolare il percorso (BFS) a partire da "{currentRecord.titolo}".</p>
                        
                        <div>
                            <label className="text-xs font-medium text-stone-700 block mb-1">Scheda di arrivo</label>
                            <select
                                value={targetPathId}
                                onChange={e => setTargetPathId(e.target.value)}
                                className="w-full border border-stone-200 rounded-xl p-3 text-sm bg-white"
                            >
                                <option value="">-- Seleziona destinazione --</option>
                                {archive.records.filter(r => r.id !== currentRecord.id).map(r => (
                                    <option key={r.id} value={r.id}>{r.titolo} ({r.categoria || r.tipo})</option>
                                ))}
                            </select>
                        </div>

                        {targetPathId && (
                            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2">
                                <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Risultato percorso</h4>
                                {pathResult.length === 0 ? (
                                    <p className="text-sm text-rose-600 font-medium">Nessun percorso trovato tra queste due schede.</p>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {pathResult.map((rec, i) => (
                                            <React.Fragment key={rec.id}>
                                                <button
                                                    onClick={() => { onSelectRecord(rec.id); setShowPathModal(false); }}
                                                    className="bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-200 transition-colors cursor-pointer"
                                                >
                                                    {rec.titolo}
                                                </button>
                                                {i < pathResult.length - 1 && <span className="text-stone-400 font-bold">&rarr;</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button variant="secondary" onClick={() => setShowPathModal(false)}>Chiudi</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
