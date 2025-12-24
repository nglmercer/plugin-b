/**
 * Valida que un valor sea string
 */
function isString(value: any): value is string {
  return typeof value === "string";
}

/**
 * Valida que un valor sea número
 */
function isNumber(value: any): value is number {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

/**
 * Valida que un valor sea boolean
 */
function isBoolean(value: any): value is boolean {
  return typeof value === "boolean";
}

/**
 * Valida que un valor sea objeto (no null, no array)
 */
function isObject(value: any): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Valida que un valor sea Record<string, any>
 */
function isRecord(value: any): value is Record<string, any> {
    return isObject(value);
}

/**
 * Valida que un valor sea array
 */
function isArray(value: any): value is any[] {
  return Array.isArray(value);
}

/**
 * Valida que un valor sea Buffer
 */
function isBuffer(value: any): value is Buffer {
  return Buffer.isBuffer(value);
}

/**
 * Valida que un valor sea ArrayBuffer
 */
function isArrayBuffer(value: any): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

/**
 * Valida que un valor no sea null ni undefined
 */
function exists(value: any): boolean {
  return value !== null && value !== undefined;
}

/**
 * Valida que un string no esté vacío
 */
function isNotEmpty(value: string): boolean {
  return isString(value) && value.trim().length > 0;
}

/**
 * Valida tamaño máximo de datos
 */
function isWithinSize(data: any, maxBytes: number): boolean {
  if (isString(data)) {
    return Buffer.byteLength(data) <= maxBytes;
  }
  if (isBuffer(data)) {
    return data.length <= maxBytes;
  }
  if (isArrayBuffer(data)) {
    return data.byteLength <= maxBytes;
  }
  if (isObject(data) || isArray(data)) {
    return Buffer.byteLength(JSON.stringify(data)) <= maxBytes;
  }
  return true;
}

/**
 * Valida que un objeto tenga ciertas propiedades
 */
function hasProps(obj: any, props: string[]): boolean {
  if (!isObject(obj)) return false;
  return props.every((prop) => prop in obj);
}

/**
 * Valida rango de número
 */
function inRange(value: number, min?: number, max?: number): boolean {
  if (!isNumber(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Valida que sea JSON válido (string)
 */
function isValidJSON(value: string): boolean {
  if (!isString(value)) return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse seguro de JSON
 */
function safeParse(message: string | Buffer): any {
  try {
    const str = isBuffer(message) ? message.toString("utf-8") : message;
    return JSON.parse(str);
  } catch {
    return message;
  }
}

/**
 * Valida longitud de string
 */
function hasLength(value: string, min?: number, max?: number): boolean {
  if (!isString(value)) return false;
  const len = value.length;
  if (min !== undefined && len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
}

/**
 * Valida que array tenga cierta longitud
 */
function arrayLength(value: any[], min?: number, max?: number): boolean {
  if (!isArray(value)) return false;
  const len = value.length;
  if (min !== undefined && len < min) return false;
  if (max !== undefined && len > max) return false;
  return true;
}
/**
 * Obtiene el tipo de dato de forma segura
 */
function getType(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (isBuffer(value)) return "Buffer";
  if (isArrayBuffer(value)) return "ArrayBuffer";
  if (isArray(value)) return "Array";
  return typeof value;
}

/**
 * Verifica si es dato binario
 */
function isBinary(value: any): boolean {
  return isBuffer(value) || isArrayBuffer(value);
}
function isIndexedObject(value: any): boolean {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length === 0) return false;
  
  // Verifica si las primeras keys son números consecutivos
  const firstKeys = keys.slice(0, 10);
  return firstKeys.every((k, i) => k === String(i));
}

/**
 * Obtiene información resumida del dato sin colapsar logs
 */
/**
 * Obtiene información resumida del dato sin colapsar logs
 */
function getDataInfo(value: any): {
  type: string;
  keys?: string[];
  length?: number;
  size?: number;
  preview?: string;
  isIndexed?: boolean;
} {
  const type = getType(value);
  const info: any = { type };

  if (isBinary(value)) {
    info.size = isBuffer(value) ? value.length : value.byteLength;
    info.preview = `<Binary data: ${info.size} bytes>`;
  } else if (isArray(value)) {
    info.length = value.length;
    info.preview = `[Array with ${value.length} items]`;
  } else if (isIndexedObject(value)) {
    // Es un objeto indexado (Buffer/Array parseado como objeto)
    const count = Object.keys(value).length;
    info.isIndexed = true;
    info.length = count;
    info.preview = `<Indexed object: ${count} items>`;
    info.type = "IndexedObject (probably Buffer/Uint8Array)";
  } else if (isRecord(value)) {
    const keys = Object.keys(value);
    info.keys = keys.length > 20 ? keys.slice(0, 20) : keys;
    info.totalKeys = keys.length;
    info.preview = keys.length > 20 
      ? `{${info.keys.join(", ")}... +${keys.length - 20} more}`
      : `{${keys.join(", ")}}`;
  } else if (isString(value)) {
    info.length = value.length;
    info.preview = value.length > 100 
      ? `${value.slice(0, 100)}...` 
      : value;
  } else {
    info.preview = String(value);
  }

  return info;
}
/**
 * Log seguro que no colapsa con datos binarios
 */
function safeLog(label: string, data: any): void {
  const info = getDataInfo(data);
  
  if (isBinary(data)) {
    console.log(`[${label}]`, {
      type: info.type,
      size: info.size,
      preview: info.preview,
    });
  } else if (isRecord(data)) {
    console.log(`[${label}]`, {
      type: info.type,
      keys: info.keys,
      preview: info.preview,
    });
  } else {
    console.log(`[${label}]`, info);
  }
}

// Exportar todas las utilidades
export const validate = {
  isString,
  isNumber,
  isBoolean,
  isObject,
  isRecord,
  isArray,
  isBuffer,
  isArrayBuffer,
  exists,
  isNotEmpty,
  isWithinSize,
  hasProps,
  inRange,
  isValidJSON,
  safeParse,
  hasLength,
  arrayLength,
  safeLog
};
