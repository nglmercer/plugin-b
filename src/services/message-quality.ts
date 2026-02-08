/**
 * Message Quality Filter - Detects and filters low-quality messages
 * to prevent TTS from processing gibberish, repetitive, or nonsensical content.
 * 
 * Configuration is imported from plugins/ai/constants.ts for centralized management.
 */

import {
  QUALITY_FILTER_CONFIG,
  LOW_QUALITY_PATTERNS,
  MEANINGFUL_SHORT_WORDS,
  QUALITY_PENALTIES,
  SKIP_PREFIXES,
} from "../../plugins/ai/constants";

export interface QualityResult {
  isHighQuality: boolean;
  score: number; // 0-100
  reasons: string[];
  cleanedText: string;
}

export interface QualityFilterConfig {
  minScore: number;
  minLength: number;
  maxLength: number;
  maxRepetitionRatio: number;
  enableAIEvaluation: boolean;
}

/**
 * Calculate repetition ratio in text
 */
function calculateRepetitionRatio(text: string): number {
  if (!text || text.length < 3) return 0;
  
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return 0;
  
  // Count word frequencies
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }
  
  // Find most repeated word
  let maxRepeats = 1;
  for (const count of wordCounts.values()) {
    if (count > maxRepeats) maxRepeats = count;
  }
  
  return maxRepeats / words.length;
}

/**
 * Check if text contains chess board or visual patterns
 */
function hasVisualPatterns(text: string): boolean {
  return LOW_QUALITY_PATTERNS.chessBoard.test(text);
}

/**
 * Check if text is mostly spaced single letters
 */
function isSpacedLetters(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 10) return false;
  return LOW_QUALITY_PATTERNS.spacedLetters.test(trimmed);
}

/**
 * Check for numbered repetitive patterns
 */
function hasNumberedPattern(text: string): boolean {
  return LOW_QUALITY_PATTERNS.numberedPattern.test(text);
}

/**
 * Check for excessive character repetition
 */
function hasExcessiveRepetition(text: string): boolean {
  return (
    LOW_QUALITY_PATTERNS.repeatedChars.test(text) ||
    LOW_QUALITY_PATTERNS.repeatedSyllables.test(text)
  );
}

/**
 * Check if text is gibberish
 */
