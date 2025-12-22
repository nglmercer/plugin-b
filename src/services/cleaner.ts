import { StringDetector, SpamDetector, WordFilter, PatternAnalyzer } from 'string-dac';
import { EventEmitter } from 'events';

// Interfaces para el sistema TTS
interface TTSMessage {
  id: string;
  text: string;
  timestamp: number;
  cleanedText: string;
  spamScore: number;
  isSpam: boolean;
  duplicateOf?: string;
}

interface TTSConfig {
  spamThreshold: number;
  duplicateTimeWindow: number; // milliseconds
  maxMessagesPerWindow: number;
  cleaningOptions: {
    removeEmojis: boolean;
    replaceEmojis: boolean;
    removeSymbols: boolean;
    removeSpecialChars: boolean;
    language: 'en' | 'es' | 'fr' | 'de';
  };
  spamKeywords: string[];
}

interface TTSStats {
  totalMessages: number;
  spamBlocked: number;
  duplicatesBlocked: number;
  messagesInTimeWindow: number;
  averageSpamScore: number;
}

/**
 * Sistema TTS con prevención de spam y registro temporal
 */
export class TTSSpamPrevention extends EventEmitter {
  private stringDetector: StringDetector;
  private spamDetector: SpamDetector;
  private wordFilter: WordFilter;
  private patternAnalyzer: PatternAnalyzer;
  
  private messageHistory: TTSMessage[] = [];
  private recentMessages: Map<string, number> = new Map(); // text -> timestamp
  private config: TTSConfig;
  private stats: TTSStats;

