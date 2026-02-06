import { JSON5 } from "bun";

/**
 * Resultado del parseo con información de diagnóstico
 */
export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  strategy?: string; // Estrategia que tuvo éxito
  originalContent?: string;
}

/**
 * Errores específicos de parseo
 */
export enum ParseErrorType {
  NO_JSON_FOUND = "NO_JSON_FOUND",
  UNBALANCED_BRACES = "UNBALANCED_BRACES",
  INVALID_JSON = "INVALID_JSON",
  INVALID_JSON5 = "INVALID_JSON5",
  EMPTY_CONTENT = "EMPTY_CONTENT",
}

/**
 * Utilidades para manipulación de JSON
 */
const JsonUtils = {
  /**
   * Verifica si un string tiene llaves y corchetes balanceados
   */
  areBracesBalanced(str: string): boolean {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') depth++;
      if (char === '}' || char === ']') depth--;

      if (depth < 0) return false;
    }

    return depth === 0;
  },

  /**
   * Encuentra la posición del primer objeto JSON completo bien formado
   * usando un stack para rastrear el balanceo
   */
  findJsonObject(content: string): { start: number; end: number } | null {
    const openBrace = content.indexOf('{');
    if (openBrace === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = openBrace; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          // Verificar que el cierre sea } para objetos
          if (char === '}') {
            return { start: openBrace, end: i };
          }
          // Si encontramos cierre de array antes que objeto, reiniciar búsqueda
          depth = 1; // Mantener abierto para seguir buscando
        }
      }
    }

    return null;
  },

  /**
   * Limpia y repara JSON comúnmente roto por LLMs
   */
  repairJson(jsonStr: string): string {
    let repaired = jsonStr.trim();

    // 1. Remover marcadores de código markdown
    repaired = repaired.replace(/^```json\s*/, '');
    repaired = repaired.replace(/^```\s*/, '');
    repaired = repaired.replace(/```$/, '');

    // 2. Remover texto antes/después del JSON
    const firstBrace = repaired.indexOf('{');
    const lastBrace = repaired.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      repaired = repaired.substring(firstBrace, lastBrace + 1);
    }

    // 3. Completar comillas sin cerrar (caso común en LLMs)
    // Buscar patrones como "key": value sin comillas en value
    repaired = repaired.replace(/: ([a-zA-Z_][a-zA-Z0-9_]*)(?=[,\}\]])/g, ': "$1"');

    // 4. Agregar comas faltantes entre objetos (patrón común: } { -> }, {)
    repaired = repaired.replace(/}\s*{/g, '}, {');

    // 5. Remover comas finales antes de } o ]
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    // 6. Agregar comillas a claves no citadas (más complejo, solo casos simples)
    // Patrón: {word: -> {"word":
    repaired = repaired.replace(/([{\[,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // 7. Reemplazar comillas simples con dobles (JSON5 lo soporta pero JSON.parse no)
    // Cuidado: no reemplazar dentro de strings
    // Por simplicidad, confiamos en JSON5 para esto

    return repaired;
  },

  /**
   * Intenta parsear con múltiples estrategias
   */
  tryParse<T>(
    jsonStr: string,
    strategies: Array<{ name: string; parser: (s: string) => any }>
  ): { success: boolean; data?: T; error?: string; strategy?: string } {
    for (const { name, parser } of strategies) {
      try {
        const result = parser(jsonStr);
        return { success: true, data: result as T, strategy: name };
      } catch (err) {
        // Continuar con la siguiente estrategia
        continue;
      }
    }

    return {
      success: false,
      error: "Todas las estrategias de parseo fallaron",
    };
  }
};

/**
 * Parsea una respuesta de LLM de forma flexible y robusta.
 * Soporta JSON estricto, JSON5, e intenta reparar JSON comúnmente roto.
 *
 * @param content - Contenido de la respuesta del LLM
 * @returns El objeto parseado del tipo genérico T
 * @throws Error si no se puede parsear después de todas las estrategias
 */
export const parseLLMResponse = <T>(content: string): T => {
  // Validación inicial
  if (!content || typeof content !== 'string') {
    throw new Error(ParseErrorType.EMPTY_CONTENT);
  }

  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    throw new Error(ParseErrorType.EMPTY_CONTENT);
  }

  // Estrategia 1: Extraer el primer objeto JSON completo bien formado
  const jsonObject = JsonUtils.findJsonObject(trimmedContent);

  if (!jsonObject) {
    throw new Error(`${ParseErrorType.NO_JSON_FOUND}: No se encontró un objeto JSON válido en la respuesta`);
  }

  const { start, end } = jsonObject;
  let jsonContent = trimmedContent.substring(start, end + 1);

  // Verificar balanceo
  if (!JsonUtils.areBracesBalanced(jsonContent)) {
    console.warn(`[parseLLMResponse] JSON desbalanceado detectado, intentando reparar...`);
    jsonContent = JsonUtils.repairJson(jsonContent);
  }

  // Definir estrategias de parseo en orden de preferencia
  const strategies = [
    { name: 'JSON5', parser: (s: string) => JSON5.parse(s) },
  //  { name: 'JSON.native', parser: (s: string) => JSON.parse(s) },
  ];

  const result = JsonUtils.tryParse<T>(jsonContent, strategies);

  if (result.success && result.data !== undefined) {
    return result.data;
  }

  // Si todas las estrategias fallan, intentar reparación agresiva
  console.warn(`[parseLLMResponse] Parseo falló con estrategias normales. Intentando reparación agresiva...`);

  const repaired = JsonUtils.repairJson(jsonContent);
  if (repaired !== jsonContent) {
    const repairedResult = JsonUtils.tryParse<T>(repaired, strategies);
    if (repairedResult.success && repairedResult.data !== undefined) {
      console.info(`[parseLLMResponse] Reparación exitosa usando estrategia: ${repairedResult.strategy}`);
      return repairedResult.data;
    }
  }

  // Error final con diagnóstico detallado
  const errorMsg = result.error;

  console.error(errorMsg);

  throw new Error(`Error al procesar respuesta del LLM: ${result.error}\n` +
    `Tipo de error: ${ParseErrorType.INVALID_JSON5}`);
};

/**
 * Versión segura que no lanza excepciones, retorna ParseResult
 */
export const parseLLMResponseSafe = <T>(content: string): ParseResult<T> => {
  try {
    const data = parseLLMResponse<T>(content);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al parsear",
      originalContent: content.substring(0, 500),
    };
  }
};