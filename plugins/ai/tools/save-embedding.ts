import { getEmbeddingModel } from "../model-manager";
import { addDocuments, isDatabaseAvailable } from "../lancedb-store";

export async function saveEmbeddingTool(args: { title: string; content: string; metadata?: Record<string, any> }): Promise<any> {
  if (!isDatabaseAvailable()) {
    return { error: "Database not available" };
  }

  const embeddingModel = await getEmbeddingModel();
  if (!embeddingModel) {
    return { error: "Embedding model not available" };
  }

  try {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const success = await addDocuments([{
      id,
      title: args.title,
      content: args.content,
      metadata: args.metadata
    }], embeddingModel);

    return { success, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
