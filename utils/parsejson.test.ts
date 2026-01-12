/**
 * Archivo de prueba para los parsers de JSON
 * Ejecutar con: npx ts-node src/utils/parsejson.test.ts
 */

import { type } from 'arktype';
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

console.log('=== Pruebas de parsejson.ts ===\n');

// Prueba 1: parseSocketIo42Message
console.log('1. Prueba de parseSocketIo42Message:');
const socketMessage = '42["chat", {"message": "Hola mundo"}]';
const parsedSocket = parseSocketIo42Message(socketMessage);
console.log('Mensaje:', socketMessage);
console.log('Resultado:', JSON.stringify(parsedSocket, null, 2));
console.log('✓ parseSocketIo42Message funciona correctamente\n');

// Prueba 2: parseJson
console.log('2. Prueba de parseJson:');
const validJson = '{"name": "Juan", "age": 30}';
const invalidJson = '{name: "Juan"}';
const parsedValid = parseJson(validJson);
const parsedInvalid = parseJson(invalidJson);
console.log('JSON válido:', validJson);
console.log('Resultado:', parsedValid);
console.log('JSON inválido:', invalidJson);
console.log('Resultado:', parsedInvalid);
console.log('✓ parseJson funciona correctamente\n');

// Prueba 3: parseJsonWithSchema
console.log('3. Prueba de parseJsonWithSchema:');
const userSchema = type({
  name: 'string',
  age: 'number',
  email: 'string.email'
});
const userJson = '{"name": "Maria", "age": 25, "email": "maria@example.com"}';
const validatedUser = parseJsonWithSchema(userJson, userSchema);
console.log('JSON de usuario:', userJson);
console.log('Resultado validado:', validatedUser);
console.log('✓ parseJsonWithSchema funciona correctamente\n');

// Prueba 4: parseJsonArray
console.log('4. Prueba de parseJsonArray:');
const arrayJson = '[1, 2, 3, 4, 5]';
const notArrayJson = '{"key": "value"}';
const parsedArray = parseJsonArray(arrayJson);
const parsedNotArray = parseJsonArray(notArrayJson);
console.log('JSON de array:', arrayJson);
console.log('Resultado:', parsedArray);
console.log('JSON no array:', notArrayJson);
console.log('Resultado:', parsedNotArray);
console.log('✓ parseJsonArray funciona correctamente\n');

// Prueba 5: parseJsonArrayWithSchema
console.log('5. Prueba de parseJsonArrayWithSchema:');
const numberSchema = type('number');
const numberArrayJson = '[10, 20, 30, 40, 50]';
const validatedArray = parseJsonArrayWithSchema(numberArrayJson, numberSchema);
console.log('Array JSON:', numberArrayJson);
console.log('Resultado validado:', validatedArray);
console.log('✓ parseJsonArrayWithSchema funciona correctamente\n');

// Prueba 6: parseJsonObject
console.log('6. Prueba de parseJsonObject:');
const objectJson = '{"id": 1, "title": "Test"}';
const arrayJson2 = '[1, 2, 3]';
const parsedObject = parseJsonObject(objectJson);
const parsedArrayAsObject = parseJsonObject(arrayJson2);
console.log('JSON de objeto:', objectJson);
console.log('Resultado:', parsedObject);
console.log('JSON de array:', arrayJson2);
console.log('Resultado:', parsedArrayAsObject);
console.log('✓ parseJsonObject funciona correctamente\n');

// Prueba 7: parseJsonObjectWithSchema
console.log('7. Prueba de parseJsonObjectWithSchema:');
const productSchema = type({
  id: 'number',
  name: 'string',
  price: 'number > 0'
});
const productJson = '{"id": 1, "name": "Laptop", "price": 999.99}';
const validatedProduct = parseJsonObjectWithSchema(productJson, productSchema);
console.log('JSON de producto:', productJson);
console.log('Resultado validado:', validatedProduct);
console.log('✓ parseJsonObjectWithSchema funciona correctamente\n');

