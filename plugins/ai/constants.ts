import { type } from "arktype";

// ============================================================================
// Configuración Global de AI
// ============================================================================
export const CONFIG = {
  DB_URI: "data/lancedb-store",
  TABLE_NAME: "knowledge_base",
  MODELS: {
    EMBEDDING: "text-embedding-qwen3-0.6b-text-embedding",
    CHAT: "lfm2.5-vl-1.6b"
  },
  PREFIXES: {
    QUERY: "task: search result | query: ",
    DOCUMENT: "title: none | text: ",
  }
} as const;

// ============================================================================
// Esquemas de Arktype
// ============================================================================
export const DocumentSchema = type("string[]");
export const QuerySchema = type({
  prompt: "string",
  "limit?": "number"
});

export type ValidatedQuery = typeof QuerySchema.infer;

// ============================================================================
// Message Quality Filter Configuration
// ============================================================================
export const QUALITY_FILTER_CONFIG = {
  minScore: 30,           // Minimum score to pass (0-100)
  minLength: 4,           // Minimum message length
  maxLength: 500,         // Maximum message length
  maxRepetitionRatio: 0.5, // Max ratio of repeated chars/words
  enableAIEvaluation: false,
} as const;

// Patterns that indicate low-quality messages
export const LOW_QUALITY_PATTERNS = {
  // Repeated character patterns (e.g., "aaaaaa", "jejejeje")
  repeatedChars: /(.)\1{4,}/gi,
  
  // Repeated syllables (e.g., "eir eir eir", "rs rs rs")
  repeatedSyllables: /\b(\w{1,4})\s+\1\s+\1\s+\1/gi,
  
  // Chess board patterns (⬛⬜ patterns)
  chessBoard: /[⬛⬜█▓░▒]/g,
  
  // Excessive punctuation
  excessivePunctuation: /[!?.,]{5,}/g,
  
  // Only numbers and symbols
  onlyNumbersSymbols: /^[\d\s\W]+$/g,
  
  // Gibberish patterns (random consonant clusters)
  gibberish: /[bcdfghjklmnpqrstvwxyz]{5,}/gi,
  
  // Single letter repetitions with spaces (e.g., "d s o p n")
  spacedLetters: /^([a-z]\s+){4,}[a-z]?\s*$/gi,
  
  // Numbered patterns (e.g., "1 t rs 2 t rs 3 t rs")
  numberedPattern: /(\d+\s+\w+\s+\w+\s*){3,}/gi,
  
  // Emoticon/kaomoji excessive patterns
  excessiveEmoticons: /[\(\)\[\]\{\}<>\/\\|]{3,}/g,
} as const;

// Words that indicate the message might be meaningful even if short
export const MEANINGFUL_SHORT_WORDS = [
  'hola', 'gracias', 'bye', 'yes', 'no', 'ok', 'si', 'no',
  'qué', 'cómo', 'dónde', 'cuándo', 'por qué', 'quién',
  'hello', 'thanks', 'please', 'sorry', 'good', 'bad',
] as const;

// Commands/prefixes to skip (not processed by AI/TTS)
export const SKIP_PREFIXES = [
  "!ia", "!ai!", "!cmd", "!command"
] as const;

// Quality score penalties
export const QUALITY_PENALTIES = {
  tooShort: 50,
  veryShort: 20,
  visualPatterns: 60,
  spacedLetters: 70,
  numberedPattern: 60,
  excessiveRepetition: 40,
  gibberish: 50,
  highRepetition: 40,
  moderateRepetition: 20,
  onlyNumbersSymbols: 70,
  excessivePunctuation: 20,
  meaningfulWordBonus: 10,
} as const;