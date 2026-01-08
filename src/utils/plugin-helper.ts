import type { PluginContext } from "bun_plugins";
import type { TTSService } from "../services/audio";

/**
 * Helper function para obtener plugins con tipado estático
 * Esta función permite obtener plugins con autocompletado sin depender de tipos generados dinámicamente
 */
export async function getPlugin<T>(context: PluginContext, name: string): Promise<T | undefined> {
  return await context.getPlugin(name) as T | undefined;
}

/**
 * Obtiene el servicio TTS con el tipo correcto
 */
export async function getTTSService(context: PluginContext): Promise<TTSService | undefined> {
  return await getPlugin<TTSService>(context, "tts-service");
}
