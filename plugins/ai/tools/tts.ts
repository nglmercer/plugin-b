import { TTSService } from "../../tts/index";

export async function ttsTool(args: { text: string; voice?: string; filename?: string }): Promise<any> {
  // Use a dedicated output directory for TTS tool
  const tts = new TTSService("./output/tts_tool");
  
  try {
    const result = await tts.synthesize(
      args.text,
      args.voice || "F1",
      args.filename || `tts_${Date.now()}`
    );
    return { success: true, savedPath: result.savedPath, detectedLanguage: result.detectedLanguage };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
