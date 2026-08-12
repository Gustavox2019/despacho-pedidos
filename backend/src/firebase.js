import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import "dotenv/config";

let db;

function cargarCredencial() {
  // Opción A: la credencial completa pegada como variable de entorno
  // (así se configura en Render/Railway, sin subir ningún archivo).
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }
  // Opción B: archivo local (para correrlo en tu propia PC).
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./serviceAccountKey.json";
  return JSON.parse(readFileSync(path, "utf-8"));
}

try {
  const serviceAccount = cargarCredencial();
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log("Firebase conectado correctamente.");
} catch (err) {
  console.error("\n No se pudo conectar a Firebase.");
  console.error("   Configura FIREBASE_SERVICE_ACCOUNT_JSON o FIREBASE_SERVICE_ACCOUNT_PATH.");
  console.error("   Sigue las instrucciones del README/DEPLOY para generarlo.\n");
  console.error(err.message);
  process.exit(1);
}

export { db };
