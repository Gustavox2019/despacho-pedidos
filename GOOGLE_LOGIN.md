# Conectar el login real de Google

Solo identifica a la persona (nombre, correo) — no pide ningún permiso
adicional sobre su cuenta.

## 1. Crear el Client ID (gratis, en la consola de Google)

1. Ve a https://console.cloud.google.com y crea un proyecto (o usa uno que
   ya tengas). No hace falta que sea el mismo de Firebase.
2. Menú ☰ → **APIs & Services → OAuth consent screen**.
   - User Type: **External** → Create.
   - Completa nombre de la app ("Despacho"), tu correo en "User support
     email" y en "Developer contact". Guarda y sigue (Save and Continue)
     en las siguientes pantallas sin agregar nada más.
   - Si te pide "Test users" mientras la app no está publicada, agrega ahí
     los correos de tus vendedores/almaceneros, o publícala (Publish App)
     para que cualquiera con cuenta de Google pueda entrar sin restricción.
3. Menú ☰ → **APIs & Services → Credentials** → **Create Credentials →
   OAuth client ID**.
   - Application type: **Web application**.
   - En **Authorized JavaScript origins** agrega, una por línea:
     - `http://localhost:5173` (para cuando pruebes en tu PC)
     - `https://despacho-pedidos.vercel.app` (tu URL real de Vercel, sin
       barra al final)
   - No necesitas llenar "Authorized redirect URIs".
   - Click **Create**. Te muestra un **Client ID** — cópialo (termina en
     `.apps.googleusercontent.com`).

## 2. Configurarlo en el backend (Render)

En Render → tu servicio → **Environment** → agrega:
```
GOOGLE_CLIENT_ID=el-client-id-que-copiaste
```

## 3. Configurarlo en el frontend (Vercel)

En Vercel → tu proyecto → **Settings → Environment Variables** → agrega:
```
VITE_GOOGLE_CLIENT_ID=el-mismo-client-id
```
Luego ve a **Deployments** → Redeploy (los cambios de variables de entorno
no se aplican solos, hay que forzar un redeploy).

## Cómo funciona

- La primera vez que alguien entra con su cuenta de Google, la app le
  pregunta si es vendedor o almacenero, y lo guarda.
- Las siguientes veces, con la misma cuenta de Google, entra directo con
  el rol que ya tenía — no se lo vuelve a preguntar.
- El backend siempre verifica el token contra los servidores de Google
  antes de confiar en la identidad — nunca se confía en lo que dice el
  navegador sin más.
