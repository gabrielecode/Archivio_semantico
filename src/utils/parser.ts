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

export function findRecordByTitle(archive: Archive, title: string): Rec | undefined {
    const clean = title.trim().toLowerCase();
    return archive.records.find(r => r.titolo.trim().toLowerCase() === clean);
}

export function getBacklinks(archive: Archive, targetTitle: string): Rec[] {
    const clean = targetTitle.trim().toLowerCase();
    return archive.records.filter(r => 
        r.outlinks.some(o => o.trim().toLowerCase() === clean) ||
        r.contenuto.toLowerCase().includes(`[[${clean}]]`)
    );
}

export function getDistance2Nodes(archive: Archive, currentId: string): { record: Rec; path: string[] }[] {
    const current = archive.records.find(r => r.id === currentId);
    if (!current) return [];

    const titleToRec = new Map<string, Rec>();
    archive.records.forEach(r => titleToRec.set(r.titolo.trim().toLowerCase(), r));

    // Build adjacency list (title -> set of neighbor titles)
    const adj = new Map<string, Set<string>>();
    archive.records.forEach(r => {
        const u = r.titolo.trim().toLowerCase();
        if (!adj.has(u)) adj.set(u, new Set());
        r.outlinks.forEach(out => {
            const v = out.trim().toLowerCase();
            adj.get(u)!.add(v);
            if (!adj.has(v)) adj.set(v, new Set());
            adj.get(v)!.add(u); // undirected for connection exploration / distance 2
        });
    });

    const startTitle = current.titolo.trim().toLowerCase();
    const visited = new Map<string, number>(); // title -> distance
    const queue: { title: string; dist: number }[] = [{ title: startTitle, dist: 0 }];
    visited.set(startTitle, 0);

    while (queue.length > 0) {
        const { title, dist } = queue.shift()!;
        if (dist >= 2) continue;

        const neighbors = adj.get(title) || new Set();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.set(neighbor, dist + 1);
                queue.push({ title: neighbor, dist: dist + 1 });
            }
        }
    }

    const results: { record: Rec; path: string[] }[] = [];
    visited.forEach((dist, title) => {
        if (dist === 2) {
            const rec = titleToRec.get(title);
            if (rec && rec.id !== currentId) {
                results.push({ record: rec, path: [current.titolo, title] });
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
    archive.records.forEach(r => titleToRec.set(r.id, r));

    const adj = new Map<string, Set<string>>();
    archive.records.forEach(r => {
        const u = r.id;
        if (!adj.has(u)) adj.set(u, new Set());
        r.outlinks.forEach(out => {
            const targetRec = findRecordByTitle(archive, out);
            if (targetRec) {
                adj.get(u)!.add(targetRec.id);
                if (!adj.has(targetRec.id)) adj.set(targetRec.id, new Set());
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
