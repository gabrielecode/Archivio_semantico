import React, {useState, useMemo, useRef} from 'react';
import {Archive, Rec} from '../types';
import ForceGraph2D from 'react-force-graph-2d';
import {findRecordByTitle} from '../utils/parser';
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
    'Nota': '#64748b' // slate-500
};

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

        const links: { source: string; target: string }[] = [];

        archive.records.forEach(sourceRec => {
            const outlinks = sourceRec.outlinks || [];
            outlinks.forEach(targetTitle => {
                const targetId = findRecordByTitle(archive, targetTitle)?.id;
                if (targetId && targetId !== sourceRec.id) {
                    links.push({
                        source: sourceRec.id,
                        target: targetId
                    });
                    degreeMap.set(sourceRec.id, (degreeMap.get(sourceRec.id) || 0) + 1);
                    degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
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
                visible: isFiltered
            };
        });

        // Filter nodes and valid links
        const visibleNodeIds = new Set(nodes.filter(n => n.visible).map(n => n.id));
        const filteredLinks = links.filter(l => visibleNodeIds.has(l.source as string) && visibleNodeIds.has(l.target as string));
        const filteredNodes = nodes.filter(n => n.visible);

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
                        
                        // Draw node circle
                        ctx.beginPath();
                        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                        ctx.fillStyle = node.highlighted ? '#f59e0b' : node.color;
                        ctx.fill();
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5 / globalScale;
                        ctx.stroke();

                        // Draw label if zoom is sufficient or node is highlighted
                        if (globalScale >= 1.2 || node.highlighted) {
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = '#1c1917';
                            ctx.fillText(label, node.x, node.y + node.val + 2);
                        }
                    }}
                    onNodeClick={(node: any) => {
                        onOpenRec(node.id);
                    }}
                    linkColor={() => '#e7e5e4'}
                    linkWidth={1.5}
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
            </div>
        </div>
    );
}
