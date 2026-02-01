import { type } from "arktype";
import {
  ERROR_MESSAGES,
  TIKTOK_CONSTANTS,
} from "../src/constants";

/**
 * Interfaz por defecto para el retorno
 */
export interface SocketIoEvent<T = any> {
  eventName: string;
  data: T;
}

/**
 * Resultado de parseo con información de error
 */
export interface ParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Parsea un mensaje de Socket.io 42 con mapeo de llaves opcional.
 * @param message - El string crudo del socket (ej: '42["chat", {}]')
 * @param keys - (Opcional) Diccionario para renombrar las llaves de salida
 */
export function parseSocketIo42Message<
  T = any,
  E extends string = "eventName",
  D extends string = "data"
>(
  message: string,
  keys?: { event: E; data: D }
): ({ [K in E]: string } & { [K in D]: T }) | null {
  // Validamos el prefijo del protocolo Socket.io
  if (!message || !message.startsWith(TIKTOK_CONSTANTS.SOCKET_IO_DATA_PREFIX)) {
    return null;
  }

  try {
    // Extraemos y parseamos el JSON (saltando el "42")
    const parsed = JSON.parse(
      message.substring(TIKTOK_CONSTANTS.SOCKET_IO_DATA_PREFIX.length)
    );

    if (Array.isArray(parsed) && parsed.length >= 1) {
      // Definimos las llaves que usaremos: las proveídas o las de SocketIoEvent por defecto
      const eventKey = keys?.event ?? ("eventName" as E);
      const dataKey = keys?.data ?? ("data" as D);

      return {
        [eventKey]: parsed[0],
        [dataKey]: parsed.length > 1 ? parsed[1] : null,
      } as { [K in E]: string } & { [K in D]: T };
    }
  } catch (error) {
    console.error("Error parsing Socket.io message:", error);
  }

  return null;
}

export enum SocketIoPacketType {
  OPEN = "0",
  CLOSE = "1",
  PING = "2",
  PONG = "3",
  MESSAGE = "4",
  UPGRADE = "5",
  NOOP = "6",
}

export enum SocketIoMessageType {
  CONNECT = "0",
  DISCONNECT = "1",
  EVENT = "2",
  ACK = "3",
  ERROR = "4",
  BINARY_EVENT = "5",
  BINARY_ACK = "6",
}

export function SocketIoMessage(message: string) {
  if (!message || message.length < 1) return null;

  const engineType = message[0];
  // El socketType solo existe si engineType es '4' (MESSAGE)
  const socketType = engineType === SocketIoPacketType.MESSAGE ? message[1] : undefined;

  // Determinamos dónde empieza el JSON real
  // Si es '42', el JSON empieza en el índice 2. Si es '2' (PING), no hay JSON.
  const payloadOffset = engineType === SocketIoPacketType.MESSAGE ? 2 : 1;
  const payloadRaw = message.substring(payloadOffset);

  return {
    engineType,
    socketType,
    isData: message.startsWith(TIKTOK_CONSTANTS.SOCKET_IO_DATA_PREFIX),
    payloadRaw,
  };
}

/**
 * Parsea un string JSON genérico con manejo de errores
 * @param jsonString - String JSON a parsear
 * @returns ParseResult con el resultado del parseo
 */
export function parseJson<T = any>(jsonString: string): ParseResult<T> {
  if (!jsonString || typeof jsonString !== "string") {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.EMPTY_INPUT,
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return {
      success: true,
      data: parsed as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.PARSE.UNKNOWN_ERROR,
    };
  }
}

/**
 * Parsea un string JSON y valida contra un esquema arktype
 * @param jsonString - String JSON a parsear
 * @param schema - Esquema arktype para validar
 * @returns ParseResult con el resultado del parseo y validación
 */
export function parseJsonWithSchema<T = any>(
  jsonString: string,
  schema: ReturnType<typeof type<any>>
): ParseResult<T> {
  const parseResult = parseJson<T>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  const validation = schema(parseResult.data);

  if (validation instanceof type.errors) {
    return {
      success: false,
      error: validation.summary,
    };
  }

  return {
    success: true,
    data: validation as T,
  };
}

