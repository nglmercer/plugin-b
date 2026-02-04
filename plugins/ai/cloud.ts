import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { CONFIG, DocumentSchema, QuerySchema } from "./constants";

export async function responde(userQuery: string){
const { text } = await generateText({
        model: deepseek(CONFIG.MODELS.CHAT),
        system: "streaming, user, player,friend,short message",
        prompt: `conversation: ${userQuery}`,
    });

    return text;
}