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

1. Entra a https://supabase.com → **Start your project** y crea un proyecto
   nuevo (puedes llamarlo "despacho-pedidos"). No necesitas tarjeta de crédito.
   Elige cualquier región cercana (ej. "South America (São Paulo)") y guarda
   la contraseña de base de datos que te pide (no la necesitas para esta app,
   pero consérvala igual).
2. Ya adentro del proyecto, ve a **SQL Editor** (ícono en la barra lateral) →
   **New query**.
3. Abre el archivo `backend/supabase-schema.sql` (viene incluido en este
   proyecto), copia **todo su contenido**, pégalo en el editor SQL de
   Supabase, y dale **Run**. Esto crea las tablas de pedidos, chats y
   usuarios — se corre una sola vez.
4. Ve a **⚙️ Project Settings → API**. Ahí vas a necesitar dos datos para el
   paso 2:
   - **Project URL**
   - **service_role key** (en "Project API keys" — es la clave secreta, NO
     la "anon public")

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
2. El vendedor crea un pedido: nombre del cliente + la lista, que puede
   subir como foto (a mano o captura de Excel, la IA la transcribe), o como
   archivo Excel/CSV real (se leen los códigos directamente, sin IA). La
   foto original que se sube queda guardada junto al pedido, visible en su
   detalle.
3. **Cualquiera** (vendedor o almacenero) puede tomar un pedido pendiente, y
   elige cómo atenderlo: **Separar** (abre el checklist completo para marcar
   cada código y armar cajas) o **Confirmar** (validación rápida, sin marcar
   línea por línea). Al finalizar, pone la cantidad de cajas. Esto notifica
   al vendedor.
4. Todos ven el listado completo de pedidos enviados (pestañas Pendientes /
   Tomados por mí / Todos), con filtros por cliente, fecha, vendedor o quien
   lo tomó.
5. La sección **Estadísticas** (botón arriba del listado) muestra, en
   porcentaje, quién ha separado más listas que los demás.
6. Cualquiera puede descargar las etiquetas de las cajas (una imagen por
   caja) desde el detalle del pedido ya finalizado.
7. Cada pedido tiene su propio chat, guardado, para dudas de stock — y un
   botón de **WhatsApp** en el detalle para reportar un problema puntual con
   ese pedido a un número de soporte (configúralo con
   `VITE_WHATSAPP_SOPORTE` en el `.env` del frontend, ver
   `frontend/.env.example`).

## Nota técnica: foto original guardada en la base de datos

La foto original se guarda directamente en una columna de la tabla `pedidos`
en Supabase (no se usa Supabase Storage). La app ya redimensiona la foto a
1600px antes de subirla, así que normalmente entra sin problema. Si en el
futuro subes fotos muy detalladas y ves errores al crear el pedido, avísame
y lo cambiamos a Supabase Storage (guardando solo la URL en la fila).

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
