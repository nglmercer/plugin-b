// embedding.ts - Embedding utilities with try-catch for LM Studio
import { getEmbeddingModel, withEmbeddingModel } from "./model-manager";
import { CONFIG } from "./constants";

/**
 * Generate embedding for text using LM Studio
 * Returns null if LM Studio is not available
 */
export async function embedText(text: string): Promise<number[] | null> {
  return withEmbeddingModel(
    async (model) => {
      const result = await model.embed(text);
      return result.embedding;
    },
    null // fallback value
  );
}

/**
 * Generate embeddings for multiple texts
 * Returns empty array if LM Studio is not available
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  return withEmbeddingModel(
    async (model) => {
      const results = await Promise.all(
        texts.map((text) => model.embed(text))
      );
      return results.map((r) => r.embedding);
    },
    null
  );
}

/**
 * Simple embedding test
 */
async function testEmbedding() {
  console.log("[Embedding] Testing embedding model...");
  
  const model = await getEmbeddingModel();
  if (!model) {
    console.warn("[Embedding] LM Studio not available, skipping test");
    return;
  }
  
  try {
    const testTexts = [
      "Hello, world!",
      "Hola, mundo!",
      "Bonjour, le monde!"
    ];
    
    for (const text of testTexts) {
      console.log(`[Embedding] Testing: "${text.substring(0, 30)}..."`);
      const embedding = await embedText(text);
      if (embedding) {
        console.log(`[Embedding] Generated embedding with ${embedding.length} dimensions`);
      } else {
        console.warn("[Embedding] Failed to generate embedding");
      }
    }
    
    console.log("[Embedding] Test completed");
  } catch (error) {
    console.error("[Embedding] Test error:", error);
  }
}

// Run test if this file is executed directly
if (import.meta.main) {
  testEmbedding();
}

export { testEmbedding };
