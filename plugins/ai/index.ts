// plugins/ai/index.ts - Reusable AI module exports
export * from "./constants";

// Model manager exports
import {
  initializeLMStudio,
  isLMStudioAvailable,
  getInitializationError,
  getEmbeddingModel,
  getLLMModel,
  withEmbeddingModel,
  withLLMModel,
  resetModelManager,
} from "./model-manager";
export {
  initializeLMStudio,
  isLMStudioAvailable,
  getInitializationError,
  getEmbeddingModel,
  getLLMModel,
  withEmbeddingModel,
  withLLMModel,
  resetModelManager,
};

// Database exports
import {
  initializeDatabase,
  isDatabaseAvailable,
  addDocuments,
  searchDocuments,
  getDocumentById,
  deleteDocument,
  getAllDocuments,
  getDocumentCount,
  resetDatabase,
  type DocumentRecord,
} from "./lancedb-store";
export {
  initializeDatabase,
  isDatabaseAvailable,
  addDocuments,
  searchDocuments,
  getDocumentById,
  deleteDocument,
  getAllDocuments,
  getDocumentCount,
  resetDatabase,
  type DocumentRecord,
};

/**
 * Initialize the AI module (LM Studio + LanceDB)
 * Returns true if both are available, false otherwise
 */
export async function initializeAI(): Promise<{
  lmStudio: boolean;
  database: boolean;
}> {
  const [lmStudio, database] = await Promise.all([
    initializeLMStudio(),
    initializeDatabase(),
  ]);
  
  return { lmStudio, database };
}

/**
 * Check if AI module is fully available
 */
export function isAIAvailable(): boolean {
  return isLMStudioAvailable() && isDatabaseAvailable();
}

/**
 * Basic test for checking AI module response
 */
async function testAI() {
    try {
        

  console.log("[AI Module] Starting AI module test...\n");
  
  // Test initialization
  console.log("[AI Module] Testing initialization...");
  const { lmStudio, database } = await initializeAI();
  
  console.log(`[AI Module] LM Studio available: ${lmStudio}`);
  console.log(`[AI Module] Database available: ${database}`);
  
  if (lmStudio) {
    // Test embedding
    console.log("\n[AI Module] Testing embedding...");
    const embedding = await withEmbeddingModel(
      async (model) => {
        const result = await model.embed("Hello, world!");
        return result.embedding.length;
      },
      0
    );
    console.log(`[AI Module] Embedding dimension: ${embedding}`);
    
    // Test language detection
    console.log("\n[AI Module] Testing language detection...");
    const detection = await withLLMModel(
      async (model) => {
        const result = await model.respond([
          { role: "system", content: "Respond with JSON: {language: string}" },
          { role: "user", content: "Hola, cómo estás?" }
        ], { temperature: 0.1 });
        return result.content;
      },
      '{"language": "unavailable"}'
    );
    console.log(`[AI Module] Language detection response: ${detection}`);
  } else {
    console.warn("\n[AI Module] LM Studio not available, skipping model tests");
    const error = getInitializationError();
    if (error) {
      console.warn(`[AI Module] Error: ${error.message}`);
    }
  }
  
  if (database) {
    console.log("\n[AI Module] Testing database...");
    const count = await getDocumentCount();
    console.log(`[AI Module] Document count: ${count}`);
  } else {
    console.warn("[AI Module] Database not available");
  }
  
  console.log("\n[AI Module] Test completed!");
    } catch (error) {
        
    }
    setTimeout(function a(){
    console.log("timeout")
  },5000)
}

// Run test if this file is executed directly
if (import.meta.main) {
  testAI();
}

export { testAI };
