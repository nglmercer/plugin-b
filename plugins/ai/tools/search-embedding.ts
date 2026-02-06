import { getEmbeddingModel } from "../model-manager";
import { searchDocuments, isDatabaseAvailable } from "../lancedb-store";

export async function searchEmbeddingTool(args: { query: string; limit?: number }): Promise<any> {
  if (!isDatabaseAvailable()) {
    return { error: "Database not available" };
  }

  const embeddingModel = await getEmbeddingModel();
  if (!embeddingModel) {
    return { error: "Embedding model not available" };
  }

  try {
    const results = await searchDocuments(args.query, embeddingModel, args.limit || 5);
    return { results };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
