import * as ort from "onnxruntime-node";
import { AutoTokenizer } from "@huggingface/transformers";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { dirname } from "path";

// Type definitions
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelConfig {
  hiddenSize: number;
  numKVHeads: number;
  headDim: number;
  maxSteps: number;
  maxBatchSize: number;
  graphOptimizationLevel: "none" | "basic" | "extended" | "all";
  intraOpNumThreads: number;
  interOpNumThreads: number;
  enableMemPattern: boolean;
  enableCpuMemArena: boolean;
}

export interface GenerateOptions {
  maxSteps?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  stream?: boolean;
  onToken?: (token: string) => void | Promise<void>;
}

interface ModelFile {
  name: string;
  url: string;
  size?: number;
}

// Model configuration
const MODEL_ID = "LiquidAI/LFM2.5-VL-1.6B-ONNX";
const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main/onnx`;

const DEFAULT_CONFIG: ModelConfig = {
  hiddenSize: 2048,
  numKVHeads: 8,
  headDim: 64,
  maxSteps: 256,
  maxBatchSize: 8,
  graphOptimizationLevel: "all",
  intraOpNumThreads: 0, // 0 = use all available cores
  interOpNumThreads: 0,
  enableMemPattern: true,
  enableCpuMemArena: true,
};

// Model files to download
const MODEL_FILES: ModelFile[] = [
  { name: "embed_tokens_fp16.onnx", url: `${MODEL_BASE}/embed_tokens_fp16.onnx` },
  { name: "embed_tokens_fp16.onnx_data", url: `${MODEL_BASE}/embed_tokens_fp16.onnx_data` },
  { name: "embed_images_fp16.onnx", url: `${MODEL_BASE}/embed_images_fp16.onnx` },
  { name: "embed_images_fp16.onnx_data", url: `${MODEL_BASE}/embed_images_fp16.onnx_data` },
  { name: "decoder_q4.onnx", url: `${MODEL_BASE}/decoder_q4.onnx` },
  { name: "decoder_q4.onnx_data", url: `${MODEL_BASE}/decoder_q4.onnx_data` },
];

// Download state tracking
interface DownloadState {
  inProgress: Set<string>;
  completed: Set<string>;
  failed: Set<string>;
}

const globalDownloadState: DownloadState = {
  inProgress: new Set(),
  completed: new Set(),
  failed: new Set(),
};

/**
 * Download a file from URL to local path with concurrency control
 */
async function downloadFile(url: string, destPath: string, fileName: string): Promise<void> {
  // Check if already downloading
  if (globalDownloadState.inProgress.has(fileName)) {
    console.log(`Waiting for ${fileName} download to complete...`);
    // Wait for download to complete
    while (globalDownloadState.inProgress.has(fileName)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (globalDownloadState.completed.has(fileName)) {
      return;
    }
    throw new Error(`Download failed for ${fileName}`);
  }

  // Check if already completed
  if (globalDownloadState.completed.has(fileName)) {
    return;
  }

  // Mark as in progress
  globalDownloadState.inProgress.add(fileName);

  try {
    console.log(`Downloading ${fileName}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const dir = dirname(destPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const fileStream = createWriteStream(destPath);

    if (!response.body) {
      throw new Error(`No response body for ${url}`);
    }

    const reader = response.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(Buffer.from(value));
      }
    } finally {
      fileStream.end();
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    globalDownloadState.completed.add(fileName);
    console.log(`✓ Downloaded ${fileName}`);
  } catch (error) {
    globalDownloadState.failed.add(fileName);
    throw error;
  } finally {
    globalDownloadState.inProgress.delete(fileName);
  }
}

/**
 * Get ONNX session configuration with optimizations
 */
function getSessionConfig(config: ModelConfig): ort.InferenceSession.SessionOptions {
  const optimizationLevels: Record<string, "disabled" | "basic" | "extended" | "all"> = {
    none: "disabled",
    basic: "basic",
    extended: "extended",
    all: "all",
  };

  return {
    executionProviders: ["cpu"],
    graphOptimizationLevel: optimizationLevels[config.graphOptimizationLevel] ?? "all",
    intraOpNumThreads: config.intraOpNumThreads,
    interOpNumThreads: config.interOpNumThreads,
    enableMemPattern: config.enableMemPattern,
    enableCpuMemArena: config.enableCpuMemArena,
  };
}

