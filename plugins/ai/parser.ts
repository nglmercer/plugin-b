import { JSON5 } from "bun";

/**
 * Parsea una respuesta de LLM de forma flexible.
 * Soporta JSON estricto y JSON5 (comas finales, sin comillas, comentarios).
 */
export const parseLLMResponse = <T>(content: string): T => {
  // 1. Localizar el bloque de datos (por si el LLM incluye texto extra)
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1) {
    throw new Error("No se detectó una estructura de objeto válida en la respuesta del modelo.");
  }

  const jsonContent = content.substring(start, end + 1);

  try {
    // 2. Intentar parsear con el motor nativo de JSON5 de Bun
    // Esto es mucho más permisivo que JSON.parse nativo
    return JSON5.parse(jsonContent) as T;
  } catch (error) {
    console.error("Error crítico de parseo en contenido:", jsonContent);
    throw new Error(`Error al procesar JSON5: ${error instanceof Error ? error.message : "Sintaxis inválida"}`);
  }
};