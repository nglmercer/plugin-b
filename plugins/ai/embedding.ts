// embedding.ts
import { Float32 } from "apache-arrow";
import {
  AutoModel,
  AutoTokenizer,
  type PreTrainedModel,
  type PreTrainedTokenizer,
} from "@huggingface/transformers";
import { EmbeddingFunction, register } from "@lancedb/lancedb/embedding";
import { CONFIG } from "./constants";
@register("GemmaEmbeddingFunction")
export class GemmaEmbeddingFunction extends EmbeddingFunction<string> {
  sourceColumn = "text";
  vectorColumn = "vector";

  private modelId = CONFIG.MODELS.EMBEDDING;
  private tokenizer: PreTrainedTokenizer | null = null;
  private model: PreTrainedModel | null = null;

  private readonly prefixes = CONFIG.PREFIXES;

  constructor() {
    super();
  }

  override embeddingDataType() {
    return new Float32();
  }

  override async init() {
    if (this.model) return;
    
    this.tokenizer = await AutoTokenizer.from_pretrained(this.modelId);
    this.model = await AutoModel.from_pretrained(this.modelId, { dtype: "q8" });
  }

  private async computeEmbedding(texts: string[], prefix: string): Promise<number[][]> {
    await this.init();
    const prefixedTexts = texts.map((t) => prefix + t);

    // @ts-ignore
    const inputs = await this.tokenizer!(prefixedTexts, { padding: true, truncation: true });
    // @ts-ignore
    const { sentence_embedding } = await this.model!(inputs);

    return sentence_embedding.tolist();
  }

  override async computeSourceEmbeddings(data: string[]): Promise<number[][]> {
    return this.computeEmbedding(data, this.prefixes.DOCUMENT);
  }

  override async computeQueryEmbeddings(data: string): Promise<number[]> {
    const embeddings = await this.computeEmbedding([data], this.prefixes.QUERY);
    return embeddings[0] || [];
  }
}