  constructor(config: Partial<TTSConfig> = {}) {
    super();
    
    this.config = {
      spamThreshold: 0.7,
      duplicateTimeWindow: 60000, // 1 minute
      maxMessagesPerWindow: 10,
      cleaningOptions: {
        removeEmojis: false,
        replaceEmojis: true,
        removeSymbols: false,
        removeSpecialChars: false,
        language: 'es'
      },
      spamKeywords: [],
      ...config
    };

    this.stringDetector = new StringDetector();
    this.spamDetector = new SpamDetector();
    this.wordFilter = new WordFilter(this.config.spamKeywords, {
      caseSensitive: false,
      ignoreDuplicates: true,
      maxHistorySize: 1000
    });
    this.patternAnalyzer = new PatternAnalyzer();
    
    this.stats = {
      totalMessages: 0,
      spamBlocked: 0,
      duplicatesBlocked: 0,
      messagesInTimeWindow: 0,
      averageSpamScore: 0
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Escuchar eventos de filtrado de palabras
    this.wordFilter.on('wordFiltered', (event) => {
      this.emit('wordFiltered', event);
    });
  }

  /**
   * Procesa un mensaje para TTS con prevención de spam
   */
  async processMessage(text: string, userId?: string): Promise<TTSMessage | null> {
    const messageId = this.generateMessageId();
    const timestamp = Date.now();

    this.emit('messageReceived', { text, userId, timestamp });

    // 1. Limpiar el texto para TTS
    const cleanedText = this.stringDetector.clean(text, this.config.cleaningOptions);
    
    // 2. Verificar duplicados en ventana de tiempo
    const duplicateCheck = this.checkForDuplicates(cleanedText, timestamp);
    if (duplicateCheck.isDuplicate) {
      this.stats.duplicatesBlocked++;
      this.emit('duplicateBlocked', { 
        text, 
        duplicateOf: duplicateCheck.originalId,
        timeSinceOriginal: duplicateCheck.originalTimestamp ? timestamp - duplicateCheck.originalTimestamp : 0
      });
      return null;
    }

    // 3. Verificar límite de mensajes en ventana de tiempo
    if (this.isRateLimited(userId, timestamp)) {
      this.emit('rateLimited', { userId, text, timestamp });
      return null;
    }

    // 4. Detectar spam
    const spamResult = this.spamDetector.detectSpam(text, {
      iterations: 100,
      similarityThreshold: this.config.spamThreshold
    });

    // 5. Análisis de patrones adicional
    const patternResult = this.patternAnalyzer.analyzePatterns(text, {
      enableFrequencyAnalysis: true,
      enableStructuralAnalysis: true,
      customKeywords: this.config.spamKeywords,
      frequencyThreshold: 0.3
    });

    // 6. Filtrar palabras problemáticas
    const filteredEvents = this.wordFilter.processSentence(cleanedText);
    const hasSpamWords = filteredEvents.length > 0;

    // 7. Calcular puntuación final de spam
    const finalSpamScore = this.calculateFinalSpamScore(spamResult.spamScore, patternResult, hasSpamWords);
    const isSpam = finalSpamScore > this.config.spamThreshold;

    const message: TTSMessage = {
      id: messageId,
      text,
      timestamp,
      cleanedText,
      spamScore: finalSpamScore,
      isSpam,
      duplicateOf: duplicateCheck.isDuplicate ? duplicateCheck.originalId : undefined
    };

    // 8. Si no es spam, registrar el mensaje
    if (!isSpam && !duplicateCheck.isDuplicate) {
      this.registerMessage(message, userId);
      this.emit('messageAccepted', message);
    } else {
      this.stats.spamBlocked++;
      this.emit('spamBlocked', { message, reason: this.getSpamReason(spamResult, patternResult, hasSpamWords) });
    }

    return isSpam || duplicateCheck.isDuplicate ? null : message;
  }

  /**
   * Verifica si el texto es un duplicado dentro de la ventana de tiempo
   */
  private checkForDuplicates(text: string, timestamp: number): {
    isDuplicate: boolean;
    originalId?: string;
    originalTimestamp?: number;
  } {
    const normalizedText = this.normalizeText(text);
    
    // Buscar en mensajes recientes
    for (const message of this.messageHistory) {
      const timeDiff = timestamp - message.timestamp;
      if (timeDiff <= this.config.duplicateTimeWindow) {
        const normalizedExisting = this.normalizeText(message.cleanedText);
        if (normalizedExisting === normalizedText) {
          return {
            isDuplicate: true,
            originalId: message.id,
            originalTimestamp: message.timestamp
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Normaliza el texto para comparación
   */
  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^a-z0-9áéíóúñ]/g, '')
      .trim();
  }

  /**
   * Verifica si el usuario está excediendo el límite de mensajes
   */
  private isRateLimited(userId: string | undefined, timestamp: number): boolean {
    if (!userId) return false;

    // Limpiar mensajes antiguos
    this.cleanOldMessages(timestamp);
    
    // Contar mensajes del usuario en la ventana de tiempo
    const userMessages = this.messageHistory.filter(msg => 
      msg.timestamp > (timestamp - this.config.duplicateTimeWindow)
    ).length;

    return userMessages >= this.config.maxMessagesPerWindow;
  }

  /**
   * Calcula la puntuación final de spam combinando múltiples factores
   */
  private calculateFinalSpamScore(spamScore: number, patternResult: any, hasSpamWords: boolean): number {
    let finalScore = spamScore;

    // Aumentar puntuación si hay palabras de spam
    if (hasSpamWords) {
      finalScore = Math.min(finalScore + 0.3, 1.0);
    }

    // Aumentar puntuación si el análisis de patrones detecta problemas
    if (patternResult.totalScore > 0.5) {
      finalScore = Math.min(finalScore + 0.2, 1.0);
    }

    return Math.min(finalScore, 1.0);
  }

  /**
   * Registra un mensaje aceptado
   */
  private registerMessage(message: TTSMessage, userId?: string): void {
    this.messageHistory.push(message);
    this.recentMessages.set(message.cleanedText, message.timestamp);
    this.stats.totalMessages++;
    
    // Actualizar estadísticas
    this.updateStats(message);
    
    // Limpiar mensajes antiguos
    this.cleanOldMessages(message.timestamp);
  }

  /**
   * Actualiza las estadísticas
   */
  private updateStats(message: TTSMessage): void {
    const currentTotal = this.stats.totalMessages;
    const currentAverage = this.stats.averageSpamScore;
    
    this.stats.averageSpamScore = ((currentAverage * (currentTotal - 1)) + message.spamScore) / currentTotal;
    this.stats.messagesInTimeWindow = this.messageHistory.filter(msg => 
      msg.timestamp > (Date.now() - this.config.duplicateTimeWindow)
    ).length;
  }

  /**
   * Limpia mensajes antiguos fuera de la ventana de tiempo
   */
  private cleanOldMessages(currentTimestamp: number): void {
    const cutoffTime = currentTimestamp - this.config.duplicateTimeWindow;
    
    this.messageHistory = this.messageHistory.filter(msg => msg.timestamp > cutoffTime);
    
    // Limpiar también el mapa de mensajes recientes
    for (const [text, timestamp] of this.recentMessages.entries()) {
      if (timestamp <= cutoffTime) {
        this.recentMessages.delete(text);
      }
    }
  }

  /**
   * Genera un ID único para el mensaje
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtiene la razón por la que fue marcado como spam
   */
  private getSpamReason(spamResult: any, patternResult: any, hasSpamWords: boolean): string {
    const reasons: string[] = [];
    
    if (spamResult.spamScore > this.config.spamThreshold) {
      reasons.push(`High spam score (${(spamResult.spamScore * 100).toFixed(1)}%)`);
    }
    
    if (hasSpamWords) {
      reasons.push('Contains spam keywords');
    }
    
    if (patternResult.totalScore > 0.5) {
      reasons.push('Suspicious patterns detected');
    }
    
    return reasons.join(', ');
  }

  /**
   * Obtiene las estadísticas actuales
   */
  getStats(): TTSStats {
    return { ...this.stats };
  }

  /**
   * Obtiene el historial de mensajes
   */
  getMessageHistory(): TTSMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Limpia el historial y estadísticas
   */
  clearHistory(): void {
    this.messageHistory = [];
    this.recentMessages.clear();
    this.wordFilter.clear();
    this.stats = {
      totalMessages: 0,
      spamBlocked: 0,
      duplicatesBlocked: 0,
      messagesInTimeWindow: 0,
      averageSpamScore: 0
    };
    this.emit('historyCleared');
  }

  /**
   * Actualiza la configuración
   */
  updateConfig(newConfig: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.spamKeywords) {
      this.wordFilter.setWordsToFilter(newConfig.spamKeywords);
    }
    
    this.emit('configUpdated', this.config);
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): TTSConfig {
    return { ...this.config };
  }
}

// Ejemplo de uso
export async function runTTSSpamPreventionExample() {
  console.log('🎯 Sistema TTS con Prevención de Spam - Demo\n');

  // Configuración del sistema TTS
  const ttsSystem = new TTSSpamPrevention({
    spamThreshold: 0.6,
    duplicateTimeWindow: 30000, // 30 segundos
    maxMessagesPerWindow: 5,
    cleaningOptions: {
      removeEmojis: false,
      replaceEmojis: true,
      removeSymbols: false,
      removeSpecialChars: false,
      language: 'es'
    },
    spamKeywords: []
  });

  // Escuchar eventos
  ttsSystem.on('messageAccepted', (message) => {
    console.log(`✅ Mensaje aceptado: "${message.cleanedText}" (Spam score: ${(message.spamScore * 100).toFixed(1)}%)`);
  });

  ttsSystem.on('spamBlocked', (data) => {
    console.log(`🚫 Spam bloqueado: "${data.message.text}" - Razón: ${data.reason}`);
  });

  ttsSystem.on('duplicateBlocked', (data) => {
    console.log(`🔄 Duplicado bloqueado: "${data.text}" (tiempo desde original: ${data.timeSinceOriginal}ms)`);
  });

  ttsSystem.on('wordFiltered', (event) => {
    console.log(`🔍 Palabra filtrada: "${event.word}" ${event.isDuplicate ? '(duplicada)' : ''}`);
  });

  // Mensajes de prueba
  const testMessages = [
    "¡Hola! ¿Cómo estás? 😊",
    "¡Hola! ¿Cómo estás? 😊", // Duplicado
    "GANAR DINERO RÁPIDO!!! 💰🤑",
    "Visita nuestro sitio web para premios gratis",
    "Este es un mensaje normal de prueba",
    "Este es un mensaje normal de prueba", // Duplicado
    "🚨 OFERTA URGENTE 🚨 ¡Gratis por tiempo limitado!",
    "Hola mundo, ¿qué tal?", // Similar al primero pero diferente
    "Texto con símbolos @#$% y caracteres especiales",
    "Mensaje muy muy muy repetitivo repetitivo repetitivo"
  ];

  console.log('📝 Procesando mensajes de prueba...\n');

  // Procesar cada mensaje con un pequeño delay
  for (let i = 0; i < testMessages.length; i++) {
    console.log(`\n--- Mensaje ${i + 1}: "${testMessages[i]}" ---`);
    
    const result = await ttsSystem.processMessage(testMessages[i]!, `user_${i % 3}`);
    
    if (result) {
      console.log(`🎤 Texto para TTS: "${result.cleanedText}"`);
    }
    
    // Esperar un poco entre mensajes
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Mostrar estadísticas finales
  console.log('\n📊 Estadísticas Finales:');
  const stats = ttsSystem.getStats();
  console.log(`- Total de mensajes: ${stats.totalMessages}`);
  console.log(`- Spam bloqueado: ${stats.spamBlocked}`);
  console.log(`- Duplicados bloqueados: ${stats.duplicatesBlocked}`);
  console.log(`- Mensajes en ventana de tiempo: ${stats.messagesInTimeWindow}`);
  console.log(`- Puntuación promedio de spam: ${(stats.averageSpamScore * 100).toFixed(1)}%`);

  // Mostrar historial de mensajes aceptados
  console.log('\n📋 Mensajes aceptados:');
  const history = ttsSystem.getMessageHistory();
  history.forEach((msg, index) => {
    console.log(`${index + 1}. "${msg.cleanedText}" (Score: ${(msg.spamScore * 100).toFixed(1)}%)`);
  });
}
