import { auth } from '../lib/firebase';

export async function fetchEmbeddings(texts: string[], mode: 'document' | 'query', signal?: AbortSignal): Promise<number[][]> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify({texts, mode}),
    signal
  });
  
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  
  const {vectors} = await response.json();
  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    throw new Error('Risposta embedding non valida');
  }
  return vectors;
}
