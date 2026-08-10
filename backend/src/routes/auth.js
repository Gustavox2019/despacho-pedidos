import { Router } from "express";
import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { db } from "../firebase.js";

const router = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Recibe el token que entrega Google al iniciar sesión, lo verifica de
// verdad contra los servidores de Google (nunca confiar en lo que manda
// el navegador sin verificar), y busca si esa cuenta ya tiene un rol
// asignado (vendedor / almacenero) en pedidos anteriores.
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: "Falta el token de Google." });
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Falta configurar GOOGLE_CLIENT_ID en el backend." });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const id = payload.sub; // identificador único y estable de esa cuenta de Google
    const correo = payload.email;
    const nombre = payload.name || correo;

    const ref = db.collection("usuarios").doc(id);
    const doc = await ref.get();

    if (doc.exists) {
      const datos = doc.data();
      return res.json({ id, nombre, correo, rol: datos.rol });
    }

    // Cuenta nueva: todavía no sabemos si es vendedor o almacenero.
    res.json({ id, nombre, correo, rol: null });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "No se pudo verificar la cuenta de Google." });
  }
});

// Guarda el rol elegido la primera vez que alguien entra con una cuenta nueva.
router.post("/rol", async (req, res) => {
  try {
    const { id, nombre, correo, rol } = req.body;
    if (!id || !rol || !["vendedor", "almacenero"].includes(rol)) {
      return res.status(400).json({ error: "Datos inválidos." });
    }
    await db.collection("usuarios").doc(id).set({ nombre, correo, rol }, { merge: true });
    res.json({ id, nombre, correo, rol });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo guardar el rol." });
  }
});

export default router;
