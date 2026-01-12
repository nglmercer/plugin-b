/**
 * Archivo de prueba para los parsers de JSON
 * Ejecutar con: bun test utils/parsejson.test.ts
 */

import { type } from 'arktype';
import { describe, test, expect } from 'bun:test';
import {
  parseSocketIo42Message,
  parseJson,
  parseJsonWithSchema,
  parseJsonArray,
  parseJsonArrayWithSchema,
  parseJsonObject,
  parseJsonObjectWithSchema,
  parseJsonPrimitive,
  parseJsonSafe,
  parseMultipleJson,
  parseAndFormatJson,
  createSocketIoEventSchema,
  parseSocketIo42MessageWithSchema,
  ArktypeSchemas
} from './parsejson';

describe('parsejson.ts', () => {
  describe('parseSocketIo42Message', () => {
    test('debe parsear correctamente un mensaje Socket.io 42 válido', () => {
      const socketMessage = '42["chat", {"message": "Hola mundo"}]';
      const result = parseSocketIo42Message(socketMessage);
      
      expect(result).not.toBeNull();
      expect(result?.eventName).toBe('chat');
      expect(result?.data).toEqual({ message: 'Hola mundo' });
    });

    test('debe retornar null para mensajes sin prefijo 42', () => {
      const result = parseSocketIo42Message('["chat", {"message": "Hola"}]');
      expect(result).toBeNull();
    });

    test('debe manejar mensajes con solo el nombre del evento', () => {
      const socketMessage = '42["chat"]';
      const result = parseSocketIo42Message(socketMessage);
      
      expect(result).not.toBeNull();
      expect(result?.eventName).toBe('chat');
      expect(result?.data).toBeNull();
    });

    test('debe permitir renombrar las llaves de salida', () => {
      const socketMessage = '42["event", {"data": "test"}]';
      const result = parseSocketIo42Message(socketMessage, { event: 'evt', data: 'payload' });
      
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('evt', 'event');
      expect(result).toHaveProperty('payload', { data: 'test' });
    });
  });

  describe('parseJson', () => {
    test('debe parsear correctamente un JSON válido', () => {
      const validJson = '{"name": "Juan", "age": 30}';
      const result = parseJson(validJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Juan', age: 30 });
    });

    test('debe manejar JSON inválido', () => {
      const invalidJson = '{name: "Juan"}';
      const result = parseJson(invalidJson);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('debe retornar error para input vacío', () => {
      const result = parseJson('');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Input must be a non-empty string');
    });

    test('debe retornar error para input no string', () => {
      const result = parseJson(null as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Input must be a non-empty string');
    });
  });

  describe('parseJsonWithSchema', () => {
    test('debe validar correctamente contra el esquema', () => {
      const userSchema = type({
        name: 'string',
        age: 'number',
        email: 'string.email'
      });
      const userJson = '{"name": "Maria", "age": 25, "email": "maria@example.com"}';
      const result = parseJsonWithSchema(userJson, userSchema);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'Maria', age: 25, email: 'maria@example.com' });
    });

    test('debe rechazar datos que no cumplen el esquema', () => {
      const userSchema = type({
        name: 'string',
        age: 'number',
        email: 'string.email'
      });
      const invalidUserJson = '{"name": "Maria", "age": 25, "email": "not-an-email"}';
      const result = parseJsonWithSchema(invalidUserJson, userSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('debe propagar errores de parseo', () => {
      const userSchema = type({ name: 'string' });
      const invalidJson = '{invalid}';
      const result = parseJsonWithSchema(invalidJson, userSchema);
      
      expect(result.success).toBe(false);
    });
  });

  describe('parseJsonArray', () => {
    test('debe parsear correctamente un array JSON', () => {
      const arrayJson = '[1, 2, 3, 4, 5]';
      const result = parseJsonArray(arrayJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3, 4, 5]);
    });

    test('debe rechazar JSON que no es un array', () => {
      const notArrayJson = '{"key": "value"}';
      const result = parseJsonArray(notArrayJson);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Parsed JSON is not an array');
    });

    test('debe manejar arrays vacíos', () => {
      const emptyArrayJson = '[]';
      const result = parseJsonArray(emptyArrayJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('parseJsonArrayWithSchema', () => {
    test('debe validar cada elemento del array', () => {
      const numberSchema = type('number');
      const numberArrayJson = '[10, 20, 30, 40, 50]';
      const result = parseJsonArrayWithSchema(numberArrayJson, numberSchema);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([10, 20, 30, 40, 50]);
    });

    test('debe rechazar array con elementos inválidos', () => {
      const numberSchema = type('number');
      const invalidArrayJson = '[10, "not a number", 30]';
      const result = parseJsonArrayWithSchema(invalidArrayJson, numberSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Error at index 1');
    });
  });

  describe('parseJsonObject', () => {
    test('debe parsear correctamente un objeto JSON', () => {
      const objectJson = '{"id": 1, "title": "Test"}';
      const result = parseJsonObject(objectJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, title: 'Test' });
    });

    test('debe rechazar JSON que no es un objeto', () => {
      const arrayJson = '[1, 2, 3]';
      const result = parseJsonObject(arrayJson);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Parsed JSON is not an object');
    });

    test('debe rechazar null', () => {
      const result = parseJsonObject('null');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Parsed JSON is not an object');
    });
  });

  describe('parseJsonObjectWithSchema', () => {
    test('debe validar el objeto contra el esquema', () => {
      const productSchema = type({
        id: 'number',
        name: 'string',
        price: 'number > 0'
      });
      const productJson = '{"id": 1, "name": "Laptop", "price": 999.99}';
      const result = parseJsonObjectWithSchema(productJson, productSchema);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Laptop', price: 999.99 });
    });

    test('debe rechazar objeto que no cumple el esquema', () => {
      const productSchema = type({
        id: 'number',
        name: 'string',
        price: 'number > 0'
      });
      const invalidProductJson = '{"id": 1, "name": "Laptop", "price": -10}';
      const result = parseJsonObjectWithSchema(invalidProductJson, productSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('parseJsonPrimitive', () => {
    test('debe parsear strings JSON', () => {
      const result = parseJsonPrimitive('"texto"');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('texto');
    });

    test('debe parsear números JSON', () => {
      const result = parseJsonPrimitive('123');
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(123);
    });

    test('debe parsear booleanos JSON', () => {
      const resultTrue = parseJsonPrimitive('true');
      const resultFalse = parseJsonPrimitive('false');
      
      expect(resultTrue.success).toBe(true);
      expect(resultTrue.data).toBe(true);
      expect(resultFalse.success).toBe(true);
      expect(resultFalse.data).toBe(false);
    });

    test('debe parsear null JSON', () => {
      const result = parseJsonPrimitive('null');
      
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    test('debe rechazar objetos y arrays', () => {
      const resultObject = parseJsonPrimitive('{"key": "value"}');
      const resultArray = parseJsonPrimitive('[1, 2, 3]');
      
      expect(resultObject.success).toBe(false);
      expect(resultObject.error).toBe('Parsed JSON is not a primitive value');
      expect(resultArray.success).toBe(false);
      expect(resultArray.error).toBe('Parsed JSON is not a primitive value');
    });
  });

  describe('parseJsonSafe', () => {
    test('debe parsear JSON complejo con maxDepth suficiente', () => {
      const complexJson = '{"nested": {"deep": {"value": 42}}}';
      const result = parseJsonSafe(complexJson, { strict: true, maxDepth: 5 });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ nested: { deep: { value: 42 } } });
    });

    test('debe rechazar JSON que excede maxDepth', () => {
      const complexJson = '{"nested": {"deep": {"value": 42}}}';
      const result = parseJsonSafe(complexJson, { strict: true, maxDepth: 1 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed depth');
    });

    test('debe funcionar sin opciones', () => {
      const simpleJson = '{"key": "value"}';
      const result = parseJsonSafe(simpleJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value' });
    });

    test('debe soportar función reviver', () => {
      const json = '{"date": "2023-01-01"}';
      const result = parseJsonSafe(json, {
        reviver: (key, value) => {
          if (key === 'date') return new Date(value);
          return value;
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.data?.date).toBeInstanceOf(Date);
    });
  });

  describe('parseMultipleJson', () => {
    test('debe parsear múltiples JSONs', () => {
      const multipleJsons = ['{"a": 1}', '{"b": 2}', '{"c": 3}'];
      const results = parseMultipleJson(multipleJsons);
      
      expect(results).toHaveLength(3);
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.data).toEqual({ a: 1 });
      expect(results[1]!.success).toBe(true);
      expect(results[1]!.data).toEqual({ b: 2 });
      expect(results[2]!.success).toBe(true);
      expect(results[2]!.data).toEqual({ c: 3 });
    });

    test('debe manejar mezcla de JSONs válidos e inválidos', () => {
      const mixedJsons = ['{"a": 1}', '{invalid}', '{"c": 3}'];
      const results = parseMultipleJson(mixedJsons);
      
      expect(results).toHaveLength(3);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(false);
      expect(results[2]!.success).toBe(true);
    });
  });

  describe('parseAndFormatJson', () => {
    test('debe formatear JSON con indentación', () => {
      const unformattedJson = '{"name":"John","age":30,"city":"New York"}';
      const result = parseAndFormatJson(unformattedJson, 2);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('  "name"');
      expect(result.data).toContain('  "age"');
      expect(result.data).toContain('  "city"');
    });

    test('debe usar indentación por defecto de 2 espacios', () => {
      const unformattedJson = '{"key":"value"}';
      const result = parseAndFormatJson(unformattedJson);
      
      expect(result.success).toBe(true);
      expect(result.data).toContain('  "key"');
    });

    test('debe propagar errores de parseo', () => {
      const invalidJson = '{invalid}';
      const result = parseAndFormatJson(invalidJson);
      
      expect(result.success).toBe(false);
    });
  });

  describe('createSocketIoEventSchema', () => {
    test('debe crear esquema sin dataTypeSchema', () => {
      const schema = createSocketIoEventSchema();
      const event = { eventName: 'chat', data: { message: 'hello' } };
      const result = schema(event);
      
      expect(result).not.toBeInstanceOf(type.errors);
      expect(result).toEqual(event);
    });

    test('debe crear esquema con dataTypeSchema', () => {
      const messageDataSchema = type({
        text: 'string',
        timestamp: 'number'
      });
      const schema = createSocketIoEventSchema(messageDataSchema);
      const event = { eventName: 'message', data: { text: 'Hola!', timestamp: 1234567890 } };
      const result = schema(event);
      
      expect(result).not.toBeInstanceOf(type.errors);
      expect(result).toEqual(event);
    });

    test('debe rechazar datos que no cumplen el dataTypeSchema', () => {
      const messageDataSchema = type({
        text: 'string',
        timestamp: 'number'
      });
      const schema = createSocketIoEventSchema(messageDataSchema);
      const invalidEvent = { eventName: 'message', data: { text: 'Hola!' } };
      const result = schema(invalidEvent);
      
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('parseSocketIo42MessageWithSchema', () => {
    test('debe parsear y validar mensaje Socket.io con esquema', () => {
      const messageDataSchema = type({
        text: 'string',
        timestamp: 'number'
      });
      const socketMessage = '42["message", {"text": "Hola!", "timestamp": 1234567890}]';
      const result = parseSocketIo42MessageWithSchema(socketMessage, messageDataSchema);
      
      expect(result.success).toBe(true);
      expect(result.data?.eventName).toBe('message');
      expect(result.data?.data).toEqual({ text: 'Hola!', timestamp: 1234567890 });
    });

    test('debe rechazar mensaje con datos inválidos', () => {
      const messageDataSchema = type({
        text: 'string',
        timestamp: 'number'
      });
      const socketMessage = '42["message", {"text": "Hola!"}]';
      const result = parseSocketIo42MessageWithSchema(socketMessage, messageDataSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('debe rechazar formato inválido de Socket.io', () => {
      const messageDataSchema = type({ text: 'string' });
      const invalidMessage = 'invalid message';
      const result = parseSocketIo42MessageWithSchema(invalidMessage, messageDataSchema);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Socket.io message format');
    });

    test('debe funcionar sin esquema', () => {
      const socketMessage = '42["message", {"text": "Hola!"}]';
      const result = parseSocketIo42MessageWithSchema(socketMessage);
      
      expect(result.success).toBe(true);
      expect(result.data?.eventName).toBe('message');
      expect(result.data?.data).toEqual({ text: 'Hola!' });
    });
  });

  describe('ArktypeSchemas', () => {
    test('nonEmptyString debe validar strings no vacíos', () => {
      expect(ArktypeSchemas.nonEmptyString('Hola')).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.nonEmptyString('')).toBeInstanceOf(type.errors);
    });

    test('email debe validar emails', () => {
      expect(ArktypeSchemas.email('test@example.com')).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.email('not-an-email')).toBeInstanceOf(type.errors);
    });

    test('url debe validar URLs', () => {
      expect(ArktypeSchemas.url('https://example.com')).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.url('not-a-url')).toBeInstanceOf(type.errors);
    });

    test('positiveNumber debe validar números positivos', () => {
      expect(ArktypeSchemas.positiveNumber(42)).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.positiveNumber(-1)).toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.positiveNumber(0)).toBeInstanceOf(type.errors);
    });

    test('integer debe validar enteros', () => {
      expect(ArktypeSchemas.integer(7)).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.integer(7.5)).toBeInstanceOf(type.errors);
    });

    test('nonEmptyArray debe validar arrays no vacíos', () => {
      expect(ArktypeSchemas.nonEmptyArray([1, 2, 3])).not.toBeInstanceOf(type.errors);
      expect(ArktypeSchemas.nonEmptyArray([])).toBeInstanceOf(type.errors);
    });

    test('requiredObject debe validar objetos con llaves requeridas', () => {
      const schema = ArktypeSchemas.requiredObject(['name', 'age']);
      expect(schema({ name: 'Juan', age: 30 })).not.toBeInstanceOf(type.errors);
      expect(schema({ name: 'Juan' })).toBeInstanceOf(type.errors);
    });
  });
});
