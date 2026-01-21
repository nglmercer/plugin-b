import { StringDetector } from 'string-dac';

const detector = new StringDetector();
/**
 * Representa un mensaje procesado y almacenado.
 */
export interface TTSMessage {
  text: string;
  cleanedText: string;
  timestamp: number;
}

// Almacenamiento minimalista de mensajes
const history: TTSMessage[] = [];

/**
 * Utilidades para el procesamiento de texto TTS.
 */
export const CleanerUtils = {
  /**
   * Limpia el texto eliminando emojis y caracteres especiales.
   * Útil para preparar el texto antes de enviarlo a un motor de voz.
   */
  cleanText(text: string): string {
    if (!text) return "";
    return detector.clean(text, {
      removeEmojis: true,
      replaceEmojis: true,
      removeSymbols: true,
      removeSpecialChars: true
    }).trim();
  },

  /**
   * Procesa un mensaje: lo limpia y lo guarda en el historial.
   */
  registerMessage(text: string): TTSMessage {
    const cleaned = this.cleanText(text);
    const message: TTSMessage = {
      text,
      cleanedText: cleaned,
      timestamp: Date.now()
    };
    
    history.push(message);
    console.log(`[Cleaner] Message registered. History size: ${history.length}. Last: "${cleaned}"`);
    
    // Mantener un historial circular limitado
    if (history.length > 50) {
      history.shift();
    }
    
    return message;
  },

  /**
   * Obtiene el historial de mensajes.
   */
  getHistory(): TTSMessage[] {
    return [...history];
  },

  /**
   * Obtiene el último mensaje procesado.
   */
  getLastMessage(): TTSMessage | undefined {
    return history[history.length - 1];
  }
};

/**
 * ttsSystem - Adaptador simplificado para mantener compatibilidad.
 * Encapsula las utilidades en un objeto similar al original.
 */
export const ttsSystem = {
  /**
   * Procesa un mensaje para el sistema TTS.
   */
  processMessage: (text: string) => CleanerUtils.registerMessage(text),
  
  /**
   * Devuelve el historial de mensajes.
   */
  getMessageHistory: () => CleanerUtils.getHistory(),
  
  /**
   * Permite limpiar texto sin registrarlo en el historial (función pura).
   */
  cleanOnly: (text: string) => CleanerUtils.cleanText(text)
};