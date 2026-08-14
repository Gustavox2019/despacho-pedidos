# Despacho — App de pedidos (vendedores ↔ almacén)

Proyecto real con backend propio (Node.js) y base de datos en la nube (Supabase,
basada en Postgres), para que los pedidos y el chat existan aunque tu PC esté
apagada. El backend corre en tu PC por ahora; cuando quieras que funcione
24/7, se sube gratis a un servicio como Render (ver el final de este documento).

## Estructura

```
proyecto/
  backend/     → servidor Node.js (API + lectura de fotos con IA)
  frontend/    → la página web (React)
```

---

## Paso 1 — Crear el proyecto de Supabase (base de datos en la nube, gratis)

1. Entra a https://supabase.com → **Start your project** → crea un proyecto
   (puedes llamarlo "despacho-pedidos"). No necesitas tarjeta de crédito.
2. **SQL Editor → New query**. Abre el archivo `backend/supabase-schema.sql`
   de este proyecto, copia todo su contenido, pégalo ahí y dale **Run**.
   Esto crea las tablas que la app necesita — se hace una sola vez.
3. Ve a **⚙️ Project Settings → API**. Ahí copia (los necesitas en el paso 2):
   - **Project URL**
   - **service_role key** (la clave secreta, NO la "anon public")

   ⚠️ La `service_role key` es una credencial sensible — no la compartas ni
   la subas a un repositorio público. Le da acceso total a la base de datos.

## Paso 2 — Configurar el backend

```bash
cd backend
npm install
cp .env.example .env
```

Abre `.env` y completa:
- `GEMINI_API_KEY` → tu clave gratis de https://aistudio.google.com/apikey
  (necesaria para que la app lea las fotos de los pedidos)
- `SUPABASE_URL` → el "Project URL" del paso 1
- `SUPABASE_SERVICE_ROLE_KEY` → la "service_role key" del paso 1

Luego corre el servidor:

```bash
npm run dev
```

Debe aparecer: `Supabase conectado correctamente.` y luego
`Backend de Despacho corriendo en http://localhost:4000`

## Paso 3 — Configurar el frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Se abrirá en `http://localhost:5173`. Ábrelo en tu navegador — esa es la app.

Para que otros dispositivos en tu misma red (celulares de vendedores/almacén)
la usen mientras tu PC está prendida y corriendo el backend, usa la IP de tu
PC en la red local, por ejemplo `http://192.168.1.20:5173`, y ajusta
`FRONTEND_ORIGIN` en `backend/.env` con esa misma dirección.

---

## Cómo usarla

1. Cada persona entra, pone su nombre/correo y elige si es **Vendedor** o
   **Almacenero** (login simple por ahora, sin contraseña).
2. El vendedor crea un pedido: nombre del cliente + foto de la lista (a mano
   o captura de Excel). La IA la transcribe y contrasta cada código contra tu
   catálogo (`backend/src/codigos.json`, ~20,000 códigos).
3. El almacenero revisa el pedido, marca check/equis por código, pone la
   cantidad de cajas y finaliza. Esto notifica al vendedor.
4. Cualquiera puede descargar las etiquetas de las cajas (una imagen por
   caja) desde el detalle del pedido ya finalizado.
5. Cada pedido tiene su propio chat, guardado, para dudas de stock.

## Pendiente conocido: columna "Piso"

Tu catálogo de códigos (`backend/src/codigos.json`) por ahora solo tiene los
códigos — sin el dato de "piso" ni nombre de producto. Por eso ese campo
queda vacío/editable a mano en el checklist. Cuando tengas la lista completa
con código + piso (+ idealmente nombre de producto), se puede reemplazar ese
archivo por una tabla real y el piso se completará solo. Avísame y lo dejamos
listo.

## Siguiente paso: login con Google real

Cuando quieras reemplazar el login simple por un "Iniciar sesión con Google"
de verdad (solo para identificar, sin permisos extra, tal como pediste),
necesitas:
1. Crear un proyecto en https://console.cloud.google.com
2. Ir a **APIs & Services → Credentials → Create OAuth Client ID** (tipo
   "Web application").
3. Pasarme el **Client ID** que te da — con eso conecto el botón real de
   Google en el login.

## Siguiente paso: que funcione sin depender de tu PC

Ahora mismo el frontend y el backend corren en tu PC. La base de datos ya
está en la nube (Supabase), pero para que la app entera funcione con tu PC
apagada, el backend también debe subirse a un servicio en la nube. La forma
más simple y gratuita: **Render.com** (o Railway) — subes la carpeta
`backend/`, configuras las mismas variables de entorno del `.env`, y te da
una URL pública. Cuando quieras dar ese paso, te guío con el detalle.
