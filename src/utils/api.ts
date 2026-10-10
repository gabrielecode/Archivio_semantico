export async function fetchEmbeddings(texts: string[], mode: 'document' | 'query', signal?: AbortSignal): Promise<number[][]> {
  const response = await fetch('/api/embed', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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
