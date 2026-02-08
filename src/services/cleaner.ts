import { StringDetector } from 'string-dac';
import {
  evaluateMessageQuality,
  shouldProcessMessage,
  type QualityResult
} from './message-quality';

const detector = new StringDetector();
/**
 * Representa un mensaje procesado y almacenado.
 */
export interface TTSMessage {
  text: string;
  cleanedText: string;
  timestamp: number;
  quality?: QualityResult;
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
   * Procesa un mensaje: lo limpia, evalúa calidad y lo guarda en el historial.
   */
  registerMessage(text: string, skipQualityCheck: boolean = false): TTSMessage {
    const cleaned = this.cleanText(text);
    const quality = evaluateMessageQuality(cleaned);
    
    const message: TTSMessage = {
      text,
      cleanedText: cleaned,
      timestamp: Date.now(),
      quality
    };
    
    history.push(message);
    
    // Log with quality info
    const qualityIcon = quality.isHighQuality ? '✅' : '⚠️';
    console.log(`[Cleaner] ${qualityIcon} Message registered. Score: ${quality.score}. History: ${history.length}. Last: "${cleaned}"`);
    if (!quality.isHighQuality && quality.reasons.length > 0) {
      console.log(`[Cleaner] ⚠️ Low quality reasons:`, quality.reasons);
    }
    
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
 * TTScleaner - Adaptador simplificado para mantener compatibilidad.
 * Encapsula las utilidades en un objeto similar al original.
 */
export const TTScleaner = {
  /**
   * Procesa un mensaje para el sistema TTS.
   * Incluye evaluación de calidad.
   */
  processMessage: (text: string) => CleanerUtils.registerMessage(text),
  
  /**
   * Procesa un mensaje sin verificación de calidad (para casos especiales).
   */
  processMessageUnchecked: (text: string) => CleanerUtils.registerMessage(text, true),
  
  /**
   * Verifica si un mensaje tiene suficiente calidad para TTS.
   */
  isHighQuality: (text: string) => shouldProcessMessage(text),
  
  /**
   * Evalúa la calidad de un mensaje.
   */
  evaluateQuality: (text: string) => evaluateMessageQuality(text),
  
  /**
   * Devuelve el historial de mensajes.
   */
  getMessageHistory: () => CleanerUtils.getHistory(),
  
  /**
   * Permite limpiar texto sin registrarlo en el historial (función pura).
   */
  cleanOnly: (text: string) => CleanerUtils.cleanText(text)
};