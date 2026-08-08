import express from "express";
import cors from "cors";
import "dotenv/config";
import pedidosRouter from "./routes/pedidos.js";
import chatRouter from "./routes/chat.js";
import ocrRouter from "./routes/ocr.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "12mb" })); // las fotos van en base64, necesitan más espacio

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/pedidos", pedidosRouter);
app.use("/api/chat", chatRouter);
app.use("/api/ocr", ocrRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n  Backend de Despacho corriendo en http://localhost:${PORT}\n`);
});
