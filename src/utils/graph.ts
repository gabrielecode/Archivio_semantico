import { Archive, GraphData, GraphLink, GraphLinkKind, GraphNode, GraphNodeType, Rec } from '../types';
import { extractWikiLinks, getRecordText, normTitle, resolveRecord } from './parser';

export const NODE_TYPE_COLORS: Record<GraphNodeType, string> = {
  acupoint: '#059669',  // emerald-600
  meridian: '#2563EB',  // blue-600
  formula: '#7C3AED',   // violet-600
  symptom: '#D97706',   // amber-600
  syndrome: '#DC2626',  // red-600
  concept: '#0D9488',   // teal-600
  ghost: '#94A3B8',     // slate-400
};

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  acupoint: 'Punto di agopuntura',
  meridian: 'Meridiano / Organo',
  formula: 'Erba / Formula',
  symptom: 'Sintomo',
  syndrome: 'Sindrome / Patologia',
  concept: 'Concetto / Nota',
  ghost: 'Concetto non risolto',
};

export const LINK_KIND_COLORS: Record<GraphLinkKind, string> = {
  explicit: '#059669',
  metadata: '#A8A29E',
  semantic: '#D97706',
};

export const RELATION_COLORS: Record<string, string> = {
  appartiene_a: '#059669',
  tratta: '#2563EB',
  correlato_a: '#78716C',
  semantic_similarity: '#D97706',
};

export function normalizeGraphText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function classifyNodeType(category: string, isGhost = false): GraphNodeType {
  if (isGhost) return 'ghost';
  const norm = normalizeGraphText(category);
  if (norm.includes('punto') || norm === 'mcc' || norm === 'mtc' || norm.includes('moxibust') || norm.includes('guasha')) {
    return 'acupoint';
  }
  if (norm.includes('meridian') || norm.includes('organ') || norm.includes('fisiologia')) {
    return 'meridian';
  }
  if (norm.includes('erba') || norm.includes('formula') || norm.includes('fitoterap') || norm.includes('dietet') || norm.includes('oli')) {
    return 'formula';
  }
  if (norm.includes('sindrom') || norm.includes('patolog')) {
    return 'syndrome';
  }
  if (norm.includes('sintom')) {
    return 'symptom';
  }
  return 'concept';
}

export function getColorForCategory(category: string, isGhost = false): string {
  return NODE_TYPE_COLORS[classifyNodeType(category, isGhost)];
}

export function getColorForLink(link: Pick<GraphLink, 'kind' | 'tipoRelazione' | 'isGhost'>): string {
  if (link.isGhost) return '#CBD5E1';
  if (link.kind === 'semantic') return LINK_KIND_COLORS.semantic;
  if (link.kind === 'metadata') return LINK_KIND_COLORS.metadata;
  return RELATION_COLORS[link.tipoRelazione] || LINK_KIND_COLORS.explicit;
}

export function computeRecordCentroid(rec: Rec, expectedDim?: number): number[] | null {
  const validChunks = (rec.chunks || []).filter(
    (c) => Array.isArray(c.embedding) && c.embedding.length > 0 && (!expectedDim || c.embedding.length === expectedDim)
  );
  if (validChunks.length === 0) return null;

  const dim = validChunks[0].embedding.length;
  const sum = new Array<number>(dim).fill(0);

  for (const chunk of validChunks) {
    if (chunk.embedding.length !== dim) continue;
    for (let i = 0; i < dim; i++) {
      sum[i] += chunk.embedding[i];
    }
  }

  let normSq = 0;
  for (let i = 0; i < dim; i++) {
    sum[i] /= validChunks.length;
    normSq += sum[i] * sum[i];
  }
  const norm = Math.sqrt(normSq);
  if (!Number.isFinite(norm) || norm === 0) return null;

  for (let i = 0; i < dim; i++) {
    sum[i] /= norm;
  }
  return sum;
}

