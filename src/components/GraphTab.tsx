import React, {useState, useMemo, useRef} from 'react';
import {Archive, Rec} from '../types';
import ForceGraph2D from 'react-force-graph-2d';
import {findRecordByTitle, extractWikiLinks} from '../utils/parser';
import {Search, Filter, Network, ExternalLink, RotateCcw} from 'lucide-react';
import {Button, inputCls} from './ui';

interface GraphTabProps {
    archive: Archive;
    onOpenRec: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Sintomo': '#d97706', // amber-600
    'Punto di agopuntura': '#059669', // emerald-600
    'Meridiano': '#2563eb', // blue-600
    'Erba/Formula': '#7c3aed', // violet-600
    'Sindrome': '#dc2626', // red-600
    'Teoria/Concetto': '#db2777', // pink-600
    'Documento': '#4f46e5', // indigo-600
    'Nota': '#64748b', // slate-500
    'Non risolto': '#94a3b8' // slate-400
};

const RELATION_COLORS: Record<string, string> = {
    'appartiene_a': '#059669', // emerald-600
    'tratta': '#2563eb', // blue-600
    'correlato_a': '#d97706' // amber-600
};

function getColorForRelation(tipo: string): string {
    return RELATION_COLORS[tipo] || '#9ca3af';
}