/**
 * Parsea un string JSON que debe ser un array
 * @param jsonString - String JSON a parsear
 * @returns ParseResult con el array parseado
 */
export function parseJsonArray<T = any>(jsonString: string): ParseResult<T[]> {
  const parseResult = parseJson<T[]>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  if (!Array.isArray(parseResult.data)) {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.NOT_AN_ARRAY,
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}

/**
 * Parsea un string JSON que debe ser un array y valida contra un esquema arktype
 * @param jsonString - String JSON a parsear
 * @param schema - Esquema arktype para validar cada elemento del array
 * @returns ParseResult con el array validado
 */
export function parseJsonArrayWithSchema<T = any>(
  jsonString: string,
  schema: ReturnType<typeof type<any>>
): ParseResult<T[]> {
  const parseResult = parseJsonArray<T>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  // Validar cada elemento del array
  for (let i = 0; i < parseResult.data!.length; i++) {
    const validation = schema(parseResult.data![i]);

    if (validation instanceof type.errors) {
      return {
        success: false,
        error: ERROR_MESSAGES.PARSE.ARRAY_ITEM(i, validation.summary),
      };
    }

    parseResult.data![i] = validation as T;
  }

  return {
    success: true,
    data: parseResult.data,
  };
}

/**
 * Parsea un string JSON que debe ser un objeto
 * @param jsonString - String JSON a parsear
 * @returns ParseResult con el objeto parseado
 */
export function parseJsonObject<T = Record<string, any>>(
  jsonString: string
): ParseResult<T> {
  const parseResult = parseJson<T>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  if (
    typeof parseResult.data !== "object" ||
    parseResult.data === null ||
    Array.isArray(parseResult.data)
  ) {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.NOT_AN_OBJECT,
    };
  }

  return {
    success: true,
    data: parseResult.data,
  };
}

/**
 * Parsea un string JSON que debe ser un objeto y valida contra un esquema arktype
 * @param jsonString - String JSON a parsear
 * @param schema - Esquema arktype para validar el objeto
 * @returns ParseResult con el objeto validado
 */
export function parseJsonObjectWithSchema<T = Record<string, any>>(
  jsonString: string,
  schema: ReturnType<typeof type<any>>
): ParseResult<T> {
  const parseResult = parseJsonObject<T>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  const validation = schema(parseResult.data);

  if (validation instanceof type.errors) {
    return {
      success: false,
      error: validation.summary,
    };
  }

  return {
    success: true,
    data: validation as T,
  };
}

/**
 * Parsea un string JSON que debe ser un valor primitivo (string, number, boolean, null)
 * @param jsonString - String JSON a parsear
 * @returns ParseResult con el valor primitivo parseado
 */
export function parseJsonPrimitive(
  jsonString: string
): ParseResult<string | number | boolean | null> {
  const parseResult = parseJson<string | number | boolean | null>(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  const value = parseResult.data;

  if (typeof value === "object" && value !== null) {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.NOT_PRIMITIVE,
    };
  }

  return {
    success: true,
    data: value,
  };
}

/**
 * Parsea un string JSON de forma segura con opciones de configuración
 * @param jsonString - String JSON a parsear
 * @param options - Opciones de configuración
 * @returns ParseResult con el resultado del parseo
 */
export function parseJsonSafe<T = any>(
  jsonString: string,
  options: {
    reviver?: (key: string, value: any) => any;
    strict?: boolean;
    maxDepth?: number;
  } = {}
): ParseResult<T> {
  if (!jsonString || typeof jsonString !== "string") {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.EMPTY_INPUT,
    };
  }

  try {
    // Validar profundidad máxima si está especificado
    if (options.strict && options.maxDepth !== undefined) {
      const depth = calculateJsonDepth(jsonString);
      if (depth > options.maxDepth) {
        return {
          success: false,
          error: ERROR_MESSAGES.PARSE.DEPTH_EXCEEDED(options.maxDepth),
        };
      }
    }

    const parsed = JSON.parse(jsonString, options.reviver);
    return {
      success: true,
      data: parsed as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.PARSE.UNKNOWN_ERROR,
    };
  }
}

