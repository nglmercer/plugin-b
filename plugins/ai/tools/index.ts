import { searchEmbeddingTool } from "./search-embedding";
import { saveEmbeddingTool } from "./save-embedding";
import { chatTool } from "./chat";
import { ttsTool } from "./tts";
import { evaluateMessageQualityTool } from "./message-quality";

export const tools = {
  search_embedding: searchEmbeddingTool,
  save_embedding: saveEmbeddingTool,
  chat: chatTool,
  tts: ttsTool,
  evaluate_quality: evaluateMessageQualityTool
} as const;

export type ToolName = keyof typeof tools;

export { searchEmbeddingTool, saveEmbeddingTool, chatTool, ttsTool, evaluateMessageQualityTool };