// Prueba 8: parseJsonPrimitive
console.log('8. Prueba de parseJsonPrimitive:');
const primitiveJsons = ['"texto"', '123', 'true', 'null'];
primitiveJsons.forEach((json, i) => {
  const result = parseJsonPrimitive(json);
  console.log(`  ${i + 1}. ${json} ->`, result);
});
console.log('✓ parseJsonPrimitive funciona correctamente\n');

// Prueba 9: parseJsonSafe
console.log('9. Prueba de parseJsonSafe:');
const complexJson = '{"nested": {"deep": {"value": 42}}}';
const safeParsed = parseJsonSafe(complexJson, { strict: true, maxDepth: 5 });
const unsafeParsed = parseJsonSafe(complexJson, { strict: true, maxDepth: 1 });
console.log('JSON complejo:', complexJson);
console.log('Parseo seguro (maxDepth: 5):', safeParsed);
console.log('Parseo inseguro (maxDepth: 1):', unsafeParsed);
console.log('✓ parseJsonSafe funciona correctamente\n');

// Prueba 10: parseMultipleJson
console.log('10. Prueba de parseMultipleJson:');
const multipleJsons = ['{"a": 1}', '{"b": 2}', '{"c": 3}'];
const multipleResults = parseMultipleJson(multipleJsons);
console.log('JSONs múltiples:', multipleJsons);
console.log('Resultados:', multipleResults);
console.log('✓ parseMultipleJson funciona correctamente\n');

// Prueba 11: parseAndFormatJson
console.log('11. Prueba de parseAndFormatJson:');
const unformattedJson = '{"name":"John","age":30,"city":"New York"}';
const formattedResult = parseAndFormatJson(unformattedJson, 2);
console.log('JSON sin formato:', unformattedJson);
console.log('JSON formateado:');
console.log(formattedResult.data);
console.log('✓ parseAndFormatJson funciona correctamente\n');

// Prueba 12: createSocketIoEventSchema
console.log('12. Prueba de createSocketIoEventSchema:');
const messageDataSchema = type({
  text: 'string',
  timestamp: 'number'
});
const socketEventSchema = createSocketIoEventSchema(messageDataSchema);
console.log('Esquema de evento Socket.io creado correctamente');
console.log('✓ createSocketIoEventSchema funciona correctamente\n');

// Prueba 13: parseSocketIo42MessageWithSchema
console.log('13. Prueba de parseSocketIo42MessageWithSchema:');
const socketMessage2 = '42["message", {"text": "Hola!", "timestamp": 1234567890}]';
const validatedSocketEvent = parseSocketIo42MessageWithSchema(socketMessage2, messageDataSchema);
console.log('Mensaje Socket.io:', socketMessage2);
console.log('Resultado validado:', JSON.stringify(validatedSocketEvent, null, 2));
console.log('✓ parseSocketIo42MessageWithSchema funciona correctamente\n');

// Prueba 14: ArktypeSchemas
console.log('14. Prueba de ArktypeSchemas:');
const testEmail = 'test@example.com';
const testUrl = 'https://example.com';
const testPositiveNumber = 42;
const testInteger = 7;
const testNonEmptyString = 'Hola';
const testNonEmptyArray = [1, 2, 3];

console.log('Email:', testEmail, '->', ArktypeSchemas.email(testEmail));
console.log('URL:', testUrl, '->', ArktypeSchemas.url(testUrl));
console.log('Número positivo:', testPositiveNumber, '->', ArktypeSchemas.positiveNumber(testPositiveNumber));
console.log('Entero:', testInteger, '->', ArktypeSchemas.integer(testInteger));
console.log('String no vacío:', testNonEmptyString, '->', ArktypeSchemas.nonEmptyString(testNonEmptyString));
console.log('Array no vacío:', testNonEmptyArray, '->', ArktypeSchemas.nonEmptyArray(testNonEmptyArray));
console.log('✓ ArktypeSchemas funciona correctamente\n');

console.log('=== Todas las pruebas completadas exitosamente ===');