/**
 * Calcula la profundidad de un string JSON
 * @param jsonString - String JSON a analizar
 * @returns Profundidad del JSON
 */
function calculateJsonDepth(jsonString: string): number {
  let maxDepth = 0;
  let currentDepth = 0;

  for (const char of jsonString) {
    if (char === "{" || char === "[") {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (char === "}" || char === "]") {
      currentDepth--;
    }
  }

  return maxDepth;
}

/**
 * Parsea múltiples strings JSON de una sola vez
 * @param jsonStrings - Array de strings JSON a parsear
 * @returns Array de ParseResult
 */
export function parseMultipleJson<T = any>(
  jsonStrings: string[]
): ParseResult<T>[] {
  return jsonStrings.map((str) => parseJson<T>(str));
}

/**
 * Parsea un string JSON y lo formatea de forma bonita
 * @param jsonString - String JSON a parsear y formatear
 * @param indent - Número de espacios para indentación (default: 2)
 * @returns ParseResult con el JSON formateado
 */
export function parseAndFormatJson(
  jsonString: string,
  indent: number = 2
): ParseResult<string> {
  const parseResult = parseJson(jsonString);

  if (!parseResult.success) {
    return parseResult;
  }

  try {
    const formatted = JSON.stringify(parseResult.data, null, indent);
    return {
      success: true,
      data: formatted,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.PARSE.FORMATTING_ERROR,
    };
  }
}

/**
 * Crea un esquema arktype para SocketIoEvent
 * @param dataTypeSchema - Esquema opcional para el tipo de datos
 * @returns Esquema arktype para SocketIoEvent
 */
export function createSocketIoEventSchema<T = any>(
  dataTypeSchema?: ReturnType<typeof type<any>>
) {
  if (dataTypeSchema) {
    return type({
      eventName: "string",
      data: dataTypeSchema,
    });
  }

  return type({
    eventName: "string",
    data: "unknown",
  });
}

/**
 * Parsea un mensaje de Socket.io 42 con validación de esquema arktype
 * @param message - El string crudo del socket (ej: '42["chat", {}]')
 * @param schema - Esquema arktype para validar los datos
 * @returns ParseResult con el evento validado
 */
export function parseSocketIo42MessageWithSchema<T = any>(
  message: string,
  schema?: ReturnType<typeof type<any>>
): ParseResult<SocketIoEvent<T>> {
  const parsed = parseSocketIo42Message<T>(message);

  if (!parsed) {
    return {
      success: false,
      error: ERROR_MESSAGES.PARSE.INVALID_SOCKET_IO,
    };
  }

  const eventSchema = createSocketIoEventSchema(schema);
  const validation = eventSchema(parsed);

  if (validation instanceof type.errors) {
    return {
      success: false,
      error: validation.summary,
    };
  }

  return {
    success: true,
    data: validation as SocketIoEvent<T>,
  };
}

/**
 * Tipos de utilidad para arktype
 */
export const ArktypeSchemas = {
  /**
   * Esquema para strings no vacíos
   */
  nonEmptyString: type("string > 0"),

  /**
   * Esquema para emails
   */
  email: type("string.email"),

  /**
   * Esquema para URLs
   */
  url: type("string.url"),

  /**
   * Esquema para números positivos
   */
  positiveNumber: type("number > 0"),

  /**
   * Esquema para números enteros
   */
  integer: type("number.integer"),

  /**
   * Esquema para arrays no vacíos
   */
  nonEmptyArray: type("unknown[] > 0"),

  /**
   * Esquema para objetos con propiedades requeridas
   */
  requiredObject: (requiredKeys: string[]) =>
    type({
      ...Object.fromEntries(requiredKeys.map((key) => [key, "unknown"])),
    }),
};