/**
 * LFM (Liquid Foundation Model) inference class
 * Handles ONNX model loading, tokenization, and text generation
 */
export class LFMInference {
  private tokenizer: any = null;
  private embedTokens: ort.InferenceSession | null = null;
  private embedImages: ort.InferenceSession | null = null;
  private decoder: ort.InferenceSession | null = null;
  private config: ModelConfig;
  private modelDir: string;
  private eosTokenId: number | null = null;
  private isInitializedFlag = false;
  private warmupDone = false;

  // Pre-allocated buffers for efficiency
  private attentionMaskBuffer: BigInt64Array | null = null;
  private maxMaskLength = 2048;

  constructor(
    config: Partial<ModelConfig> = {},
    modelDir: string = "./models/lfm"
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelDir = modelDir;

    // Pre-allocate attention mask buffer
    this.attentionMaskBuffer = new BigInt64Array(this.maxMaskLength).fill(BigInt(1));
  }

  /**
   * Check if model files exist, download if missing
   */
  private async ensureModelsDownloaded(): Promise<void> {
    if (!existsSync(this.modelDir)) {
      mkdirSync(this.modelDir, { recursive: true });
    }

    const missingFiles = MODEL_FILES.filter(
      (file) => !existsSync(`${this.modelDir}/${file.name}`)
    );

    if (missingFiles.length === 0) {
      return;
    }

    console.log(`Downloading ${missingFiles.length} missing model files...`);

    // Download files in parallel with concurrency control
    await Promise.all(
      missingFiles.map(file =>
        downloadFile(file.url, `${this.modelDir}/${file.name}`, file.name)
          .catch(error => {
            console.error(`✗ Failed to download ${file.name}:`, error);
            throw error;
          })
      )
    );

    console.log("All model files downloaded successfully.");
  }

  /**
   * Load ONNX session with optimized configuration
   */
  private async loadSession(name: string): Promise<ort.InferenceSession> {
    const onnxPath = `${this.modelDir}/${name}.onnx`;
    const sessionConfig = getSessionConfig(this.config);
    return ort.InferenceSession.create(onnxPath, sessionConfig);
  }

  /**
   * Initialize the model and tokenizer
   * Downloads tokenizer from HuggingFace, loads ONNX models from local directory
   */
  async initialize(): Promise<void> {
    if (this.isInitializedFlag) {
      return;
    }

    // Ensure model files are downloaded
    await this.ensureModelsDownloaded();

    // Load tokenizer from HuggingFace
    this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    this.eosTokenId = this.tokenizer.eos_token_id;

    // Load ONNX sessions from local directory in parallel
    [this.embedTokens, this.embedImages, this.decoder] = await Promise.all([
      this.loadSession("embed_tokens_fp16"),
      this.loadSession("embed_images_fp16"),
      this.loadSession("decoder_q4"),
    ]);

    this.isInitializedFlag = true;
  }

  /**
   * Warm up the model with a dummy inference to reduce first-call latency
   */
  async warmup(): Promise<void> {
    if (!this.isInitializedFlag || this.warmupDone) {
      return;
    }

    try {
      // Warm up embed_tokens
      const dummyIds = [1, 2, 3];
      const dummyTensor = new ort.Tensor(
        "int64",
        new BigInt64Array(dummyIds.map(BigInt)),
        [1, dummyIds.length]
      );
      await this.embedTokens!.run({ input_ids: dummyTensor });
      dummyTensor.dispose();

      // Warm up decoder with minimal input
      const cache = this.initCache();
      const dummyEmbeds = new ort.Tensor(
        "float16",
        new Uint16Array(this.config.hiddenSize),
        [1, 1, this.config.hiddenSize]
      );
      const dummyMask = new ort.Tensor(
        "int64",
        new BigInt64Array([BigInt(1)]),
        [1, 1]
      );

      const inputs: Record<string, ort.OnnxValue> = {
        inputs_embeds: dummyEmbeds,
        attention_mask: dummyMask,
        ...cache,
      };

      const outputs = await this.decoder!.run(inputs);

      // Clean up warmup tensors
      dummyEmbeds.dispose();
      dummyMask.dispose();
      this.disposeCache(cache);
      this.disposeOutputs(outputs);

      this.warmupDone = true;
      console.log("Model warmup completed.");
    } catch (error) {
      console.warn("Warmup failed (non-critical):", error);
    }
  }

