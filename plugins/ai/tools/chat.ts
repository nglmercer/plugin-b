import { withLLMModel } from "../model-manager";

export async function chatTool(args: { message: string }): Promise<any> {
  return withLLMModel(
    async (model) => {
      const result = await model.respond([
        { role: "system", content: "You are a helpful assistant. Respond concisely and clearly." },
        { role: "user", content: args.message }
      ], { temperature: 0.7 });
      return { response: result.content };
    },
    { response: "I'm sorry, I'm not available to respond right now." }
  );
}
