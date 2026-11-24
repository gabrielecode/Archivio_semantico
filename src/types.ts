export const EMB_MODEL = 'openai/text-embedding-3-small';
export const EMB_DIM = 1536;
export const ARCHIVE_VERSION = 2;

export interface EmbeddingModelOption {
  id: string;
  label: string;
  provider: 'openai' | 'voyage';
  dim: number;
}

export const EMBEDDING_MODELS: EmbeddingModelOption[] = [
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

export function getEmbeddingModelMeta(modelId?: string): EmbeddingModelOption {
  return EMBEDDING_MODELS.find(m => m.id === modelId) || EMBEDDING_MODELS[0];
}

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
  images: string[];
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

export type GraphNodeType =
  | 'meridian'
  | 'acupoint'
  | 'formula'
  | 'symptom'
  | 'syndrome'
  | 'concept'
  | 'ghost';

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  nodeType: GraphNodeType;
  tags: string[];
  degree: number;
  val: number;
  color: string;
  isGhost: boolean;
  hasEmbedding: boolean;
  record?: Rec;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export type GraphLinkKind = 'explicit' | 'metadata' | 'semantic';

export interface GraphLink {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  kind: GraphLinkKind;
  tipoRelazione: string;
  similarity?: number;
  weight: number;
  isGhost?: boolean;
  dashed?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