function isGibberish(text: string): boolean {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  // Check for consonant clusters without vowels
  for (const word of words) {
    if (word.length > 5 && LOW_QUALITY_PATTERNS.gibberish.test(word)) {
      // Verify it doesn't have vowels breaking it up
      const withoutClusters = word.replace(/[aeiou]/gi, '');
      if (withoutClusters.length > word.length * 0.7) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if message starts with a skip prefix
 */
function hasSkipPrefix(text: string): boolean {
  const lowerText = text.trim().toLowerCase();
  return SKIP_PREFIXES.some(prefix => lowerText.startsWith(prefix.toLowerCase()));
}

/**
 * Calculate overall quality score
 */
function calculateQualityScore(text: string, reasons: string[]): number {
  let score = 100;
  const trimmed = text.trim();
  
  // Length penalties
  if (trimmed.length < 4) {
    score -= QUALITY_PENALTIES.tooShort;
    reasons.push('Message too short');
  } else if (trimmed.length < 10) {
    score -= QUALITY_PENALTIES.veryShort;
    reasons.push('Message is very short');
  }
  
  // Pattern penalties
  if (hasVisualPatterns(trimmed)) {
    score -= QUALITY_PENALTIES.visualPatterns;
    reasons.push('Contains visual patterns (chess board, etc.)');
  }
  
  if (isSpacedLetters(trimmed)) {
    score -= QUALITY_PENALTIES.spacedLetters;
    reasons.push('Appears to be spaced single letters');
  }
  
  if (hasNumberedPattern(trimmed)) {
    score -= QUALITY_PENALTIES.numberedPattern;
    reasons.push('Contains numbered repetitive pattern');
  }
  
  if (hasExcessiveRepetition(trimmed)) {
    score -= QUALITY_PENALTIES.excessiveRepetition;
    reasons.push('Contains excessive character repetition');
  }
  
  if (isGibberish(trimmed)) {
    score -= QUALITY_PENALTIES.gibberish;
    reasons.push('Appears to be gibberish');
  }
  
  // Repetition ratio penalty
  const repRatio = calculateRepetitionRatio(trimmed);
  if (repRatio > 0.6) {
    score -= QUALITY_PENALTIES.highRepetition;
    reasons.push(`High word repetition ratio: ${(repRatio * 100).toFixed(0)}%`);
  } else if (repRatio > 0.4) {
    score -= QUALITY_PENALTIES.moderateRepetition;
    reasons.push(`Moderate word repetition: ${(repRatio * 100).toFixed(0)}%`);
  }
  
  // Only numbers/symbols penalty
  if (LOW_QUALITY_PATTERNS.onlyNumbersSymbols.test(trimmed)) {
    score -= QUALITY_PENALTIES.onlyNumbersSymbols;
    reasons.push('Contains only numbers and symbols');
  }
  
  // Excessive punctuation
  if (LOW_QUALITY_PATTERNS.excessivePunctuation.test(trimmed)) {
    score -= QUALITY_PENALTIES.excessivePunctuation;
    reasons.push('Excessive punctuation');
  }
  
  // Bonus for meaningful short words
  const lowerText = trimmed.toLowerCase();
  for (const word of MEANINGFUL_SHORT_WORDS) {
    if (lowerText === word || lowerText.startsWith(word + ' ') || lowerText.endsWith(' ' + word)) {
      score += QUALITY_PENALTIES.meaningfulWordBonus;
      break;
    }
  }
  
  // Ensure score is within bounds
  return Math.max(0, Math.min(100, score));
}

/**
 * Main quality filter function
 */
export function evaluateMessageQuality(
  text: string,
  config: Partial<QualityFilterConfig> = {}
): QualityResult {
  const cfg = { ...QUALITY_FILTER_CONFIG, ...config };
  const reasons: string[] = [];
  
  if (!text || typeof text !== 'string') {
    return {
      isHighQuality: false,
      score: 0,
      reasons: ['Empty or invalid message'],
      cleanedText: '',
    };
  }
  
  const cleanedText = text.trim();
  
  // Check for skip prefixes first
  if (hasSkipPrefix(cleanedText)) {
    return {
      isHighQuality: false,
      score: 0,
      reasons: ['Message starts with skip prefix'],
      cleanedText,
    };
  }
  
  // Quick length checks
  if (cleanedText.length < cfg.minLength) {
    return {
      isHighQuality: false,
      score: 0,
      reasons: [`Message too short (min: ${cfg.minLength} chars)`],
      cleanedText,
    };
  }
  
  if (cleanedText.length > cfg.maxLength) {
    return {
      isHighQuality: false,
      score: 20,
      reasons: [`Message too long (max: ${cfg.maxLength} chars)`],
      cleanedText,
    };
  }
  
  // Calculate quality score
  const score = calculateQualityScore(cleanedText, reasons);
  
  return {
    isHighQuality: score >= cfg.minScore,
    score,
    reasons,
    cleanedText,
  };
}

/**
 * Quick check if message should be processed
 */
export function shouldProcessMessage(
  text: string,
  config: Partial<QualityFilterConfig> = {}
): boolean {
  const result = evaluateMessageQuality(text, config);
  return result.isHighQuality;
}

/**
 * Filter an array of messages, returning only high-quality ones
 */
export function filterMessages(
  messages: string[],
  config: Partial<QualityFilterConfig> = {}
): { message: string; quality: QualityResult }[] {
  return messages
    .map(msg => ({
      message: msg,
      quality: evaluateMessageQuality(msg, config),
    }))
    .filter(item => item.quality.isHighQuality);
}

/**
 * Export singleton instance with default config
 */
export const MessageQualityFilter = {
  evaluate: evaluateMessageQuality,
  shouldProcess: shouldProcessMessage,
  filter: filterMessages,
  patterns: LOW_QUALITY_PATTERNS,
};
