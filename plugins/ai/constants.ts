import { type } from "arktype";

// Configuración Global
export const CONFIG = {
  DB_URI: "data/lancedb-store",
  TABLE_NAME: "knowledge_base",
  MODELS: {
    EMBEDDING: "text-embedding-qwen3-embedding-0.6b",
    CHAT: "lfm2.5-vl-1.6b"
  },
  PREFIXES: {
    QUERY: "task: search result | query: ",
    DOCUMENT: "title: none | text: ",
  }
} as const;

// Esquemas de Arktype
export const DocumentSchema = type("string[]");
export const QuerySchema = type({
  prompt: "string",
  "limit?": "number"
});

export type ValidatedQuery = typeof QuerySchema.infer;