function getColorForCategory(cat: string): string {
    if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
    // Hash fallback
    let hash = 0;
    for (let i = 0; i < cat.length; i++) {
        hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

export function GraphTab({archive, onOpenRec}: GraphTabProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const fgRef = useRef<any>(null);

    const categories = useMemo(() => {
        const set = new Set<string>();
        archive.records.forEach(r => set.add(r.categoria || r.tipo || 'Generale'));
        set.add('Non risolto');
        return Array.from(set);
    }, [archive.records]);

    const tags = useMemo(() => {
        const set = new Set<string>();
        archive.records.forEach(r => (r.tags || []).forEach(t => set.add(t)));
        return Array.from(set);
    }, [archive.records]);

    // Build graph data
    const graphData = useMemo(() => {
        const titleToId = new Map<string, string>();
        archive.records.forEach(r => titleToId.set(r.titolo.trim().toLowerCase(), r.id));

        const degreeMap = new Map<string, number>();
        archive.records.forEach(r => {
            degreeMap.set(r.id, 0);
        });

        const links: { source: string; target: string; tipoRelazione: string; isGhost?: boolean }[] = [];
        const ghostNodesMap = new Map<string, { title: string; count: number }>();

        archive.records.forEach(sourceRec => {
            const wikiLinks = extractWikiLinks(sourceRec.contenuto);
            const processedTargets = new Set<string>();

            wikiLinks.forEach(wl => {
                const targetRec = findRecordByTitle(archive, wl.targetTitle);
                if (targetRec && targetRec.id !== sourceRec.id && !processedTargets.has(targetRec.id)) {
                    processedTargets.add(targetRec.id);
                    let tipo = wl.tipoRelazione;
                    if (!tipo) {
                        const srcCat = (sourceRec.categoria || sourceRec.tipo || '').toLowerCase();
                        const tgtCat = (targetRec.categoria || targetRec.tipo || '').toLowerCase();
                        if (srcCat.includes('punto') && tgtCat.includes('meridiano')) {
                            tipo = 'appartiene_a';
                        } else if (srcCat.includes('erba') || srcCat.includes('formula') || srcCat.includes('tratt')) {
                            tipo = 'tratta';
                        } else {
                            tipo = 'correlato_a';
                        }
                    }
                    links.push({
                        source: sourceRec.id,
                        target: targetRec.id,
                        tipoRelazione: tipo
                    });
                    degreeMap.set(sourceRec.id, (degreeMap.get(sourceRec.id) || 0) + 1);
                    degreeMap.set(targetRec.id, (degreeMap.get(targetRec.id) || 0) + 1);
                } else if (!targetRec) {
                    const cleanTitle = wl.targetTitle.trim();
                    if (cleanTitle && cleanTitle.toLowerCase() !== sourceRec.titolo.trim().toLowerCase()) {
                        const ghostKey = cleanTitle.toLowerCase();
                        const ghostId = `ghost-${ghostKey}`;
                        if (!processedTargets.has(ghostId)) {
                            processedTargets.add(ghostId);
                            if (!ghostNodesMap.has(ghostKey)) {
                                ghostNodesMap.set(ghostKey, { title: cleanTitle, count: 0 });
                                degreeMap.set(ghostId, 0);
                            }
                            ghostNodesMap.get(ghostKey)!.count++;
                            links.push({
                                source: sourceRec.id,
                                target: ghostId,
                                tipoRelazione: wl.tipoRelazione || 'correlato_a',
                                isGhost: true
                            });
                            degreeMap.set(sourceRec.id, (degreeMap.get(sourceRec.id) || 0) + 1);
                            degreeMap.set(ghostId, (degreeMap.get(ghostId) || 0) + 1);
                        }
                    }
                }
            });

            const outlinks = sourceRec.outlinks || [];
            outlinks.forEach(targetTitle => {
                const targetRec = findRecordByTitle(archive, targetTitle);
                if (targetRec && targetRec.id !== sourceRec.id && !processedTargets.has(targetRec.id)) {
                    processedTargets.add(targetRec.id);
                    let tipo = 'correlato_a';
                    const srcCat = (sourceRec.categoria || sourceRec.tipo || '').toLowerCase();
                    const tgtCat = (targetRec.categoria || targetRec.tipo || '').toLowerCase();
                    if (srcCat.includes('punto') && tgtCat.includes('meridiano')) {
                        tipo = 'appartiene_a';
                    } else if (srcCat.includes('erba') || srcCat.includes('formula')) {
                        tipo = 'tratta';
                    }
                    links.push({
                        source: sourceRec.id,
                        target: targetRec.id,
                        tipoRelazione: tipo
                    });
                    degreeMap.set(sourceRec.id, (degreeMap.get(sourceRec.id) || 0) + 1);
                    degreeMap.set(targetRec.id, (degreeMap.get(targetRec.id) || 0) + 1);
                } else if (!targetRec) {
                    const cleanTitle = targetTitle.trim();
                    if (cleanTitle && cleanTitle.toLowerCase() !== sourceRec.titolo.trim().toLowerCase()) {
                        const ghostKey = cleanTitle.toLowerCase();
                        const ghostId = `ghost-${ghostKey}`;
                        if (!processedTargets.has(ghostId)) {
                            processedTargets.add(ghostId);
                            if (!ghostNodesMap.has(ghostKey)) {
                                ghostNodesMap.set(ghostKey, { title: cleanTitle, count: 0 });
                                degreeMap.set(ghostId, 0);
                            }
                            ghostNodesMap.get(ghostKey)!.count++;
                            links.push({
                                source: sourceRec.id,
                                target: ghostId,
                                tipoRelazione: 'correlato_a',
                                isGhost: true
                            });
                            degreeMap.set(sourceRec.id, (degreeMap.get(sourceRec.id) || 0) + 1);
                            degreeMap.set(ghostId, (degreeMap.get(ghostId) || 0) + 1);
                        }
                    }
                }
            });
        });

        const nodes = archive.records.map(r => {
            const cat = r.categoria || r.tipo || 'Generale';
            const deg = degreeMap.get(r.id) || 0;
            const matchesSearch = searchTerm === '' || 
                r.titolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.contenuto.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;
            const matchesTag = selectedTag === 'all' || (r.tags || []).includes(selectedTag);

            const isFiltered = matchesSearch && matchesCategory && matchesTag;

            return {
                id: r.id,
                name: r.titolo,
                category: cat,
                tags: r.tags || [],
                val: Math.max(4, Math.min(20, 4 + deg * 2)),
                color: getColorForCategory(cat),
                highlighted: searchTerm !== '' && matchesSearch,
                visible: isFiltered,
                isGhost: false
            };
        });

        const ghostNodes: any[] = [];
        ghostNodesMap.forEach((data, ghostKey) => {
            const ghostId = `ghost-${ghostKey}`;
            const deg = degreeMap.get(ghostId) || 0;
            const matchesSearch = searchTerm === '' || data.title.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || selectedCategory === 'Non risolto';
            const matchesTag = selectedTag === 'all';
            const isFiltered = matchesSearch && matchesCategory && matchesTag;

            ghostNodes.push({
                id: ghostId,
                name: data.title,
                category: 'Non risolto',
                tags: [],
                val: Math.max(4, Math.min(16, 4 + deg * 2)),
                color: '#94a3b8',
                highlighted: searchTerm !== '' && matchesSearch,
                visible: isFiltered,
                isGhost: true
            });
        });

        const allNodes = [...nodes, ...ghostNodes];
        const visibleNodeIds = new Set(allNodes.filter(n => n.visible).map(n => n.id));
        const filteredLinks = links.filter(l => visibleNodeIds.has(l.source as string) && visibleNodeIds.has(l.target as string));
        const filteredNodes = allNodes.filter(n => n.visible);

        return {
            nodes: filteredNodes,
            links: filteredLinks
        };
    }, [archive, searchTerm, selectedCategory, selectedTag]);

    return (
        <div className="space-y-4">
            <div className="bg-white border border-stone-200 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Network className="text-amber-700" size={22} />
                    <div>
                        <h2 className="font-serif font-semibold text-lg text-stone-900">Knowledge Graph</h2>
                        <p className="text-xs text-stone-500">{graphData.nodes.length} nodi visibili, {graphData.links.length} connessioni</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl justify-end">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            placeholder="Cerca nodi nel grafo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`${inputCls} pl-9 py-2 text-sm`}
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={e => setSelectedCategory(e.target.value)}
                        className={`${inputCls} py-2 text-sm bg-white max-w-[180px]`}
                    >
                        <option value="all">Tutte le categorie</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        value={selectedTag}
                        onChange={e => setSelectedTag(e.target.value)}
                        className={`${inputCls} py-2 text-sm bg-white max-w-[160px]`}
                    >
                        <option value="all">Tutti i tag</option>
                        {tags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    {(searchTerm || selectedCategory !== 'all' || selectedTag !== 'all') && (
                        <Button 
                            variant="secondary" 
                            onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setSelectedTag('all'); }}
                            className="py-2 text-xs"
                            title="Resetta filtri"
                        >
                            <RotateCcw size={14} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-3xl shadow-sm overflow-hidden relative h-[650px] w-full">
                <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    nodeLabel={(node: any) => `${node.name} (${node.category})`}
                    nodeColor={(node: any) => node.highlighted ? '#f59e0b' : node.color}
                    nodeVal={(node: any) => node.val}
                    nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                        const label = node.name;
                        const fontSize = Math.max(10, 12 / globalScale);
                        ctx.font = `${fontSize}px sans-serif`;
                        
                        if (node.isGhost) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                            ctx.fillStyle = '#f8fafc';
                            ctx.fill();
                            ctx.strokeStyle = '#94a3b8';
                            ctx.lineWidth = 1.5 / globalScale;
                            ctx.setLineDash([3, 3]);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        } else {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                            ctx.fillStyle = node.highlighted ? '#f59e0b' : node.color;
                            ctx.fill();
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 1.5 / globalScale;
                            ctx.stroke();
                        }

                        if (globalScale >= 1.2 || node.highlighted) {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = node.isGhost ? '#64748b' : '#1c1917';
                            if (node.isGhost) {
                                ctx.font = `italic ${fontSize}px sans-serif`;
                            }
                            ctx.fillText(label, node.x, node.y + node.val + 2);
                        }
                    }}
                    onNodeClick={(node: any) => {
                        if (!node.isGhost) {
                            onOpenRec(node.id);
                        }
                    }}
                    linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
                        const start = link.source;
                        const end = link.target;
                        if (!start || !end || typeof start.x !== 'number' || typeof end.x !== 'number') return;
                        ctx.beginPath();
                        ctx.moveTo(start.x, start.y);
                        ctx.lineTo(end.x, end.y);
                        ctx.strokeStyle = link.isGhost ? '#cbd5e1' : getColorForRelation(link.tipoRelazione);
                        ctx.lineWidth = link.isGhost ? 1.5 : 2;
                        if (link.isGhost) {
                            ctx.setLineDash([4, 4]);
                        } else {
                            ctx.setLineDash([]);
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }}
                    linkLabel={(link: any) => link.isGhost ? 'Link non risolto (Ghost)' : `Relazione: ${link.tipoRelazione}`}
                    cooldownTicks={100}
                />
                
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-xs border border-stone-200 rounded-2xl p-3 shadow-sm text-xs space-y-1.5 pointer-events-none">
                    <div className="font-semibold text-stone-800 mb-1">Legenda Categorie</div>
                    {categories.slice(0, 6).map(cat => (
                        <div key={cat} className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getColorForCategory(cat) }} />
                            <span className="text-stone-700 truncate max-w-[150px]">{cat}</span>
                        </div>
                    ))}
                </div>

                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-xs border border-stone-200 rounded-2xl p-3 shadow-sm text-xs space-y-1.5 pointer-events-none">
                    <div className="font-semibold text-stone-800 mb-1">Tipo Relazione (Archi)</div>
                    {Object.entries(RELATION_COLORS).map(([tipo, color]) => (
                        <div key={tipo} className="flex items-center gap-2">
                            <span className="w-4 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-stone-700">{tipo}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
