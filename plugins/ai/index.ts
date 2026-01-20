// index.ts
// optional: import 'dotenv/config';
import { HybridRAG } from './rag-service';

async function main() {
  const rag = new HybridRAG("docs_v3");
  await rag.initialize();

  const documentationDocs = [
    // --- DISTRACTOR PELIGROSO (Versión Antigua) ---
    // Si la IA usa esto, fallará porque usa 'connect()' en lugar de 'init()'
    `[DEPRECATED] FluxDB v1.0 Documentation:
     To connect to the database, use the syntax: 
     const db = new FluxDB();
     db.connect("user", "password");
     Note: This version reached EOL in 2023.`,

    // --- INFORMACIÓN REAL PARTE 1 (Método de Autenticación v2) ---
    `[CURRENT] FluxDB v2.5 Reference Guide - Authentication:
     Breaking Change: v2.x removes the connect() method. 
     You must now use the static factory: FluxDB.init({ apiKey: "sk_..." }).
     Do not pass username/password directly.`,

    // --- INFORMACIÓN REAL PARTE 2 (Configuración de Región) ---
    `[CURRENT] FluxDB v2.5 - Advanced Configuration:
     By default, the client connects to 'us-east'. 
     To force a connection to the European cluster, you must add the property 
     'region: "eu-central"' inside the init object options.`,

    // --- DISTRACTOR IRRELEVANTE (Ruido semántico) ---
    `Internal Team Chat log:
     Dev1: Hey, I can't connect to FluxDB.
     Dev2: Did you try restarting your router? The region is usually the issue.
     Dev1: No, I was just out of coffee.`,
  ];

  console.log("📥 Loading documents...");
  await rag.addDocuments(documentationDocs);

  console.log("🔍 Querying...");
  const answer = await rag.query(
    "Write a JavaScript code snippet to initialize FluxDB v2.5 for Europe."
  );

  console.log("\n--- AI RESPONSE ---");
  console.log(answer);
}

main().catch(console.error);