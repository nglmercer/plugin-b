import * as lancedb from "@lancedb/lancedb";
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { GemmaEmbeddingFunction } from "./embedding";
import { CONFIG, DocumentSchema, QuerySchema } from "./constants";
import { type } from "arktype";

export class HybridRAG {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private embeddingFunction: GemmaEmbeddingFunction;

  constructor(private readonly tableName: string = CONFIG.TABLE_NAME) {
    this.embeddingFunction = new GemmaEmbeddingFunction();
  }

  async initialize(uri: string = CONFIG.DB_URI) {
    this.db = await lancedb.connect(uri);
    try {
      this.table = await this.db.openTable(this.tableName);
    } catch {
      console.log(`Table ${this.tableName} ready for creation.`);
    }
  }

  async addDocuments(rawTexts: unknown) {
    // VALIDACIÓN CORRECTA v2.x
    const out = DocumentSchema(rawTexts);

    // Si hay errores, 'out' tendrá una propiedad 'problems'
    if (out instanceof type.errors) {
      throw new Error(`Error de validación: ${out.summary}`);
    }

    // En este punto, 'out' es un string[] validado por TypeScript y Arktype
    if (!this.db) throw new Error("RAG no inicializado");
    
    const data = out.map((text) => ({ text }));

    if (!this.table) {
      this.table = await this.db.createTable({
        name: this.tableName,
        data,
        embeddingFunction: {
          sourceColumn: "text",
          vectorColumn: "vector",
          function: this.embeddingFunction
        }
      });
    } else {
      await this.table.add(data);
    }
  }

  async query(userQuery: string, limit: number = 3) {
    // Validamos el input de la query
  const validation = QuerySchema({ prompt: userQuery, limit });
    
    if (validation instanceof type.errors) {
      throw new Error(validation.summary);
    }
    if (!this.table) throw new Error("Table not initialized");

    const results = await this.table
      .search(userQuery)
      .limit(limit)
      .toArray();

    const context = results.map((r) => r.text).join("\n---\n");

    const { text } = await generateText({
      model: deepseek(CONFIG.MODELS.CHAT), // No magic string
      system: "Eres un experto técnico. Responde basándote estrictamente en el contexto.",
      prompt: `Contexto:\n${context}\n\nPregunta: ${userQuery}`,
    });

    return text;
  }
}