export const EMB_MODEL = 'openai/text-embedding-3-small';
export const EMB_DIM = 1536;
export const ARCHIVE_VERSION = 2;

export interface Rec {
  id: string;
  titolo: string;
  tipo: string;
  contenuto: string;
  tags: string[];
  fonte: string;
  campi: Record<string, string>;
  creato: string;
  modificato: string;
  embHash: string;
  chunks: { testo: string; embedding: number[] }[];
}

export interface Archive {
  version: number;
  nome: string;
  creato: string;
  modificato: string;
  model: string;
  dim: number;
  schema: {
    campi: { chiave: string; etichetta: string }[];
    tipi: string[];
  };
  records: Rec[];
}
