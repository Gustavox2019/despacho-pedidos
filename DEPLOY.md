# Desplegar "Despacho" como sitio web propio (sin instalar nada en tu PC)

Todo se hace desde páginas web, con cuentas gratis. No necesitas abrir una
terminal ni instalar Node, git, ni nada en tu computadora.

Vas a usar 4 servicios gratuitos:
- **GitHub** → donde vive el código (se sube arrastrando archivos, desde la web)
- **Supabase** → la base de datos en la nube
- **Render** → donde corre el backend (el servidor)
- **Vercel** → donde corre el frontend (la página web que ven tus vendedores/almacén)

---

## 1. Sube el código a GitHub (sin instalar git)

1. Crea una cuenta gratis en https://github.com si no tienes.
2. Click en **"New repository"** (botón verde). Nómbralo `despacho-pedidos`,
   déjalo **Private** o Public, no marques ninguna casilla extra, y dale
   **Create repository**.
3. En la página del repo vacío, click en **"uploading an existing file"**.
4. Descomprime el zip que te di en tu PC (solo para arrastrar los archivos,
   no necesitas ejecutar nada) y arrastra **todo el contenido de la carpeta
   `proyecto/`** (las carpetas `backend/`, `frontend/`, y el `README.md`) a
   esa página de GitHub.
5. Dale **Commit changes**. Ya tienes el código en la nube.

## 2. Supabase (base de datos en la nube)

1. Ve a https://supabase.com → **Start your project** → crea un proyecto
   (sin tarjeta), elige cualquier región cercana.
2. **SQL Editor → New query**. Abre el archivo `backend/supabase-schema.sql`
   del proyecto, copia todo su contenido, pégalo ahí, y dale **Run**. Esto
   crea las tablas que la app necesita — se hace una sola vez.
3. **⚙️ Project Settings → API**. Ahí copia (los vas a necesitar en el paso 3):
   - **Project URL**
   - **service_role key** (la clave secreta, NO la "anon public")

## 3. Backend en Render

1. Crea una cuenta gratis en https://render.com (puedes entrar con tu cuenta
   de GitHub directamente).
2. **New → Web Service** → conecta tu repositorio `despacho-pedidos`.
3. Configúralo así:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. Baja a **Environment Variables** y agrega:
   - `GEMINI_API_KEY` → tu clave gratis de https://aistudio.google.com/apikey
   - `SUPABASE_URL` → el "Project URL" del paso 2
   - `SUPABASE_SERVICE_ROLE_KEY` → la "service_role key" del paso 2
   - `FRONTEND_ORIGIN` → de momento pon `*` (lo ajustas en el paso 5)
5. Click **Create Web Service**. Espera a que termine de compilar (unos
   minutos). Te da una URL pública, algo como:
   `https://despacho-backend.onrender.com`
   Guárdala — la necesitas en el siguiente paso.

   ⚠️ En el plan gratis, Render "duerme" el backend tras varios minutos sin
   uso, y tarda ~30 segundos en despertar con el primer request. Es normal.

## 4. Frontend en Vercel

1. Crea una cuenta gratis en https://vercel.com (también puedes usar GitHub).
2. **Add New → Project** → importa tu repositorio `despacho-pedidos`.
3. Configúralo así:
   - **Root Directory**: `frontend`
   - Framework preset: Vite (Vercel lo detecta solo)
4. Antes de darle "Deploy", abre **Environment Variables** y agrega:
   - `VITE_API_BASE_URL` → la URL de Render del paso 3, ej.
     `https://despacho-backend.onrender.com` (sin barra al final)
5. Click **Deploy**. En un par de minutos te da tu URL pública, ej.
   `https://despacho-pedidos.vercel.app` — **esa es la que compartes con tus
   vendedores y almaceneros**.

## 5. Último ajuste: permitir que el backend acepte tu web

1. Vuelve a Render → tu servicio → **Environment**.
2. Cambia `FRONTEND_ORIGIN` de `*` a tu URL real de Vercel, ej.
   `https://despacho-pedidos.vercel.app`
3. Guarda — Render vuelve a desplegar solo.

---

## Listo

Comparte el link de Vercel. Cualquiera lo abre desde el navegador de su
celular o PC, sin instalar nada, y ya pueden crear/despachar pedidos.

## Cuando actualices el código más adelante

Como el código vive en GitHub, cualquier cambio que subas ahí (por ejemplo
si más adelante conectamos el login real de Google, o cargamos la lista de
códigos con "piso") hace que Render y Vercel vuelvan a desplegar
automáticamente — no tienes que repetir estos pasos.
