export interface EmbeddingModelSpec {
    id: string;
    label: string;
    provider: 'openai' | 'voyage';
    dim: number;
}

export const EMBEDDING_MODEL_CATALOG: EmbeddingModelSpec[] = [
    {
        id: 'openai/text-embedding-3-small',
        label: 'OpenAI text-embedding-3-small (1536d)',
        provider: 'openai',
        dim: 1536,
    },
    {
        id: 'openai/text-embedding-3-large',
        label: 'OpenAI text-embedding-3-large (3072d)',
        provider: 'openai',
        dim: 3072,
    },
    {
        id: 'voyageai/voyage-3',
        label: 'Voyage 3 (1024d)',
        provider: 'voyage',
        dim: 1024,
    },
    {
        id: 'voyageai/voyage-3-lite',
        label: 'Voyage 3 Lite (512d)',
        provider: 'voyage',
        dim: 512,
    },
];

export const EMBEDDING_MODEL_MAP = new Map<string, EmbeddingModelSpec>(
    EMBEDDING_MODEL_CATALOG.map((spec) => [spec.id, spec])
);

export function getDefaultEmbeddingModelId(): string {
    return process.env.OPENROUTER_EMBED_MODEL || 'openai/text-embedding-3-small';
}

export function resolveEmbeddingModel(requestedModel?: unknown): EmbeddingModelSpec | null {
    const candidate =
        typeof requestedModel === 'string' && requestedModel.trim()
            ? requestedModel.trim()
            : getDefaultEmbeddingModelId();

    const known = EMBEDDING_MODEL_MAP.get(candidate);
    if (known) return known;

    // Allow explicit environment override if configured by operator, otherwise reject unknown client models
    if (!requestedModel && process.env.OPENROUTER_EMBED_MODEL === candidate) {
        const provider = candidate.startsWith('voyageai/') ? 'voyage' : 'openai';
        const envDim = Number(process.env.OPENROUTER_EMBED_DIM);
        return {
            id: candidate,
            label: candidate,
            provider,
            dim: Number.isInteger(envDim) && envDim > 0 ? envDim : 0,
        };
    }

    return null;
}
