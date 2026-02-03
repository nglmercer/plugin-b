// lancedb-store.ts - LanceDB storage for embeddings and documents
import lancedb from "@lancedb/lancedb";
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

let db: any = null;
let table: any = null;
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
      table = await db.createEmptyTable(CONFIG.TABLE_NAME, [
        { name: "id", type: "utf8" },
        { name: "title", type: "utf8" },
        { name: "content", type: "utf8" },
        { name: "embedding", type: "vector", vectorDimensions: 768 },
        { name: "metadata", type: "json", nullable: true },
        { name: "createdAt", type: "timestamp" },
      ]);
    } else {
      table = db.openTable(CONFIG.TABLE_NAME);
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
 * Get embedding dimension from model
 */
async function getEmbeddingDimension(model: EmbeddingModel): Promise<number> {
  const testEmbedding = await model.embed("test");
  return testEmbedding.embedding.length;
}

/**
 * Add documents to the database with embeddings
 */
export async function addDocuments(
  documents: Array<{ id: string; title: string; content: string; metadata?: Record<string, unknown> }>,
  embeddingModel: EmbeddingModel | null
): Promise<boolean> {
  if (!isDatabaseAvailable()) {
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
      metadata: doc.metadata || null,
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
  if (!isDatabaseAvailable() || !embeddingModel) {
    console.warn("[LanceDBStore] Database or embedding model not available");
    return [];
  }
  
  try {
    const queryEmbedding = await embeddingModel.embed(query);
    
    const results = await table
      .search(queryEmbedding.embedding)
      .limit(limit)
      .toArray();
    
    return results.map((row: any) => ({
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
 * Get document by ID
 */
export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  if (!isDatabaseAvailable()) {
    return null;
  }
  
  try {
    const results = await table.filter(`id == "${id}"`).toArray();
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
  if (!isDatabaseAvailable()) {
    return false;
  }
  
  try {
    await table.delete(`id == "${id}"`);
    console.log(`[LanceDBStore] Deleted document: ${id}`);
    return true;
  } catch (error) {
    console.error("[LanceDBStore] Failed to delete document:", error);
    return false;
  }
}

/**
 * Get all documents
 */
export async function getAllDocuments(): Promise<DocumentRecord[]> {
  if (!isDatabaseAvailable()) {
    return [];
  }
  
  try {
    const results = await table.toArray();
    return results.map((row: any) => ({
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
  if (!isDatabaseAvailable()) {
    return 0;
  }
  
  try {
    const count = await table.countRows();
    return count;
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
