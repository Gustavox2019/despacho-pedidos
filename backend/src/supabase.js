import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL;
// La Service Role Key (NO la "anon" key) — tiene acceso total y se salta
// Row Level Security, igual que antes el Admin SDK de Firebase se saltaba
// las reglas de Firestore. Nunca se expone al frontend, solo vive acá en
// el backend.
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("\n No se pudo conectar a Supabase.");
  console.error("   Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el .env del backend.");
  console.error("   Ambos datos están en tu proyecto de Supabase → Settings → API.\n");
  process.exit(1);
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
});

console.log("Supabase conectado correctamente.");
