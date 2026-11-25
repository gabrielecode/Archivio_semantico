import {Rec, Archive} from '../types';

export interface WikiLinkMatch {
    raw: string;
    targetTitle: string;
    label: string;
    tipoRelazione?: string;
}

export function extractWikiLinks(content: string): WikiLinkMatch[] {
    if (!content) return [];
    const regex = /\[\[([^\]|]+)(?:\|([^\]|]*)(?:\|([^\]]+))?)?\]\]/g;
    const matches: WikiLinkMatch[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const targetTitle = match[1].trim();
        const part2 = match[2] ? match[2].trim() : '';
        const part3 = match[3] ? match[3].trim() : '';

        let label = targetTitle;
        let tipoRelazione: string | undefined = undefined;
        const knownRels = ['appartiene_a', 'tratta', 'correlato_a'];

        if (part3) {
            label = part2 || targetTitle;
            tipoRelazione = part3;
        } else if (part2) {
            if (knownRels.includes(part2)) {
                tipoRelazione = part2;
                label = targetTitle;
            } else {
                label = part2;
            }
        }

        if (targetTitle) {
            matches.push({
                raw: match[0],
                targetTitle,
                label,
                tipoRelazione
            });
        }
    }
    return matches;
}

export interface WikiLinkSegment {
    type: 'text' | 'link';
    content: string;
    targetTitle?: string;
    label?: string;
    tipoRelazione?: string;
}

export function parseWikiSegments(content: string): WikiLinkSegment[] {
    if (!content) return [];
    const regex = /\[\[([^\]|]+)(?:\|([^\]|]*)(?:\|([^\]]+))?)?\]\]/g;
    const segments: WikiLinkSegment[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
            segments.push({
                type: 'text',
                content: content.substring(lastIndex, matchIndex)
            });
        }

        const targetTitle = match[1].trim();
        const part2 = match[2] ? match[2].trim() : '';
        const part3 = match[3] ? match[3].trim() : '';

        let label = targetTitle;
        let tipoRelazione: string | undefined = undefined;
        const knownRels = ['appartiene_a', 'tratta', 'correlato_a'];

        if (part3) {
            label = part2 || targetTitle;
            tipoRelazione = part3;
        } else if (part2) {
            if (knownRels.includes(part2)) {
                tipoRelazione = part2;
                label = targetTitle;
            } else {
                label = part2;
            }
        }

        segments.push({
            type: 'link',
            content: match[0],
            targetTitle,
            label,
            tipoRelazione
        });

        lastIndex = matchIndex + match[0].length;
    }

    if (lastIndex < content.length) {
        segments.push({
            type: 'text',
            content: content.substring(lastIndex)
        });
    }

    return segments;
}

export function updateRecordOutlinks(record: Rec): Rec {
    const links = extractWikiLinks(record.contenuto);
    const uniqueTargets = Array.from(new Set(links.map(l => l.targetTitle)));
    return {
        ...record,
        outlinks: uniqueTargets
    };
}

export function normTitle(s: string): string {
    return (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

export function getRecordText(rec: Rec): string {
    const parts: string[] = [];
    if (typeof rec.contenuto === 'string' && rec.contenuto.trim()) {
        parts.push(rec.contenuto.trim());
    }
    if (rec.campi && typeof rec.campi === 'object') {
        for (const [key, val] of Object.entries(rec.campi)) {
            const lowerKey = key.toLowerCase();
            if (
                lowerKey.includes('immagine') ||
                lowerKey.includes('image') ||
                lowerKey.includes('video') ||
                lowerKey.includes('link')
            ) {
                continue;
            }
            if (typeof val === 'string') {
                if (val.trim()) parts.push(val.trim());
            } else if (Array.isArray(val)) {
                for (const item of val) {
                    if (typeof item === 'string' && item.trim()) {
                        parts.push(item.trim());
                    }
                }
            }
        }
    }
    return parts.join('\n');
}

function extractResolveCandidates(val: unknown): string[] {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val)) {
        return val.flatMap(item => extractResolveCandidates(item));
    }
    const str = String(val);
    if (!str.trim()) return [];
    return str
        .split(/[;,\r\n]+/)
        .map(part => normTitle(part))
        .filter(Boolean);
}

export function resolveRecord(archive: Archive, label: string): Rec | undefined {
    const target = normTitle(label);
    if (!target || !archive?.records?.length) return undefined;

    const byTitle = archive.records.find(r => normTitle(r.titolo) === target);
    if (byTitle) return byTitle;

    return archive.records.find(r => {
        const campi = r.campi || {};
        const candidates = [
            ...extractResolveCandidates(campi.nomi_secondari),
            ...extractResolveCandidates(campi.numero),
            ...extractResolveCandidates(campi.ideogramma),
            ...extractResolveCandidates(campi.ideogrammi),
        ];
        return candidates.includes(target);
    });
}

export function findRecordByTitle(archive: Archive, title: string): Rec | undefined {
    return resolveRecord(archive, title);
}

export function getBacklinks(archive: Archive, targetTitle: string): Rec[] {
    const target = resolveRecord(archive, targetTitle);
    if (!target) return [];
    return archive.records.filter(r => {
        if (r.id === target.id) return false;
        const links = extractWikiLinks(getRecordText(r));
        return links.some(l => resolveRecord(archive, l.targetTitle)?.id === target.id);
    });
}

