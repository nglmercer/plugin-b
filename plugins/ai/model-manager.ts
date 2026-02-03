// model-manager.ts - Reusable LM Studio model manager with try-catch
import { LMStudioClient, LLM, EmbeddingModel } from "@lmstudio/sdk";
import { CONFIG } from "./constants";

// Singleton client instance
let client: LMStudioClient | null = null;
let embeddingModel: EmbeddingModel | null = null;
let llmModel: LLM | null = null;
let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize LM Studio client with error handling
 * Returns true if successful, false if LM Studio is not available
 */
export async function initializeLMStudio(): Promise<boolean> {
  if (isInitialized) return initializationError === null;
  
  try {
    client = new LMStudioClient();
    
    // Test connection by attempting to load a model (lightweight check)
    await client.embedding.model(CONFIG.MODELS.EMBEDDING);
    
    isInitialized = true;
    initializationError = null;
    console.log("[ModelManager] LM Studio initialized successfully");
    return true;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.warn("[ModelManager] LM Studio not available:", initializationError.message);
    return false;
  }
}

/**
 * Check if LM Studio is available
 */
export function isLMStudioAvailable(): boolean {
  return isInitialized && initializationError === null && client !== null;
}

/**
 * Get the last initialization error
 */
export function getInitializationError(): Error | null {
  return initializationError;
}

/**
 * Get embedding model with try-catch
 * Returns null if model is not available
 */
export async function getEmbeddingModel(): Promise<EmbeddingModel | null> {
  if (!isLMStudioAvailable()) {
    console.warn("[ModelManager] LM Studio not available for embedding model");
    return null;
  }
  
  if (embeddingModel) return embeddingModel;
  
  try {
    embeddingModel = await client!.embedding.model(CONFIG.MODELS.EMBEDDING);
    return embeddingModel;
  } catch (error) {
    console.error("[ModelManager] Failed to load embedding model:", error);
    return null;
  }
}

/**
 * Get LLM model with try-catch
 * Returns null if model is not available
 */
export async function getLLMModel(): Promise<LLM | null> {
  if (!isLMStudioAvailable()) {
    console.warn("[ModelManager] LM Studio not available for LLM model");
    return null;
  }
  
  if (llmModel) return llmModel;
  
  try {
    llmModel = await client!.llm.model(CONFIG.MODELS.CHAT);
    return llmModel;
  } catch (error) {
    console.error("[ModelManager] Failed to load LLM model:", error);
    return null;
  }
}

/**
 * Execute a function with the embedding model, handling errors gracefully
 */
export async function withEmbeddingModel<T>(
  fn: (model: EmbeddingModel) => Promise<T>,
  fallback: T
): Promise<T> {
  const model = await getEmbeddingModel();
  if (!model) return fallback;
  
  try {
    return await fn(model);
  } catch (error) {
    console.error("[ModelManager] Error using embedding model:", error);
    return fallback;
  }
}

/**
 * Execute a function with the LLM model, handling errors gracefully
 */
export async function withLLMModel<T>(
  fn: (model: LLM) => Promise<T>,
  fallback: T
): Promise<T> {
  const model = await getLLMModel();
  if (!model) return fallback;
  
  try {
    return await fn(model);
  } catch (error) {
    console.error("[ModelManager] Error using LLM model:", error);
    return fallback;
  }
}

/**
 * Reset the model manager (useful for reconnection)
 */
export function resetModelManager(): void {
  client = null;
  embeddingModel = null;
  llmModel = null;
  isInitialized = false;
  initializationError = null;
}
