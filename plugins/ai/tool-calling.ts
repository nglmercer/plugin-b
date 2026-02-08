import { withLLMModel } from "./model-manager";
import { parseLLMResponse } from "./parser";
import { tools, type ToolName } from "./tools";

const TOOL_CALLING_PROMPT = `
You are a helpful assistant with access to the following tools:

1. search_embedding: Search the knowledge base for relevant information.
   Parameters: query (string, required), limit (number, optional, default 5)

2. save_embedding: Save information to the knowledge base.
   Parameters: title (string, required), content (string, required), metadata (object, optional)

3. chat: Respond directly to the user without using the knowledge base.
   Parameters: message (string, required)

4. tts: Convert text to speech and save audio file.
   Parameters: text (string, required), voice (string, optional, default "F1"), filename (string, optional)

5. evaluate_quality: Evaluate if a message is high quality and worth responding to.
   Parameters: message (string, required), minScore (number, optional, default 30)
   Returns: { isHighQuality: boolean, score: number, reasons: string[], recommendation: string }

When you need to use a tool, respond with a JSON object in this exact format:
{
  "tool": "tool_name",
  "arguments": { ... }
}

If you don't need to use any tool, just respond normally with your answer.

Examples:
User: "What is the capital of France?"
Assistant: {
  "tool": "search_embedding",
  "arguments": { "query": "capital of France", "limit": 5 }
}

User: "Hello, how are you?"
Assistant: {
  "tool": "chat",
  "arguments": { "message": "Hello, how are you?" }
}

User: "Remember that my favorite color is blue"
Assistant: {
  "tool": "save_embedding",
  "arguments": { "title": "User preference", "content": "User's favorite color is blue", "metadata": { "type": "preference" } }
}

User: "Say hello in Spanish"
Assistant: {
  "tool": "tts",
  "arguments": { "text": "Hola", "voice": "F1" }
}
`;

export async function runWithTools(userInput: string): Promise<string> {
  return withLLMModel(
    async (model) => {
      // Primera llamada: el modelo decide si usar herramientas
      const response = await model.respond([
        { role: "system", content: TOOL_CALLING_PROMPT },
        { role: "user", content: userInput }
      ], { temperature: 0.1 });

      const content = response.content.trim();

      // Intentar parsear como tool call
      try {
        const toolCall = parseLLMResponse<{ tool: ToolName; arguments: any }>(content);

        if (toolCall.tool && tools[toolCall.tool]) {
          // Ejecutar la herramienta
          const result = await tools[toolCall.tool](toolCall.arguments);

          // Segunda llamada: dar el resultado al modelo para que genere la respuesta final
          const finalResponse = await model.respond([
            { role: "system", content: TOOL_CALLING_PROMPT },
            { role: "user", content: userInput },
            { role: "assistant", content: content },
            { role: "system", content: `Tool result: ${JSON.stringify(result)}` }
          ], { temperature: 0.7 });

          return finalResponse.content;
        } else {
          // No es una tool call, es una respuesta normal
          return content;
        }
      } catch (error) {
        // Si no se puede parsear, asumir que es una respuesta normal
        return content;
      }
    },
    "Lo siento, no estoy disponible para responder en este momento."
  );
}
