export const EMB_MODEL = 'openai/text-embedding-3-small';
export const EMB_DIM = 1536;
export const ARCHIVE_VERSION = 2;

export interface FieldDef {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'list' | 'image' | 'video' | 'link' | 'select';
  required?: boolean;
  options?: string[];
  multi?: boolean;
}

export interface Template {
  id: string;
  name: string;
  cardColor: string;
  fieldColor: string;
  fields: FieldDef[];
}

export interface Rec {
  id: string;
  titolo: string;
  tipo: string;
  categoria: string;
  contenuto: string;
  tags: string[];
  tag: string[];
  outlinks: string[];
  fonte: string;
  campi: Record<string, any>;
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
    templates?: Template[];
  };
  records: Rec[];
}
