import { auth } from '../lib/firebase';
import { EMBEDDING_MODELS, EmbeddingModelOption } from '../types';

export interface EmbedResponse {
  vectors: number[][];
  model: string;
  dim: number;
}

export interface EmbedHealthResponse {
  embed: boolean;
  defaultModel: string;
  defaultDim: number;
  models: EmbeddingModelOption[];
}

export async function fetchEmbedHealth(signal?: AbortSignal): Promise<EmbedHealthResponse> {
  try {
    const response = await fetch('/api/health', { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return {
      embed: Boolean(data.embed),
      defaultModel: typeof data.defaultModel === 'string' ? data.defaultModel : EMBEDDING_MODELS[0].id,
      defaultDim: typeof data.defaultDim === 'number' ? data.defaultDim : EMBEDDING_MODELS[0].dim,
      models: Array.isArray(data.models) && data.models.length > 0 ? data.models : EMBEDDING_MODELS,
    };
  } catch {
    return {
      embed: true,
      defaultModel: EMBEDDING_MODELS[0].id,
      defaultDim: EMBEDDING_MODELS[0].dim,
      models: EMBEDDING_MODELS,
    };
  }
}

export async function fetchEmbeddings(
  texts: string[],
  mode: 'document' | 'query',
  signal?: AbortSignal,
  model?: string
): Promise<EmbedResponse> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ texts, mode, ...(model ? { model } : {}) }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const vectors = data?.vectors;
  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    throw new Error('Risposta embedding non valida');
  }
  return {
    vectors,
    model: typeof data.model === 'string' ? data.model : model || EMBEDDING_MODELS[0].id,
    dim: typeof data.dim === 'number' ? data.dim : vectors[0]?.length || EMBEDDING_MODELS[0].dim,
  };
}
