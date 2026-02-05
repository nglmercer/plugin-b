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
export async function initializeLMStudio(timeoutMs: number = 5000): Promise<boolean> {
  if (isInitialized) return initializationError === null;
  
  // Store original functions to prevent SDK from crashing the app
  const originalError = console.error;
  let exitCalled = false;
  let rejectionHandled = false;
  

  
  // Override console.error to suppress SDK's boxed error messages during init
  console.error = ((...args: unknown[]) => {
    const message = String(args[0] || '');
    // Suppress LM Studio SDK errors during initialization
    if (message.includes('LM Studio') || message.includes('Failed to connect')) {
      return;
    }
    originalError.apply(console, args as never[]);
  }) as typeof console.error;
  
  // Track unhandled rejections from SDK
  const rejectionHandler = (reason: unknown) => {
    if (!rejectionHandled) {
      rejectionHandled = true;
      const msg = reason instanceof Error ? reason.message : String(reason);
      if (!msg.includes('LM Studio') && !msg.includes('Failed to connect')) {
        originalError("[ModelManager] Unhandled rejection:", reason);
      }
    }
  };
  process.on("unhandledRejection", rejectionHandler);
  
  // Track uncaught exceptions
  let exceptionHandled = false;
  const exceptionHandler = (error: Error) => {
    if (!exceptionHandled) {
      exceptionHandled = true;
      const msg = error.message;
      if (!msg.includes('LM Studio') && !msg.includes('Failed to connect')) {
        originalError("[ModelManager] Uncaught exception:", error);
      }
    }
  };
  process.on("uncaughtException", exceptionHandler);
  
  let initResult = false;
  let initError: Error | null = null;
  
  // Run initialization in a separate promise with timeout
  const initPromise = (async () => {
    try {
      client = new LMStudioClient();
      
      // Test connection by attempting to load a model (lightweight check)
      await client.embedding.model(CONFIG.MODELS.EMBEDDING);
      
      isInitialized = true;
      initializationError = null;
      console.log("[ModelManager] LM Studio initialized successfully");
      initResult = true;
    } catch (error) {
      initError = error instanceof Error ? error : new Error(String(error));
      console.warn("[ModelManager] LM Studio not available:", initError.message);
      initResult = false;
    }
  })();
  
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("LM Studio initialization timed out"));
    }, timeoutMs);
  });
  
  try {
    await Promise.race([initPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === "LM Studio initialization timed out") {
      console.warn("[ModelManager] LM Studio initialization timed out");
      initError = error;
      initResult = false;
    } else {
      throw error;
    }
  } finally {
    // Restore original functions
    console.error = originalError;
    
    // Remove event handlers
    process.off("unhandledRejection", rejectionHandler);
    process.off("uncaughtException", exceptionHandler);
    
    // If exit was called or rejection/exception was handled, mark as failed
    if (exitCalled || rejectionHandled || exceptionHandled) {
      initializationError = new Error("LM Studio SDK initialization failed - service not available");
      isInitialized = false;
      client = null;
    } else if (initError) {
      initializationError = initError;
    }
    
    if (!initResult) {
      isInitialized = false;
      client = null;
    }
  }
  
  return initResult;
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
 * Execute a function with both the client and the LLM model
 */
export async function withLMStudio<T>(
  fn: (client: LMStudioClient, model: LLM) => Promise<T>,
  fallback: T
): Promise<T> {
  if (!isLMStudioAvailable()) return fallback;
  
  const model = await getLLMModel();
  if (!model) return fallback;
  
  try {
    return await fn(client!, model);
  } catch (error) {
    console.error("[ModelManager] Error using LM Studio:", error);
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
