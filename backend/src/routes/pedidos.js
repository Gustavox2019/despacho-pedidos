import { Router } from "express";
import { supabase } from "../supabase.js";

const router = Router();

// Mapa entre los nombres que usa el frontend (camelCase, igual que antes
// con Firestore) y las columnas reales en Postgres (snake_case).
const CAMPOS_PEDIDO = {
  cliente: "cliente",
  vendedorId: "vendedor_id",
  vendedorNombre: "vendedor_nombre",
  estado: "estado",
  tipo: "tipo",
  items: "items",
  foto: "foto",
  creadoEn: "creado_en",
  vistoPorVendedor: "visto_por_vendedor",
  almaceneroId: "almacenero_id",
  almaceneroNombre: "almacenero_nombre",
  tomadoEn: "tomado_en",
  cajas: "cajas",
  finalizadoEn: "finalizado_en"
};

// camelCase (lo que manda el frontend) → snake_case (columnas de Postgres).
// Solo incluye las claves presentes en `obj`, así sirve tanto para crear
// como para actualizar parcialmente (PATCH).
function aColumnas(obj) {
  const fila = {};
  for (const [clave, valor] of Object.entries(obj)) {
    const columna = CAMPOS_PEDIDO[clave];
    if (columna) fila[columna] = valor;
  }
  return fila;
}

// Fila de Postgres (snake_case) → objeto "pedido" tal como lo espera el
// frontend (camelCase), igual forma que antes devolvía Firestore.
function aPedido(fila) {
  if (!fila) return null;
  const pedido = { id: fila.id };
  for (const [clave, columna] of Object.entries(CAMPOS_PEDIDO)) {
    pedido[clave] = fila[columna];
  }
  if ("tiene_foto" in fila) pedido.tieneFoto = fila.tiene_foto;
  return pedido;
}

// Genera el siguiente ID de pedido ("PED-0001", "PED-0002"...) usando una
// secuencia de Postgres — ya es atómica de por sí, así que a diferencia de
// Firestore no hace falta envolverla en una transacción manual.
async function generarSiguienteId() {
  const { data, error } = await supabase.rpc("siguiente_pedido_id");
  if (error) throw error;
  return data;
}

// Crear un pedido nuevo (vendedor)
router.post("/", async (req, res) => {
  try {
    const { cliente, vendedorId, vendedorNombre, items, foto, tipo } = req.body;
    if (!cliente || !vendedorId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Faltan datos del pedido." });
    }
    if (!["separar", "confirmar"].includes(tipo)) {
      return res.status(400).json({ error: "Falta indicar si el pedido es para separar o confirmar." });
    }
    const id = await generarSiguienteId();
    const pedido = {
      id,
      cliente,
      vendedorId,
      vendedorNombre,
      estado: "pendiente",
      tipo, // ahora lo define el vendedor al crear el pedido, no el almacenero al tomarlo
      items: items.map((it, i) => ({
        id: it.id || `it-${i}`,
        cantidad: Number(it.cantidad) || 1,
        codigo: (it.codigo || "").trim(),
        piso: it.piso || "",
        check: null,
        texto: ""
      })),
      foto: foto || null,
      creadoEn: Date.now(),
      vistoPorVendedor: true
    };

    const { data, error } = await supabase
      .from("pedidos")
      .insert({ id, ...aColumnas(pedido) })
      .select()
      .single();
    if (error) throw error;

    res.json(aPedido(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear el pedido." });
  }
});

// Listar pedidos (opcionalmente filtrados por vendedor)
router.get("/", async (req, res) => {
  try {
    const { vendedorId } = req.query;
    // La foto no se necesita en el listado (pesaría de más); solo se pide
    // cuando se consulta un pedido puntual. "tiene_foto" es una columna
    // calculada en la base de datos.
    let query = supabase
      .from("pedidos")
      .select(
        "id, cliente, vendedor_id, vendedor_nombre, estado, tipo, items, " +
        "tiene_foto, creado_en, visto_por_vendedor, almacenero_id, " +
        "almacenero_nombre, tomado_en, cajas, finalizado_en"
      )
      .order("creado_en", { ascending: false });
    if (vendedorId) query = query.eq("vendedor_id", vendedorId);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data.map(aPedido));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron listar los pedidos." });
  }
});

// Obtener un pedido puntual
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Pedido no encontrado." });
    res.json(aPedido(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo obtener el pedido." });
  }
});

// Actualizar campos de un pedido (checklist, cajas, estado, etc.)
router.patch("/:id", async (req, res) => {
  try {
    const cambios = aColumnas(req.body);
    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ error: "Nada que actualizar." });
    }
    const { data, error } = await supabase
      .from("pedidos")
      .update(cambios)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Pedido no encontrado." });
    res.json(aPedido(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el pedido." });
  }
});

export default router;