export function getDistance2Nodes(archive: Archive, currentId: string): { record: Rec; path: string[] }[] {
    const current = archive.records.find(r => r.id === currentId);
    if (!current) return [];

    const idToRec = new Map<string, Rec>();
    const adj = new Map<string, Set<string>>();
    archive.records.forEach(r => {
        idToRec.set(r.id, r);
        adj.set(r.id, new Set());
    });

    // Build undirected adjacency list from dynamic wiki-links resolved via resolveRecord
    archive.records.forEach(r => {
        const links = extractWikiLinks(getRecordText(r));
        links.forEach(l => {
            const targetRec = resolveRecord(archive, l.targetTitle);
            if (targetRec && targetRec.id !== r.id) {
                adj.get(r.id)!.add(targetRec.id);
                adj.get(targetRec.id)!.add(r.id); // undirected for connection exploration / distance 2
            }
        });
    });

    const visited = new Map<string, number>(); // recordId -> distance
    const parent = new Map<string, string>(); // recordId -> parent recordId
    const queue: { id: string; dist: number }[] = [{ id: currentId, dist: 0 }];
    visited.set(currentId, 0);

    while (queue.length > 0) {
        const { id, dist } = queue.shift()!;
        if (dist >= 2) continue;

        const neighbors = adj.get(id) || new Set();
        for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
                visited.set(neighborId, dist + 1);
                parent.set(neighborId, id);
                queue.push({ id: neighborId, dist: dist + 1 });
            }
        }
    }

    const results: { record: Rec; path: string[] }[] = [];
    visited.forEach((dist, id) => {
        if (dist === 2) {
            const rec = idToRec.get(id);
            const interId = parent.get(id);
            const interRec = interId ? idToRec.get(interId) : undefined;
            if (rec && interRec && rec.id !== currentId) {
                results.push({
                    record: rec,
                    path: [current.titolo, interRec.titolo, rec.titolo]
                });
            }
        }
    });

    return results;
}

export function shortestPath(archive: Archive, startId: string, endId: string): Rec[] {
    if (startId === endId) {
        const r = archive.records.find(x => x.id === startId);
        return r ? [r] : [];
    }

    const titleToRec = new Map<string, Rec>();
    const adj = new Map<string, Set<string>>();
    archive.records.forEach(r => {
        titleToRec.set(r.id, r);
        adj.set(r.id, new Set());
    });

    archive.records.forEach(r => {
        const u = r.id;
        extractWikiLinks(getRecordText(r)).forEach(link => {
            const targetRec = resolveRecord(archive, link.targetTitle);
            if (targetRec && targetRec.id !== u) {
                adj.get(u)!.add(targetRec.id);
                adj.get(targetRec.id)!.add(u);
            }
        });
    });

    const queue: string[] = [startId];
    const parent = new Map<string, string>();
    const visited = new Set<string>([startId]);

    let found = false;
    while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === endId) {
            found = true;
            break;
        }
        const neighbors = adj.get(curr) || new Set();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                parent.set(neighbor, curr);
                queue.push(neighbor);
            }
        }
    }

    if (!found) return [];

    const pathIds: string[] = [];
    let curr: string | undefined = endId;
    while (curr) {
        pathIds.unshift(curr);
        curr = parent.get(curr);
    }

    return pathIds.map(id => titleToRec.get(id)).filter(Boolean) as Rec[];
}

export function renameLinks(archive: Archive, oldTitle: string, newTitle: string): Archive {
    const oldNorm = normTitle(oldTitle);
    const trimmedNew = (newTitle || '').trim();
    if (!oldNorm || !trimmedNew || oldTitle.trim() === trimmedNew) {
        return archive;
    }

    const replaceInText = (text: string): string => {
        if (!text || !text.includes('[[')) return text;
        return text.replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (match, target, rest) => {
            if (normTitle(target) !== oldNorm) return match;
            return `[[${trimmedNew}${rest || ''}]]`;
        });
    };

    const records = archive.records.map(rec => {
        const nextContenuto = typeof rec.contenuto === 'string' ? replaceInText(rec.contenuto) : rec.contenuto;
        let nextCampi = rec.campi;
        if (rec.campi && typeof rec.campi === 'object') {
            let campiChanged = false;
            const updatedCampi: Record<string, any> = { ...rec.campi };
            for (const [key, val] of Object.entries(rec.campi)) {
                const lowerKey = key.toLowerCase();
                if (
                    lowerKey.includes('immagine') ||
                    lowerKey.includes('image') ||
                    lowerKey.includes('video') ||
                    lowerKey.includes('link')
                ) {
                    continue;
                }
                if (typeof val === 'string') {
                    const replaced = replaceInText(val);
                    if (replaced !== val) {
                        updatedCampi[key] = replaced;
                        campiChanged = true;
                    }
                } else if (Array.isArray(val)) {
                    let arrChanged = false;
                    const nextArr = val.map(item => {
                        if (typeof item === 'string') {
                            const replaced = replaceInText(item);
                            if (replaced !== item) {
                                arrChanged = true;
                                return replaced;
                            }
                        }
                        return item;
                    });
                    if (arrChanged) {
                        updatedCampi[key] = nextArr;
                        campiChanged = true;
                    }
                }
            }
            if (campiChanged) {
                nextCampi = updatedCampi;
            }
        }

        if (nextContenuto === rec.contenuto && nextCampi === rec.campi) {
            return rec;
        }
        return {
            ...rec,
            contenuto: nextContenuto,
            campi: nextCampi,
        };
    });

    return {
        ...archive,
        records,
    };
}
