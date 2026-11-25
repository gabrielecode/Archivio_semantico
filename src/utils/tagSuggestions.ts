import { Archive, Rec } from '../types';
import { computeRecordCentroid, dotProduct } from './graph';

export type SuggestionSource = 'title' | 'fields' | 'text' | 'concepts' | 'similar' | 'links';

export interface TagSuggestion {
  tag: string;
  score: number;
  reason: string;
  sources: SuggestionSource[];
  usageCount: number;
  nomenclatureCount: number;
}

interface NomenclatureEntry {
  display: string;
  norm: string;
  tagUsageCount: number;
  nomenclatureCount: number;
  isFromArchiveTag: boolean;
  casingCounts: Map<string, number>;
  roles: Set<string>;
}

const STOPWORDS = new Set([
  'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'da', 'dal', 'dalla', 'dallo', 'dai', 'dagli', 'dalle',
  'in', 'nel', 'nella', 'nello', 'nei', 'negli', 'nelle',
  'con', 'per', 'su', 'sul', 'sulla', 'tra', 'fra',
  'a', 'ad', 'al', 'alla', 'allo', 'ai', 'agli', 'alle',
  'e', 'ed', 'o', 'od', 'il', 'lo', 'la', 'i', 'gli', 'le',
  'un', 'uno', 'una', 'che', 'non', 'piu', 'come', 'anche',
  'sec', 'secondo', 'mtc', 'mcc',
]);

const STRUCTURED_NOMENCLATURE_FIELDS: Array<{ key: string; role: string }> = [
  { key: 'organi_riferimento', role: 'Organo/Meridiano' },
  { key: 'sindrome_energetica', role: 'Sindrome' },
  { key: 'costituzione', role: 'Costituzione' },
  { key: 'sintomi', role: 'Sintomo' },
  { key: 'segni', role: 'Segno' },
  { key: 'sapore', role: 'Sapore' },
  { key: 'temperatura', role: 'Natura termica' },
  { key: 'stagione', role: 'Stagione' },
  { key: 'nome_principale', role: 'Nome MTC' },
  { key: 'nomi_secondari', role: 'Sinonimo MTC' },
  { key: 'nome_secondario', role: 'Sinonimo MTC' },
  { key: 'nome_erba', role: 'Erba' },
  { key: 'erbe_amiche', role: 'Erba sinergica' },
  { key: 'nome_alimento', role: 'Alimento' },
  { key: 'nome_olio', role: 'Olio essenziale' },
  { key: 'patologia_accademica', role: 'Patologia' },
  { key: 'pti_mtc', role: 'Punto MTC' },
  { key: 'pti_jy', role: 'Punto JY' },
  { key: 'pti_sida', role: 'Punto SIDA' },
  { key: 'combinazioni', role: 'Combinazione' },
  { key: 'scuola_pensiero', role: 'Scuola' },
  { key: 'dinastia', role: 'Dinastia' },
  { key: 'nome_dinastie', role: 'Dinastia' },
  { key: 'periodo_storico', role: 'Periodo' },
];

const IGNORED_FIELD_KEYS = new Set([
  'immagine', 'immagine_1', 'immagine_2', 'video', 'link', 'numero', 'anno',
]);

const CJK_REGEX = /[\u4e00-\u9fff]/;