  /**
   * Get text embeddings from token IDs - supports batch processing
   */
  private async getTextEmbeddings(ids: number[]): Promise<ort.Tensor> {
    if (!this.embedTokens) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    const tensor = new ort.Tensor(
      "int64",
      new BigInt64Array(ids.map(BigInt)),
      [1, ids.length]
    );

    try {
      const out = await this.embedTokens.run({ input_ids: tensor });
      tensor.dispose();
      return out.inputs_embeds as ort.Tensor;
    } catch (error) {
      tensor.dispose();
      throw error;
    }
  }

  /**
   * Get embeddings for multiple sequences (batch processing)
   */
  async getBatchEmbeddings(sequences: number[][]): Promise<ort.Tensor[]> {
    if (!this.embedTokens) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    // Process in batches if needed
    const results: ort.Tensor[] = [];
    const batchSize = this.config.maxBatchSize;

    for (let i = 0; i < sequences.length; i += batchSize) {
      const batch = sequences.slice(i, i + batchSize);

      // For single sequence, use regular method
      if (batch.length === 1) {
        const embeds = await this.getTextEmbeddings(batch[0]!);
        results.push(embeds);
      } else {
        // For batch, process in parallel
        const batchResults = await Promise.all(
          batch.map(seq => this.getTextEmbeddings(seq))
        );
        results.push(...batchResults);
      }
    }

    return results;
  }

  /**
   * Initialize KV cache for generation
   */
  private initCache(): Record<string, ort.Tensor> {
    if (!this.decoder) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    const cache: Record<string, ort.Tensor> = {};
    const { hiddenSize, numKVHeads, headDim } = this.config;

    for (const name of this.decoder.inputNames) {
      if (name.startsWith("past_conv")) {
        cache[name] = new ort.Tensor(
          "float32",
          new Float32Array(hiddenSize * 3),
          [1, hiddenSize, 3]
        );
      } else if (name.startsWith("past_key_values")) {
        cache[name] = new ort.Tensor(
          "float32",
          new Float32Array(0),
          [1, numKVHeads, 0, headDim]
        );
      }
    }

    return cache;
  }

  /**
   * Update cache from decoder outputs
   */
  private updateCache(
    cache: Record<string, ort.Tensor>,
    outputs: ort.InferenceSession.OnnxValueMapType
  ): void {
    for (const [name, tensor] of Object.entries(outputs)) {
      if (name.startsWith("present_conv")) {
        const cacheKey = name.replace("present_conv", "past_conv");
        if (cache[cacheKey]) {
          cache[cacheKey].dispose();
        }
        cache[cacheKey] = tensor as ort.Tensor;
      } else if (name.startsWith("present.")) {
        const cacheKey = name.replace("present.", "past_key_values.");
        if (cache[cacheKey]) {
          cache[cacheKey].dispose();
        }
        cache[cacheKey] = tensor as ort.Tensor;
      }
    }
  }

  /**
   * Dispose cache tensors
   */
  private disposeCache(cache: Record<string, ort.Tensor>): void {
    for (const tensor of Object.values(cache)) {
      if (tensor && typeof tensor.dispose === "function") {
        tensor.dispose();
      }
    }
  }

  /**
   * Dispose output tensors
   */
  private disposeOutputs(outputs: ort.InferenceSession.OnnxValueMapType): void {
    for (const tensor of Object.values(outputs)) {
      if (tensor && typeof (tensor as ort.Tensor).dispose === "function") {
        (tensor as ort.Tensor).dispose();
      }
    }
  }

  /**
   * Fast argmax using typed array methods
   */
  private fastArgmax(data: Float32Array): number {
    let maxIdx = 0;
    let maxVal = data[0] ?? -Infinity;

    // Use loop unrolling for better performance
    const len = data.length;
    let i = 1;

    // Process 4 elements at a time
    for (; i + 3 < len; i += 4) {
      const v0 = data[i] ?? -Infinity;
      const v1 = data[i + 1] ?? -Infinity;
      const v2 = data[i + 2] ?? -Infinity;
      const v3 = data[i + 3] ?? -Infinity;

      if (v0 > maxVal) { maxVal = v0; maxIdx = i; }
      if (v1 > maxVal) { maxVal = v1; maxIdx = i + 1; }
      if (v2 > maxVal) { maxVal = v2; maxIdx = i + 2; }
      if (v3 > maxVal) { maxVal = v3; maxIdx = i + 3; }
    }

    // Handle remaining elements
    for (; i < len; i++) {
      const val = data[i] ?? -Infinity;
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    }

    return maxIdx;
  }

