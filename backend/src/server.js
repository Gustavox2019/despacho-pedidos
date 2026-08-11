import express from "express";
import cors from "cors";
import "dotenv/config";
import pedidosRouter from "./routes/pedidos.js";
import chatRouter from "./routes/chat.js";
import ocrRouter from "./routes/ocr.js";
import authRouter from "./routes/auth.js";
import matchRouter from "./routes/match.js";

const app = express();

// Acepta varios orígenes separados por coma en FRONTEND_ORIGIN, y además
// cualquier subdominio *.vercel.app (para que los deploys de "preview" de
// Vercel, que cambian de URL cada vez, también funcionen sin retocar nada).
const origenesFijos = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map(o => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // llamadas sin origin (ej. curl, health checks)
    const limpio = origin.replace(/\/$/, "");
    const permitido = origenesFijos.includes(limpio) || /\.vercel\.app$/.test(new URL(origin).hostname);
    callback(null, permitido);
  }
}));
app.use(express.json({ limit: "12mb" })); // las fotos van en base64, necesitan más espacio

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/pedidos", pedidosRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ocr", ocrRouter);
app.use("/api/auth", authRouter);
app.use("/api/match", matchRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  Backend de Despacho corriendo en http://localhost:${PORT}\n`);
});
