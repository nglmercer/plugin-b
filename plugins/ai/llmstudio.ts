import { LMStudioClient,LLM } from "@lmstudio/sdk";  
import { z,type ZodType } from "zod";  

// Define el esquema con Zod para mejor type safety  
const languageSchema: ZodType<{ language: "en" | "ko" | "es" | "pt" | "fr" }> =   
  z.object({  
    language: z.enum(["en", "ko", "es", "pt", "fr"])  
  });  
    
const client = new LMStudioClient();  
let cachedModel: LLM | null = null;  
  
async function getModel() {  
  if (!cachedModel) {  
    cachedModel = await client.llm.model("LiquidAI/LFM2.5-VL-1.6B-GGUF");  
  }  
  return cachedModel;  
}  
const model = await getModel();  
export async function detectLanguage(text: string) {  
  // Use Zod's built-in toJSONSchema method (available in Zod v4+)
  const jsonSchema = languageSchema.toJSONSchema();
  
  const result = await model.respond([
    { role: "system", content: "Detect the language of the user text. Output JSON." },
    { role: "user", content: text.substring(0, 500) }
  ], {
    temperature: 0.1,
    structured: {
      type: "json",
      jsonSchema: jsonSchema,
    },
    maxTokens: 100,
  });

  return JSON.parse(result.content) as { language: "en" | "ko" | "es" | "pt" | "fr" };
}
async function test(){
    const testTexts = [
        "Hello, how are you?",
        "Hola, ¿cómo estás?",
        "Bonjour, comment allez-vous?",
        "Olá, como vai?",
        "안녕하세요"
    ];
    
    for (const text of testTexts) {
        console.log(`\nTesting: "${text}"`);
        try {
            const result = await detectLanguage(text);
            console.log(`Detected language: ${result.language}`);
        } catch (error) {
            console.error(`Error detecting language: ${error}`);
        }
    }
}

// Run test if this file is executed directly
if (import.meta.main) {
    test();
}