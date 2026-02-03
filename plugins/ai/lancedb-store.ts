// lancedb-store.ts - LanceDB storage for embeddings and documents
import lancedb, { type Connection, type Table, type SchemaLike } from "@lancedb/lancedb";
import type { EmbeddingModel } from "@lmstudio/sdk";
import { CONFIG } from "./constants";
import * as path from "path";
import * as fs from "fs";

// Table schema interface
export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// Define the schema using FieldLike objects (type-safe without needing Arrow imports)
const documentSchema: SchemaLike = {
  fields: [
    { type: "utf8", name: "id", nullable: false },
    { type: "utf8", name: "title", nullable: false },
    { type: "utf8", name: "content", nullable: false },
    { type: `fixed_size_list<${768}, float32>`, name: "embedding", nullable: false },
    { type: "null", name: "metadata", nullable: true },
    { type: "timestamp[ms]", name: "createdAt", nullable: false },
  ],
  metadata: new Map(),
  get names() {
    return ["id", "title", "content", "embedding", "metadata", "createdAt"];
  },
};

let db: Connection | null = null;
let table: Table | null = null;
let isInitialized = false;

/**
 * Initialize LanceDB connection
 */
export async function initializeDatabase(): Promise<boolean> {
  if (isInitialized) return true;
  
  try {
    const dbPath = path.resolve(CONFIG.DB_URI);
    
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    db = await lancedb.connect(dbPath);
    
    // Create table if it doesn't exist
    const tableNames = await db.tableNames();
    if (!tableNames.includes(CONFIG.TABLE_NAME)) {
      // Create empty table with proper schema
      table = await db.createEmptyTable(CONFIG.TABLE_NAME, documentSchema);
    } else {
      table = await db.openTable(CONFIG.TABLE_NAME);
    }
    
    isInitialized = true;
    console.log("[LanceDBStore] Database initialized successfully");
    return true;
  } catch (error) {
    console.error("[LanceDBStore] Failed to initialize database:", error);
    return false;
  }
}

/**
 * Check if database is available
 */
export function isDatabaseAvailable(): boolean {
  return isInitialized && db !== null && table !== null;
}

/**
 * Add documents to the database with embeddings
 */
export async function addDocuments(
  documents: Array<{ id: string; title: string; content: string; metadata?: Record<string, unknown> }>,
  embeddingModel: EmbeddingModel | null
): Promise<boolean> {
  if (!isDatabaseAvailable() || !table) {
    console.warn("[LanceDBStore] Database not available");
    return false;
  }
  
  if (!embeddingModel) {
    console.warn("[LanceDBStore] No embedding model available");
    return false;
  }
  
  try {
    // Generate embeddings
    const embeddings = await Promise.all(
      documents.map(doc => embeddingModel.embed(doc.content))
    );
    
    // Prepare records
    const records = documents.map((doc, index) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      embedding: embeddings[index]?.embedding ?? [],
      metadata: doc.metadata ?? null,
      createdAt: new Date(),
    }));
    
    // Add to table
    await table.add(records);
    
    console.log(`[LanceDBStore] Added ${records.length} documents`);
    return true;
  } catch (error) {
    console.error("[LanceDBStore] Failed to add documents:", error);
    return false;
  }
}

/**
 * Search documents by similarity
 */
export async function searchDocuments(
  query: string,
  embeddingModel: EmbeddingModel | null,
  limit: number = 10
): Promise<Array<{ id: string; title: string; content: string; score: number }>> {
  if (!isDatabaseAvailable() || !embeddingModel || !table) {
    console.warn("[LanceDBStore] Database or embedding model not available");
    return [];
  }
  
  try {
    const queryEmbedding = await embeddingModel.embed(query);
    
    const results = await table
      .search(queryEmbedding.embedding)
      .limit(limit)
      .toArray();
    
    return results.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      score: row._distance,
    }));
  } catch (error) {
    console.error("[LanceDBStore] Search failed:", error);
    return [];
  }
}

/**
 * Get document by ID using SQL query
 */
export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  if (!isDatabaseAvailable() || !table) {
    return null;
  }
  
  try {
    const results = await table.query().where(`id = '${id}'`).toArray();
    if (results.length === 0) return null;
    
    const row = results[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      embedding: row.embedding,
      metadata: row.metadata,
      createdAt: row.createdAt,
    };
  } catch (error) {
    console.error("[LanceDBStore] Failed to get document:", error);
    return null;
  }
}

/**
 * Delete document by ID
 */
export async function deleteDocument(id: string): Promise<boolean> {
  if (!isDatabaseAvailable() || !table) {
    return false;
  }
  
  try {
    await table.delete(`id = '${id}'`);
    console.log(`[LanceDBStore] Deleted document: ${id}`);
    return true;
  } catch (error) {
    console.error("[LanceDBStore] Failed to delete document:", error);
    return false;
  }
}

/**
 * Get all documents using SQL query
 */
export async function getAllDocuments(): Promise<DocumentRecord[]> {
  if (!isDatabaseAvailable() || !table) {
    return [];
  }
  
  try {
    const results = await table.query().toArray();
    return results.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      embedding: row.embedding,
      metadata: row.metadata,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error("[LanceDBStore] Failed to get all documents:", error);
    return [];
  }
}

/**
 * Get document count
 */
export async function getDocumentCount(): Promise<number> {
  if (!isDatabaseAvailable() || !table) {
    return 0;
  }
  
  try {
    const results = await table.query().toArray();
    return results.length;
  } catch (error) {
    console.error("[LanceDBStore] Failed to count documents:", error);
    return 0;
  }
}

/**
 * Reset the database connection
 */
export function resetDatabase(): void {
  table = null;
  db = null;
  isInitialized = false;
}