  /**
   * Build a simple chat prompt without using chat_template
   */
  private buildPrompt(messages: ChatMessage[]): string {
    let prompt = "";
    for (const msg of messages) {
      if (msg.role === "system") {
        prompt += `System: ${msg.content}\n`;
      } else if (msg.role === "user") {
        prompt += `User: ${msg.content}\n`;
      } else if (msg.role === "assistant") {
        prompt += `Assistant: ${msg.content}\n`;
      }
    }
    prompt += "Assistant:";
    return prompt;
  }

  /**
   * Get attention mask tensor (reuses pre-allocated buffer when possible)
   */
  private getAttentionMask(curLen: number): ort.Tensor {
    if (curLen > this.maxMaskLength) {
      // Expand buffer if needed
      this.maxMaskLength = Math.max(curLen * 2, 4096);
      this.attentionMaskBuffer = new BigInt64Array(this.maxMaskLength).fill(BigInt(1));
    }

    // Create tensor from pre-allocated buffer slice
    return new ort.Tensor(
      "int64",
      this.attentionMaskBuffer!.slice(0, curLen),
      [1, curLen]
    );
  }

  /**
   * Generate text from chat messages with streaming support
   */
  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<string> {
    if (!this.tokenizer || !this.decoder || this.eosTokenId === null) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    const maxSteps = options.maxSteps ?? this.config.maxSteps;
    const stream = options.stream ?? false;
    const onToken = options.onToken;

    // Build prompt and encode
    const prompt = this.buildPrompt(messages);
    const inputIds: number[] = this.tokenizer.encode(prompt);

    // Get embeddings
    let inputsEmbeds = await this.getTextEmbeddings(inputIds);

    // Initialize generation state
    const cache = this.initCache();
    const generatedTokens: number[] = [];
    let curLen: number = inputsEmbeds.dims[1] ?? 0;
    let embeds = inputsEmbeds;
    let attentionMask: ort.Tensor | null = null;
    let singleTokenTensor: ort.Tensor | null = null;

    try {
      // Generation loop
      for (let step = 0; step < maxSteps; step++) {
        // Reuse attention mask buffer
        if (attentionMask) {
          attentionMask.dispose();
        }
        attentionMask = this.getAttentionMask(curLen);

        const outputs = await this.decoder.run({
          inputs_embeds: embeds,
          attention_mask: attentionMask,
          ...cache,
        });

        // Dispose previous embeds (except initial)
        if (step > 0 && embeds !== inputsEmbeds) {
          embeds.dispose();
        }

        // Greedy decode: argmax of last token logits
        const logits = outputs.logits as ort.Tensor;
        const vocabSize: number = logits.dims[2] ?? 0;
        const logitsData = logits.data as Float32Array;
        const seqLen: number = logits.dims[1] ?? 1;
        const lastLogits = logitsData.subarray((seqLen - 1) * vocabSize);

        // Fast argmax
        const nextToken = this.fastArgmax(lastLogits);

        generatedTokens.push(nextToken);

        // Stream token if callback provided
        if (stream && onToken) {
          const tokenText = this.tokenizer.decode([nextToken], {
            skip_special_tokens: true,
          });
          await onToken(tokenText);
        }

        if (nextToken === this.eosTokenId) break;

        this.updateCache(cache, outputs);

        // Dispose logits tensor
        logits.dispose();

        // Get embeddings for next token - reuse tensor when possible
        if (singleTokenTensor) {
          singleTokenTensor.dispose();
        }
        singleTokenTensor = new ort.Tensor(
          "int64",
          new BigInt64Array([BigInt(nextToken)]),
          [1, 1]
        );

        const embedOut = await this.embedTokens!.run({ input_ids: singleTokenTensor });
        embeds = embedOut.inputs_embeds as ort.Tensor;

        curLen++;
      }
    } finally {
      // Cleanup
      if (attentionMask) attentionMask.dispose();
      if (singleTokenTensor) singleTokenTensor.dispose();
      if (embeds !== inputsEmbeds) embeds.dispose();
      inputsEmbeds.dispose();
      this.disposeCache(cache);
    }

    return this.tokenizer.decode(generatedTokens, {
      skip_special_tokens: true,
    });
  }

