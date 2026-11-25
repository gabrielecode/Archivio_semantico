import { Rec, EMB_DIM } from '../types';
import { fetchEmbeddings } from './api';
import { calculateEmbHash, splitChunks } from './chunk';

export function needsEmbedding(rec: Rec, expectedDim: number = EMB_DIM): boolean {
  return (
    rec.embHash !== calculateEmbHash(rec) ||
    rec.chunks.length === 0 ||
    rec.chunks.some((c) => c.embedding.length !== expectedDim)
  );
}

export interface EmbedRecordsOptions {
  force?: boolean;
  model?: string;
  expectedDim?: number;
}

function waitWithSignal(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new Error('Annullato'));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new Error('Annullato'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export async function embedRecords(
  recs: Rec[],
  onProgress: (doneRecs: number, totalRecs: number) => void,
  signal: AbortSignal,
  forceOrOptions: boolean | EmbedRecordsOptions = false
): Promise<{
  results: { id: string; hash: string; chunks: Rec['chunks'] }[];
  model?: string;
  dim?: number;
  errore?: string;
}> {
  const opts: EmbedRecordsOptions =
    typeof forceOrOptions === 'boolean' ? { force: forceOrOptions } : forceOrOptions;
  const force = Boolean(opts.force);
  const expectedDim = opts.expectedDim && opts.expectedDim > 0 ? opts.expectedDim : EMB_DIM;

  const targets = recs.filter((r) => force || needsEmbedding(r, expectedDim));
  const results: { id: string; hash: string; chunks: Rec['chunks'] }[] = [];

  if (targets.length === 0) {
    onProgress(0, 0);
    return { results, model: opts.model, dim: expectedDim };
  }

  const queue: { recId: string; chunk: { testo: string; embedding: number[] } }[] = [];
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
  let actualModel = opts.model;
  let actualDim = expectedDim;
  const completedIds = new Set<string>();

  try {
    for (let i = 0; i < queue.length; i += 20) {
      if (signal.aborted) throw new Error('Annullato');

      const batch = queue.slice(i, i + 20);
      let resp: Awaited<ReturnType<typeof fetchEmbeddings>>;
      let retries = 0;
      while (true) {
        if (signal.aborted) throw new Error('Annullato');
        try {
          resp = await fetchEmbeddings(
            batch.map((b) => b.chunk.testo),
            'document',
            signal,
            opts.model
          );
          break;
        } catch (err: any) {
          const msg = String(err?.message || '');
          const isRateLimit = msg.includes('Troppe richieste') || msg.includes('429');
          if (!isRateLimit || retries >= 3) {
            throw err;
          }
          retries++;
          await waitWithSignal(20_000, signal);
        }
      }
      actualModel = resp.model;
      actualDim = resp.dim;

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const vector = resp.vectors[j];
        if (!vector || vector.length !== actualDim) {
          throw new Error('Dimensione vettore embedding non coerente');
        }

        const recChunks = recordChunksMap.get(item.recId)!;
        const chunkIndex = recChunks.indexOf(item.chunk);
        recChunks[chunkIndex].embedding = vector.map((v) => Math.round(v * 100000) / 100000);
      }

      for (const r of targets) {
        if (completedIds.has(r.id)) continue;

        const chunks = recordChunksMap.get(r.id)!;
        if (chunks.every((c) => c.embedding.length === actualDim)) {
          completedIds.add(r.id);
          results.push({ id: r.id, hash: recordHashes.get(r.id)!, chunks });
          doneRecs++;
          onProgress(doneRecs, targets.length);
        }
      }
    }
  } catch (e: any) {
    let err = e?.message || 'Errore durante la generazione degli embedding';
    if (err.includes('401') || err.includes('Non autorizzato') || err.includes('Unauthorized')) {
      err = 'Sessione scaduta o email non verificata: effettua nuovamente l\'accesso.';
    }
    return { results, model: actualModel, dim: actualDim, errore: err };
  }

  return { results, model: actualModel, dim: actualDim };
}