export function dotProduct(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function extractFieldTexts(val: unknown): string[] {
  if (typeof val === 'string') return [val];
  if (typeof val === 'number') return [String(val)];
  if (Array.isArray(val)) return val.flatMap(extractFieldTexts);
  if (val && typeof val === 'object') return Object.values(val).flatMap(extractFieldTexts);
  return [];
}

export interface BuildGraphOptions {
  searchTerm: string;
  selectedCategory: string;
  selectedTag: string;
  showExplicit: boolean;
  showMetadata: boolean;
  showSemantic: boolean;
  semanticThreshold: number;
  maxSemanticPerNode?: number;
}

export function buildMtcGraph(archive: Archive, options: BuildGraphOptions): GraphData {
  const {
    searchTerm,
    selectedCategory,
    selectedTag,
    showExplicit,
    showMetadata,
    showSemantic,
    semanticThreshold,
    maxSemanticPerNode = 4,
  } = options;

  const links: GraphLink[] = [];
  const ghostNodesMap = new Map<string, { title: string; count: number }>();
  const edgeMap = new Map<string, GraphLink>();
  const getPairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);

  const upsertLink = (
    source: string,
    target: string,
    kind: GraphLinkKind,
    tipoRelazione: string,
    opts?: { isGhost?: boolean; dashed?: boolean; similarity?: number; weight?: number }
  ) => {
    if (source === target) return;
    const key = getPairKey(source, target);
    const existing = edgeMap.get(key);
    // Explicit > Semantic > Metadata priority when deduplicating undirected pair
    if (existing) {
      if (existing.kind === 'explicit') return;
      if (existing.kind === 'semantic' && kind === 'metadata') return;
      if (existing.kind === 'semantic' && kind === 'semantic') return;
      edgeMap.delete(key);
    }

    const link: GraphLink = {
      id: key,
      source,
      target,
      kind,
      tipoRelazione,
      weight: opts?.weight ?? (kind === 'explicit' ? 1 : opts?.similarity ?? 0.45),
      ...(opts?.similarity !== undefined ? { similarity: opts.similarity } : {}),
      ...(opts?.isGhost ? { isGhost: true } : {}),
      ...(opts?.dashed ? { dashed: true } : {}),
    };
    edgeMap.set(key, link);
  };

  const inferRelation = (src: Rec, tgt: Rec): string => {
    const srcCat = normalizeGraphText(src.categoria || src.tipo || '');
    const tgtCat = normalizeGraphText(tgt.categoria || tgt.tipo || '');
    if (srcCat.includes('punto') && tgtCat.includes('meridian')) return 'appartiene_a';
    if (srcCat.includes('erba') || srcCat.includes('formula') || srcCat.includes('fitoterap') || srcCat.includes('tratt')) {
      return 'tratta';
    }
    return 'correlato_a';
  };

  // 1. Explicit wiki-links
  if (showExplicit) {
    archive.records.forEach((sourceRec) => {
      const wikiLinks = extractWikiLinks(getRecordText(sourceRec));
      wikiLinks.forEach((wl) => {
        const targetRec = resolveRecord(archive, wl.targetTitle);
        if (targetRec && targetRec.id !== sourceRec.id) {
          upsertLink(
            sourceRec.id,
            targetRec.id,
            'explicit',
            wl.tipoRelazione || inferRelation(sourceRec, targetRec),
            { weight: 1 }
          );
        } else if (!targetRec) {
          const cleanTitle = wl.targetTitle.trim();
          if (cleanTitle && cleanTitle.toLowerCase() !== sourceRec.titolo.trim().toLowerCase()) {
            const ghostKey = cleanTitle.toLowerCase();
            const ghostId = `ghost-${ghostKey}`;
            if (!ghostNodesMap.has(ghostKey)) {
              ghostNodesMap.set(ghostKey, { title: cleanTitle, count: 0 });
            }
            ghostNodesMap.get(ghostKey)!.count++;
            upsertLink(sourceRec.id, ghostId, 'explicit', wl.tipoRelazione || 'correlato_a', {
              isGhost: true,
              dashed: true,
              weight: 0.5,
            });
          }
        }
      });
    });
  }

  // 2. Metadata & shared tag links
  if (showMetadata) {
    const extractAliasTerms = (val: unknown): string[] =>
      extractFieldTexts(val)
        .flatMap((s) => s.split(/[;,\r\n]+/))
        .map((s) => normTitle(s))
        .filter((t) => t.length >= 4);

    const normalizedTargets = archive.records
      .map((r) => {
        const terms = Array.from(
          new Set(
            [
              normTitle(r.titolo || ''),
              ...extractAliasTerms(r.campi?.nomi_secondari),
              ...extractAliasTerms(r.campi?.numero),
              ...extractAliasTerms(r.campi?.ideogramma),
              ...extractAliasTerms(r.campi?.ideogrammi),
            ].filter((t) => t.length >= 4)
          )
        );
        return { id: r.id, terms };
      })
      .filter((item) => item.terms.length > 0);

    archive.records.forEach((sourceRec) => {
      const sourceText = normTitle(getRecordText(sourceRec));
      if (!sourceText) return;

      normalizedTargets.forEach(({ id: targetId, terms }) => {
        if (targetId !== sourceRec.id && terms.some((term) => sourceText.includes(term))) {
          upsertLink(sourceRec.id, targetId, 'metadata', 'correlato_a', { dashed: true, weight: 0.45 });
        }
      });
    });

    (['autore', 'dinastia', 'periodo_storico'] as const).forEach((field) => {
      const groups = new Map<string, string[]>();
      archive.records.forEach((rec) => {
        const rawVal = rec.campi?.[field];
        if (rawVal === undefined || rawVal === null) return;
        const uniqueVals = new Set(extractFieldTexts(rawVal).map(normalizeGraphText).filter(Boolean));
        uniqueVals.forEach((val) => {
          if (!groups.has(val)) groups.set(val, []);
          groups.get(val)!.push(rec.id);
        });
      });
      groups.forEach((ids) => {
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            upsertLink(ids[i], ids[j], 'metadata', 'correlato_a', { dashed: true, weight: 0.35 });
          }
        }
      });
    });

    const tagGroups = new Map<string, string[]>();
    archive.records.forEach((rec) => {
      const uniqueTags = new Set(
        [...(rec.tags || []), ...(rec.tag || [])].map((t) => normalizeGraphText(String(t))).filter(Boolean)
      );
      uniqueTags.forEach((tag) => {
        if (!tagGroups.has(tag)) tagGroups.set(tag, []);
        tagGroups.get(tag)!.push(rec.id);
      });
    });
    tagGroups.forEach((ids) => {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          upsertLink(ids[i], ids[j], 'metadata', 'correlato_a', { dashed: true, weight: 0.4 });
        }
      }
    });
  }

  // 3. Semantic cosine similarity links (Top-K per node above threshold)
  const centroids = new Map<string, number[]>();
  archive.records.forEach((r) => {
    const centroid = computeRecordCentroid(r, archive.dim);
    if (centroid) centroids.set(r.id, centroid);
  });

  if (showSemantic && centroids.size > 1) {
    const embeddedIds = Array.from(centroids.keys());
    const topMatchesByNode = new Map<string, { targetId: string; sim: number }[]>();
    embeddedIds.forEach((id) => topMatchesByNode.set(id, []));

    for (let i = 0; i < embeddedIds.length; i++) {
      const idA = embeddedIds[i];
      const vecA = centroids.get(idA)!;
      for (let j = i + 1; j < embeddedIds.length; j++) {
        const idB = embeddedIds[j];
        const vecB = centroids.get(idB)!;
        if (vecA.length !== vecB.length) continue;
        const sim = dotProduct(vecA, vecB);
        if (sim >= semanticThreshold) {
          topMatchesByNode.get(idA)!.push({ targetId: idB, sim });
          topMatchesByNode.get(idB)!.push({ targetId: idA, sim });
        }
      }
    }

    topMatchesByNode.forEach((matches, sourceId) => {
      matches
        .sort((a, b) => b.sim - a.sim)
        .slice(0, maxSemanticPerNode)
        .forEach(({ targetId, sim }) => {
          upsertLink(sourceId, targetId, 'semantic', 'semantic_similarity', {
            similarity: sim,
            weight: sim,
            dashed: true,
          });
        });
    });
  }

  // Filter visible nodes first
  const normSearch = normalizeGraphText(searchTerm);
  const baseNodes: GraphNode[] = [];

  archive.records.forEach((r) => {
    const cat = r.categoria || r.tipo || 'Generale';
    const matchesSearch =
      normSearch === '' ||
      normalizeGraphText(r.titolo).includes(normSearch) ||
      normalizeGraphText(r.contenuto).includes(normSearch) ||
      (r.tags || []).some((t) => normalizeGraphText(t).includes(normSearch));
    const matchesCategory = selectedCategory === 'all' || cat === selectedCategory;
    const matchesTag = selectedTag === 'all' || (r.tags || []).includes(selectedTag);

    if (matchesSearch && matchesCategory && matchesTag) {
      const nodeType = classifyNodeType(cat, false);
      baseNodes.push({
        id: r.id,
        name: r.titolo || 'Senza titolo',
        category: cat,
        nodeType,
        tags: r.tags || [],
        degree: 0,
        val: 6,
        color: NODE_TYPE_COLORS[nodeType],
        isGhost: false,
        hasEmbedding: centroids.has(r.id),
        record: r,
      });
    }
  });

  ghostNodesMap.forEach((data, ghostKey) => {
    const ghostId = `ghost-${ghostKey}`;
    const matchesSearch = normSearch === '' || normalizeGraphText(data.title).includes(normSearch);
    const matchesCategory = selectedCategory === 'all' || selectedCategory === 'Non risolto';
    const matchesTag = selectedTag === 'all';

    if (matchesSearch && matchesCategory && matchesTag) {
      baseNodes.push({
        id: ghostId,
        name: data.title,
        category: 'Non risolto',
        nodeType: 'ghost',
        tags: [],
        degree: 0,
        val: 5,
        color: NODE_TYPE_COLORS.ghost,
        isGhost: true,
        hasEmbedding: false,
      });
    }
  });

  const visibleIds = new Set(baseNodes.map((n) => n.id));
  const degreeMap = new Map<string, number>();

  edgeMap.forEach((link) => {
    const s = String(link.source);
    const t = String(link.target);
    if (visibleIds.has(s) && visibleIds.has(t)) {
      links.push(link);
      degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
      degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
    }
  });

  baseNodes.forEach((n) => {
    const deg = degreeMap.get(n.id) || 0;
    n.degree = deg;
    n.val = n.isGhost ? Math.max(4.5, Math.min(12, 4.5 + deg * 1.4)) : Math.max(5.5, Math.min(18, 5.5 + deg * 1.8));
  });

  return {
    nodes: baseNodes,
    links,
  };
}