  /**
   * Stream generation - yields tokens as they're generated
   */
  async *streamGenerate(messages: ChatMessage[], options: GenerateOptions = {}): AsyncGenerator<string, void, unknown> {
    if (!this.tokenizer || !this.decoder || this.eosTokenId === null) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    const maxSteps = options.maxSteps ?? this.config.maxSteps;

    // Build prompt and encode
    const prompt = this.buildPrompt(messages);
    const inputIds: number[] = this.tokenizer.encode(prompt);

    // Get embeddings
    let inputsEmbeds = await this.getTextEmbeddings(inputIds);

    // Initialize generation state
    const cache = this.initCache();
    let curLen: number = inputsEmbeds.dims[1] ?? 0;
    let embeds = inputsEmbeds;
    let attentionMask: ort.Tensor | null = null;
    let singleTokenTensor: ort.Tensor | null = null;

    try {
      // Generation loop
      for (let step = 0; step < maxSteps; step++) {
        // Reuse attention mask buffer
        if (attentionMask) {
          attentionMask.dispose();
        }
        attentionMask = this.getAttentionMask(curLen);

        const outputs = await this.decoder.run({
          inputs_embeds: embeds,
          attention_mask: attentionMask,
          ...cache,
        });

        // Dispose previous embeds (except initial)
        if (step > 0 && embeds !== inputsEmbeds) {
          embeds.dispose();
        }

        // Greedy decode: argmax of last token logits
        const logits = outputs.logits as ort.Tensor;
        const vocabSize: number = logits.dims[2] ?? 0;
        const logitsData = logits.data as Float32Array;
        const seqLen: number = logits.dims[1] ?? 1;
        const lastLogits = logitsData.subarray((seqLen - 1) * vocabSize);

        // Fast argmax
        const nextToken = this.fastArgmax(lastLogits);

        // Decode and yield token
        const tokenText = this.tokenizer.decode([nextToken], {
          skip_special_tokens: true,
        });
        yield tokenText;

        if (nextToken === this.eosTokenId) break;

        this.updateCache(cache, outputs);

        // Dispose logits tensor
        logits.dispose();

        // Get embeddings for next token
        if (singleTokenTensor) {
          singleTokenTensor.dispose();
        }
        singleTokenTensor = new ort.Tensor(
          "int64",
          new BigInt64Array([BigInt(nextToken)]),
          [1, 1]
        );

        const embedOut = await this.embedTokens!.run({ input_ids: singleTokenTensor });
        embeds = embedOut.inputs_embeds as ort.Tensor;

        curLen++;
      }
    } finally {
      // Cleanup
      if (attentionMask) attentionMask.dispose();
      if (singleTokenTensor) singleTokenTensor.dispose();
      if (embeds !== inputsEmbeds) embeds.dispose();
      inputsEmbeds.dispose();
      this.disposeCache(cache);
    }
  }

  /**
   * Check if the model is initialized
   */
  isInitialized(): boolean {
    return this.isInitializedFlag;
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    if (this.embedTokens) {
      this.embedTokens.release();
      this.embedTokens = null;
    }
    if (this.embedImages) {
      this.embedImages.release();
      this.embedImages = null;
    }
    if (this.decoder) {
      this.decoder.release();
      this.decoder = null;
    }
    this.tokenizer = null;
    this.isInitializedFlag = false;
    this.warmupDone = false;
  }
}

// Export a singleton instance for convenience
export const lfmInference = new LFMInference();

// Default export
export default LFMInference;

async function main() {
  const model = new LFMInference();
  await model.initialize();
  await model.warmup();

  // Test regular generation
  console.log("Testing regular generation...");
  const response = await model.generate([{ role: "user", content: "Hello!" }]);
  console.log("Response:", response);

  // Test streaming generation
  console.log("\nTesting streaming generation...");
  process.stdout.write("Response: ");
  for await (const token of model.streamGenerate([{ role: "user", content: "Hi!" }])) {
    process.stdout.write(token);
  }
  console.log();

  model.dispose();
}

// Run main if this file is executed directly
if (require.main === module) {
  main();
}
