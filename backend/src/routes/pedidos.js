import { Router } from "express";
import { db } from "../firebase.js";

const router = Router();

function pad4(n) { return String(n).padStart(4, "0"); }

// Genera el siguiente ID de pedido de forma segura usando una transacción
async function generarSiguienteId() {
  const contadorRef = db.collection("meta").doc("contador-pedidos");
  const nuevoNumero = await db.runTransaction(async (t) => {
    const doc = await t.get(contadorRef);
    const actual = doc.exists ? doc.data().valor : 0;
    const siguiente = actual + 1;
    t.set(contadorRef, { valor: siguiente });
    return siguiente;
  });
  return "PED-" + pad4(nuevoNumero);
}

// Crear un pedido nuevo (vendedor)
router.post("/", async (req, res) => {
  try {
    const { cliente, vendedorId, vendedorNombre, items, fotoOriginal } = req.body;
    if (!cliente || !vendedorId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Faltan datos del pedido." });
    }
    const id = await generarSiguienteId();
    const pedido = {
      id,
      cliente,
      vendedorId,
      vendedorNombre,
      estado: "pendiente",
      modoAtencion: null, // se define al "tomar" el pedido: "separar" | "confirmar"
      items: items.map((it, i) => ({
        id: it.id || `it-${i}`,
        cantidad: Number(it.cantidad) || 1,
        codigo: (it.codigo || "").trim(),
        piso: it.piso || "",
        check: null,
        texto: ""
      })),
      // Guardamos la foto original de la lista (base64) tal como la subió el
      // vendedor, para poder revisarla luego junto al pedido.
      fotoOriginal: typeof fotoOriginal === "string" ? fotoOriginal : null,
      creadoEn: Date.now(),
      vistoPorVendedor: true
    };
    await db.collection("pedidos").doc(id).set(pedido);
    res.json(pedido);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear el pedido." });
  }
});

// Listar pedidos (opcionalmente filtrados por vendedor)
router.get("/", async (req, res) => {
  try {
    const { vendedorId } = req.query;
    // Ordenamos aquí mismo en vez de pedírselo a Firestore, así no
    // necesitamos crear ningún índice compuesto en la consola de Firebase.
    let query = db.collection("pedidos");
    if (vendedorId) query = query.where("vendedorId", "==", vendedorId);
    const snap = await query.get();
    // La foto original solo se necesita en el detalle de un pedido — la
    // quitamos de la lista para no cargar cada foto en cada refresco.
    const lista = snap.docs.map(d => {
      const { fotoOriginal, ...resto } = d.data();
      return { ...resto, tieneFoto: !!fotoOriginal };
    });
    lista.sort((a, b) => (b.creadoEn || 0) - (a.creadoEn || 0));
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron listar los pedidos." });
  }
});

// Obtener un pedido puntual
router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("pedidos").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Pedido no encontrado." });
    res.json(doc.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo obtener el pedido." });
  }
});

// Actualizar campos de un pedido (checklist, cajas, estado, etc.)
router.patch("/:id", async (req, res) => {
  try {
    const ref = db.collection("pedidos").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Pedido no encontrado." });
    await ref.set(req.body, { merge: true });
    const actualizado = await ref.get();
    res.json(actualizado.data());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el pedido." });
  }
});

export default router;
