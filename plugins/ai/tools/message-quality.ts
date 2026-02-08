/**
 * AI Tool for evaluating message quality
 * Helps the AI decide if a message is worth responding to with TTS
 */

import { evaluateMessageQuality, type QualityResult } from "../../../src/services/message-quality";

interface MessageQualityArgs {
  message: string;
  minScore?: number;
}

interface MessageQualityResult {
  isHighQuality: boolean;
  score: number;
  reasons: string[];
  recommendation: string;
}

/**
 * Tool for AI to evaluate message quality before responding
 */
export async function evaluateMessageQualityTool(
  args: MessageQualityArgs
): Promise<MessageQualityResult> {
  const { message, minScore = 30 } = args;
  
  const quality = evaluateMessageQuality(message, { minScore });
  
  let recommendation: string;
  if (quality.isHighQuality) {
    recommendation = "This message is suitable for TTS response.";
  } else if (quality.score >= 20) {
    recommendation = "This message is borderline. Consider responding with a short acknowledgment.";
  } else {
    recommendation = "This message is low quality. Skip TTS response.";
  }
  
  return {
    isHighQuality: quality.isHighQuality,
    score: quality.score,
    reasons: quality.reasons,
    recommendation,
  };
}

/**
 * Batch evaluate multiple messages
 */
export async function batchEvaluateQuality(
  messages: string[]
): Promise<{ message: string; quality: QualityResult }[]> {
  return messages.map(msg => ({
    message: msg,
    quality: evaluateMessageQuality(msg),
  }));
}

// Export for tool registry
export default evaluateMessageQualityTool;
