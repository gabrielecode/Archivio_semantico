import {Rec, EMB_DIM} from '../types';
import {fetchEmbeddings} from './api';
import {calculateEmbHash, splitChunks} from './chunk';

export function needsEmbedding(rec: Rec): boolean {
    return rec.embHash !== calculateEmbHash(rec) || rec.chunks.length === 0 || rec.chunks.some(c => c.embedding.length !== EMB_DIM);
}

export async function embedRecords(
    recs: Rec[],
    token: string,
    onProgress: (doneRecs: number, totalRecs: number) => void,
    signal: AbortSignal,
    force: boolean = false
): Promise<{ results: { id: string; hash: string; chunks: Rec['chunks'] }[], errore?: string }> {
    const targets = recs.filter(r => force || needsEmbedding(r));
    const results: { id: string; hash: string; chunks: Rec['chunks'] }[] = [];
    
    // Flatten chunks with record ID mapping
    const queue: { recId: string, chunk: { testo: string; embedding: number[] } }[] = [];
    const recordChunksMap: Map<string, { testo: string; embedding: number[] }[]> = new Map();
    const recordHashes: Map<string, string> = new Map();
    
    for (const r of targets) {
        const hash = calculateEmbHash(r);
        const chunks = splitChunks(r);
        recordChunksMap.set(r.id, chunks);
        recordHashes.set(r.id, hash);
        for (const c of chunks) {
            queue.push({ recId: r.id, chunk: c });
        }
    }

    let doneRecs = 0;
    
    try {
        for (let i = 0; i < queue.length; i += 20) {
            if (signal.aborted) throw new Error('Annullato');
            
            const batch = queue.slice(i, i + 20);
            const batchVectors = await fetchEmbeddings(batch.map(b => b.chunk.testo), 'document', token, signal);
            
            // Assign back
            for (let j = 0; j < batch.length; j++) {
                const item = batch[j];
                const vector = batchVectors[j];
                if (!vector || vector.length !== EMB_DIM) throw new Error('Mismatch embedding count');
                
                const recChunks = recordChunksMap.get(item.recId)!;
                const chunkIndex = recChunks.indexOf(item.chunk);
                recChunks[chunkIndex].embedding = vector.map(v => Math.round(v * 100000) / 100000);
            }
            
            // Check completed records
            for (const r of targets) {
                if (results.find(res => res.id === r.id)) continue;
                
                const chunks = recordChunksMap.get(r.id)!;
                if (chunks.every(c => c.embedding.length === EMB_DIM)) {
                    results.push({ id: r.id, hash: recordHashes.get(r.id)!, chunks });
                    doneRecs++;
                    onProgress(doneRecs, targets.length);
                }
            }
        }
    } catch (e: any) {
        let err = e.message;
        if (err.includes('401') || err.includes('Unauthorized')) err = 'Token admin errato o mancante';
        return { results, errore: err };
    }
    
    return { results };
}
