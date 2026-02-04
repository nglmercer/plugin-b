// llmstudio.ts - LLM utilities with try-catch for LM Studio
import { withLLMModel } from "./model-manager";
import { z } from "zod";

// Define the schema with Zod for better type safety
const detectionSchema = z.object({
  language: z.enum(["en", "ko", "es", "pt", "fr", "unknown"]),
  summary: z.string().optional().describe("summary"),
});

export type DetectionResult = z.infer<typeof detectionSchema>;

/**
 * Detect language from text using LM Studio
 * Returns null if LM Studio is not available
 */
export async function detectLanguage(text: string): Promise<DetectionResult | null> {
  return withLLMModel(
    async (model) => {
      const systemPrompt = `
You are a precise language detection tool.
Analyze the user input and extract the language and a summary.
Respond ONLY with a valid JSON object. Do not add any other text, markdown formatting, or explanations.
Format:
{
  "language": "en" | "ko" | "es" | "pt" | "fr" | "unknown",
  "summary": "brief summary of the text"
}
      `;
      
      const result = await model.respond([
        { role: "system", content: systemPrompt },
        { role: "user", content: text.substring(0, 1000) }
      ], {
        temperature: 0.1,
      });

      let content = result.content.trim();
      // Remove markdown code blocks if present
      if (content.startsWith("```")) {
        content = content.replace(/^```(json)?\n?/, "").replace(/\n?```$/, "");
      }

      try {
        return JSON.parse(content) as DetectionResult;
      } catch (e) {
        // Fallback: try to find start and end brackets
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          try {
            return JSON.parse(content.substring(start, end + 1)) as DetectionResult;
          } catch (inner) {
             console.error("Failed to parse JSON from LLM response:", content);
             throw e;
          }
        }
        throw e;
      }
    },
    null // fallback value when LM Studio is not available
  );
}

/**
 * Simple test for language detection
 */
async function test() {
  console.log("[LLMStudio] Testing language detection...");
  
  const testTexts = [
    "Hello, how are you?",
    "Hola, ¿cómo estás?",
    "Bonjour, comment allez-vous?",
    "Olá, como vai?",
    "안녕하세요"
  ];
  
  for (const text of testTexts) {
    console.log(`\n[LLMStudio] Testing: "${text}"`);
    try {
      const result = await detectLanguage(text);
      if (result) {
        console.log(`[LLMStudio] Detected language: ${result.language}`);
      } else {
        console.warn("[LLMStudio] LM Studio not available");
      }
    } catch (error) {
      console.error(`[LLMStudio] Error detecting language:`, error);
    }
  }
}

// Run test if this file is executed directly
if (import.meta.main) {
  test();
}

export { test };