export function normalizeMtcText(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function getRecordTags(rec: Partial<Rec> | null | undefined): string[] {
  if (!rec) return [];
  const raw = [...(rec.tags || []), ...(rec.tag || [])];
  return mergeRecordTags([], raw);
}

export function mergeRecordTags(existing: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of [...existing, ...additions]) {
    const clean = String(item || '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    const key = normalizeMtcText(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }

  return result;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isUrlOrPath(val: string): boolean {
  const s = val.trim().toLowerCase();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:') || s.startsWith('blob:');
}

function extractRawStrings(val: unknown): string[] {
  if (typeof val === 'string') return [val];
  if (typeof val === 'number') return [];
  if (Array.isArray(val)) return val.flatMap(extractRawStrings);
  if (val && typeof val === 'object') return Object.values(val).flatMap(extractRawStrings);
  return [];
}

function splitNomenclatureTokens(raw: string): string[] {
  return raw
    .split(/[;,\n]+/)
    .map((part) => part.replace(/^[-•*]\s*/, '').trim())
    .filter((part) => {
      if (!part || isUrlOrPath(part)) return false;
      if (/^\d+([.,]\d+)?$/.test(part)) return false;
      const hasCjk = CJK_REGEX.test(part);
      if (!hasCjk && part.length < 2) return false;
      if (part.length > 48) return false;
      const wordCount = part.split(/\s+/).filter(Boolean).length;
      return wordCount <= 5;
    });
}

function extractSignificantWords(normStr: string): string[] {
  return normStr
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function registerTerm(
  map: Map<string, NomenclatureEntry>,
  rawTerm: string,
  opts: { isTag?: boolean; role?: string }
) {
  const clean = rawTerm.replace(/\s+/g, ' ').trim();
  if (!clean || isUrlOrPath(clean)) return;
  const norm = normalizeMtcText(clean);
  if (!norm) return;
  if (!CJK_REGEX.test(norm) && norm.length < 2) return;

  let entry = map.get(norm);
  if (!entry) {
    entry = {
      display: clean,
      norm,
      tagUsageCount: 0,
      nomenclatureCount: 0,
      isFromArchiveTag: false,
      casingCounts: new Map<string, number>(),
      roles: new Set<string>(),
    };
    map.set(norm, entry);
  }

  const prevCount = entry.casingCounts.get(clean) || 0;
  entry.casingCounts.set(clean, prevCount + (opts.isTag ? 3 : 1));

  // Prefer existing tag casing or most frequent casing
  let bestDisplay = entry.display;
  let bestScore = -1;
  entry.casingCounts.forEach((count, candidate) => {
    if (count > bestScore) {
      bestScore = count;
      bestDisplay = candidate;
    }
  });
  entry.display = bestDisplay;

  if (opts.isTag) {
    entry.isFromArchiveTag = true;
    entry.tagUsageCount += 1;
    entry.roles.add('Tag archivio');
  } else {
    entry.nomenclatureCount += 1;
    if (opts.role) entry.roles.add(opts.role);
  }
}

export function extractArchiveMtcNomenclature(archive: Archive): Map<string, NomenclatureEntry> {
  const map = new Map<string, NomenclatureEntry>();

  // 1. Archive schema types/categories
  (archive.schema?.tipi || []).forEach((tipo) => {
    const clean = String(tipo || '').trim();
    if (clean && clean.length <= 42) {
      registerTerm(map, clean, { role: 'Categoria' });
    }
  });

  // 2. Existing records' tags, titles, categories, and structured MTC fields
  (archive.records || []).forEach((rec) => {
    const recTags = getRecordTags(rec);
    recTags.forEach((tag) => {
      registerTerm(map, tag, { isTag: true });
    });

    if (rec.titolo) {
      const cleanTitle = rec.titolo.trim();
      if (cleanTitle.length >= 2 && cleanTitle.length <= 45 && cleanTitle.split(/\s+/).length <= 5) {
        registerTerm(map, cleanTitle, { role: 'Scheda MTC' });
      }
    }

    const cat = (rec.categoria || rec.tipo || '').trim();
    if (cat && cat.length >= 2 && cat.length <= 42) {
      registerTerm(map, cat, { role: 'Categoria' });
    }

    const campi = rec.campi || {};
    STRUCTURED_NOMENCLATURE_FIELDS.forEach(({ key, role }) => {
      const val = campi[key];
      if (val === undefined || val === null) return;
      extractRawStrings(val).forEach((raw) => {
        splitNomenclatureTokens(raw).forEach((token) => {
          registerTerm(map, token, { role });
        });
      });
    });
  });

  return map;
}

function countPhraseMatches(
  rawSurface: string,
  normSurface: string,
  display: string,
  normTerm: string
): number {
  if (!rawSurface || !normTerm) return 0;

  if (CJK_REGEX.test(normTerm)) {
    const parts = rawSurface.split(display.trim());
    return Math.max(0, parts.length - 1);
  }

  // Short terms (<= 2 chars like "Qi", "LU", "ST") require case-aware boundary matching
  // so "qi" never matches inside unrelated abbreviations or Italian words.
  if (normTerm.length <= 2) {
    const escapedDisplay = escapeRegExp(display.trim());
    const shortRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapedDisplay}(?=$|[^\\p{L}\\p{N}])`, 'gu');
    const matches = rawSurface.match(shortRegex);
    return matches ? matches.length : 0;
  }

  const escapedNorm = escapeRegExp(normTerm);
  const boundaryRegex = new RegExp(`(^|[^a-z0-9])${escapedNorm}(?=$|[^a-z0-9])`, 'g');
  const matches = normSurface.match(boundaryRegex);
  return matches ? matches.length : 0;
}

function buildRecordCampiText(campi: Record<string, any> | undefined): {
  rawText: string;
  structuredExactTokens: Set<string>;
} {
  if (!campi || typeof campi !== 'object') {
    return { rawText: '', structuredExactTokens: new Set() };
  }

  const parts: string[] = [];
  const structuredExactTokens = new Set<string>();
  const structuredKeySet = new Set(STRUCTURED_NOMENCLATURE_FIELDS.map((f) => f.key));

  Object.entries(campi).forEach(([key, value]) => {
    if (IGNORED_FIELD_KEYS.has(key) || key.includes('immagine') || key.includes('image') || key.includes('video')) {
      return;
    }
    const strings = extractRawStrings(value).filter((s) => s.trim() && !isUrlOrPath(s));
    if (strings.length === 0) return;

    parts.push(...strings);

    if (structuredKeySet.has(key)) {
      strings.forEach((s) => {
        splitNomenclatureTokens(s).forEach((tok) => {
          const norm = normalizeMtcText(tok);
          if (norm) structuredExactTokens.add(norm);
        });
      });
    }
  });

  return { rawText: parts.join(' \n '), structuredExactTokens };
}

function formatSuggestionReason(
  sources: SuggestionSource[],
  entry: NomenclatureEntry,
  maxPeerSim: number,
  similarPeerCount: number
): string {
  const parts: string[] = [];

  if (sources.includes('title')) {
    parts.push('Nel titolo');
  } else if (sources.includes('fields')) {
    parts.push('Nei campi MTC');
  } else if (sources.includes('text')) {
    parts.push('Nel contenuto');
  } else if (sources.includes('concepts')) {
    parts.push('Concetti correlati');
  }

  if (sources.includes('similar') && maxPeerSim > 0) {
    const pct = Math.round(maxPeerSim * 100);
    parts.push(similarPeerCount > 1 ? `${similarPeerCount} schede simili (${pct}%)` : `Scheda simile (${pct}%)`);
  } else if (sources.includes('links')) {
    parts.push('Schede collegate');
  }

  if (entry.isFromArchiveTag && entry.tagUsageCount > 0) {
    parts.push(`Tag in ${entry.tagUsageCount} ${entry.tagUsageCount === 1 ? 'scheda' : 'schede'}`);
  } else if (entry.nomenclatureCount > 0) {
    const role = Array.from(entry.roles).find((r) => r !== 'Tag archivio');
    parts.push(role ? `${role} in archivio` : 'Nomenclatura archivio');
  }

  return parts.join(' · ');
}

export function suggestTagsForRecord(
  record: Rec,
  archive: Archive,
  limit = 12
): TagSuggestion[] {
  if (!record) return [];

  const existingTagNorms = new Set(getRecordTags(record).map(normalizeMtcText));
  const nomenclature = extractArchiveMtcNomenclature(archive);
  if (nomenclature.size === 0) return [];

  const rawTitle = [record.titolo, record.categoria, record.tipo].filter(Boolean).join(' ');
  const normTitle = normalizeMtcText(rawTitle);

  const { rawText: rawFields, structuredExactTokens } = buildRecordCampiText(record.campi);
  const normFields = normalizeMtcText(rawFields);

  const rawBody = [record.contenuto, record.fonte, ...(record.outlinks || [])].filter(Boolean).join(' ');
  const normBody = normalizeMtcText(rawBody);

  const combinedNorm = `${normTitle} ${normFields} ${normBody}`.trim();
  const combinedWordSet = new Set(extractSignificantWords(combinedNorm));

  // Linked peer tag affinity (direct outlinks & backlinks)
  const linkedTagCounts = new Map<string, number>();
  const normSelfTitle = normalizeMtcText(record.titolo || '');
  const outlinkSet = new Set((record.outlinks || []).map(normalizeMtcText).filter(Boolean));
  (archive.records || []).forEach((other) => {
    if (other.id === record.id) return;
    const otherNormTitle = normalizeMtcText(other.titolo || '');
    const isLinked =
      (otherNormTitle && outlinkSet.has(otherNormTitle)) ||
      (normSelfTitle && (other.outlinks || []).some((o) => normalizeMtcText(o) === normSelfTitle));
    if (!isLinked) return;
    getRecordTags(other).forEach((t) => {
      const k = normalizeMtcText(t);
      if (k) linkedTagCounts.set(k, (linkedTagCounts.get(k) || 0) + 1);
    });
  });

  // Semantic similarity peer tag affinity (when embeddings exist)
  const semanticTagInfo = new Map<string, { maxSim: number; count: number; scoreSum: number }>();
  const selfCentroid = computeRecordCentroid(record, archive.dim);
  if (selfCentroid) {
    const peers: Array<{ rec: Rec; sim: number }> = [];
    for (const other of archive.records || []) {
      if (other.id === record.id) continue;
      const otherTags = getRecordTags(other);
      if (otherTags.length === 0) continue;
      const otherCentroid = computeRecordCentroid(other, archive.dim);
      if (!otherCentroid || otherCentroid.length !== selfCentroid.length) continue;
      const sim = dotProduct(selfCentroid, otherCentroid);
      if (sim >= 0.72) {
        peers.push({ rec: other, sim });
      }
    }
    peers
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 8)
      .forEach(({ rec: peer, sim }) => {
        getRecordTags(peer).forEach((tag) => {
          const k = normalizeMtcText(tag);
          if (!k) return;
          const prev = semanticTagInfo.get(k) || { maxSim: 0, count: 0, scoreSum: 0 };
          prev.maxSim = Math.max(prev.maxSim, sim);
          prev.count += 1;
          prev.scoreSum += sim;
          semanticTagInfo.set(k, prev);
        });
      });
  }

  const suggestions: TagSuggestion[] = [];

  nomenclature.forEach((entry, normKey) => {
    if (existingTagNorms.has(normKey)) return;
    // Skip suggesting the record's own exact title as a tag unless it's already an established archive tag
    if (normKey === normSelfTitle && !entry.isFromArchiveTag) return;

    let score = 0;
    const sources: SuggestionSource[] = [];

    const titleHits = countPhraseMatches(rawTitle, normTitle, entry.display, normKey);
    const fieldHits =
      (structuredExactTokens.has(normKey) ? 1 : 0) +
      countPhraseMatches(rawFields, normFields, entry.display, normKey);
    const bodyHits = countPhraseMatches(rawBody, normBody, entry.display, normKey);

    if (titleHits > 0) {
      score += 5.0;
      sources.push('title');
    }
    if (fieldHits > 0) {
      score += 4.2 + (structuredExactTokens.has(normKey) ? 0.6 : 0);
      sources.push('fields');
    }
    if (bodyHits > 0) {
      score += 3.2 + Math.min(1.0, (bodyHits - 1) * 0.4);
      sources.push('text');
    }

    // Multi-word concept matching for compound archive tags (e.g. "Deficit di Qi di Milza")
    if (titleHits === 0 && fieldHits === 0 && bodyHits === 0) {
      const sigWords = extractSignificantWords(normKey);
      if (sigWords.length >= 2) {
        const matchedWords = sigWords.filter((w) => combinedWordSet.has(w));
        if (matchedWords.length === sigWords.length) {
          score += 2.3;
          sources.push('concepts');
        } else if (sigWords.length >= 3 && matchedWords.length >= sigWords.length - 1) {
          score += 1.4;
          sources.push('concepts');
        }
      }
    }

    const semInfo = semanticTagInfo.get(normKey);
    if (semInfo && (score > 0 || semInfo.maxSim >= 0.76)) {
      score += Math.min(2.8, semInfo.maxSim * 2.4 + (semInfo.count - 1) * 0.35);
      sources.push('similar');
    }

    const linkCount = linkedTagCounts.get(normKey) || 0;
    if (linkCount > 0 && (score > 0 || linkCount >= 2)) {
      score += Math.min(1.8, linkCount * 0.8);
      sources.push('links');
    }

    if (sources.length === 0) return;

    // Weight established archive tags and widely used nomenclature higher
    if (entry.isFromArchiveTag) {
      score += 1.6 + Math.min(2.0, Math.log2(1 + entry.tagUsageCount) * 0.85);
    } else if (entry.nomenclatureCount >= 2) {
      score += Math.min(1.2, entry.nomenclatureCount * 0.3);
    }

    suggestions.push({
      tag: entry.display,
      score,
      reason: formatSuggestionReason(sources, entry, semInfo?.maxSim || 0, semInfo?.count || 0),
      sources,
      usageCount: entry.tagUsageCount,
      nomenclatureCount: entry.nomenclatureCount,
    });
  });

  suggestions.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
    return a.tag.localeCompare(b.tag, 'it');
  });

  return suggestions.slice(0, limit);
}
