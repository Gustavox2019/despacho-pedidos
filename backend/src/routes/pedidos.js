import { Router } from "express";
import { supabase } from "../supabase.js";
import { enviarPushAUsuario, enviarPushARol } from "../push.js";

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
  fotos: "fotos",
  creadoEn: "creado_en",
  vistoPorVendedor: "visto_por_vendedor",
  vistoPorAlmacen: "visto_por_almacen",
  almaceneroId: "almacenero_id",
  almaceneroNombre: "almacenero_nombre",
  tomadoEn: "tomado_en",
  cajas: "cajas",
  finalizadoEn: "finalizado_en",
  canceladoEn: "cancelado_en",
  historial: "historial",
  anclado: "anclado",
  ultimoMensajeEn: "ultimo_mensaje_en",
  ultimoMensajeAutorRol: "ultimo_mensaje_autor_rol",
  chatVistoVendedor: "chat_visto_vendedor",
  chatVistoAlmacen: "chat_visto_almacen",
  fotoUbicacion: "foto_ubicacion",
  areaUbicacion: "area_ubicacion",
  notasPaquete: "notas_paquete",
  despachadoEn: "despachado_en",
  despachadoPorNombre: "despachado_por_nombre"
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
  // Compatibilidad con pedidos creados antes de este cambio, cuando
  // solo existía una foto (columna "foto", texto único) en vez del
  // arreglo "fotos". Si el pedido no tiene fotos nuevas pero sí tiene
  // la foto antigua, se muestra igual como la primera foto del arreglo.
  if ((!pedido.fotos || pedido.fotos.length === 0) && "foto" in fila && fila.foto) {
    pedido.fotos = [{ id: "foto-legado", src: fila.foto }];
  }
  if (!pedido.fotos) pedido.fotos = [];
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
    const { cliente, vendedorId, vendedorNombre, items, fotos, tipo } = req.body;
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
      historial: [],
      anclado: false,
      vistoPorAlmacen: false, // así el almacén ve el aviso de "pedido nuevo"
      chatVistoVendedor: true,
      chatVistoAlmacen: true,
      items: items.map((it, i) => ({
        id: it.id || `it-${i}`,
        cantidad: Number(it.cantidad) || 1,
        codigo: (it.codigo || "").trim(),
        piso: it.piso || "",
        // referencia a la foto de la que salió este código (para poder
        // borrar sus líneas si el vendedor quita esa foto); null si vino
        // de Excel o se agregó a mano.
        fotoId: it.fotoId || null,
        check: null,
        texto: ""
      })),
      // arreglo de fotos: [{ id, src }, ...] — antes era una sola "foto"
      fotos: Array.isArray(fotos) ? fotos.filter(f => f && f.src) : [],
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

    // Push a todo el almacén — no bloqueante (fire-and-forget); si falla
    // el envío del push, no debe afectar la respuesta ya mandada.
    enviarPushARol("almacenero", {
      titulo: "Nuevo pedido",
      cuerpo: `${cliente} · ${pedido.items.length} código(s)`,
      tag: `pedido-${id}`,
      url: "/"
    }).catch(err => console.error("Push (pedido nuevo) falló:", err.message));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear el pedido." });
  }
});

// Listar pedidos (opcionalmente filtrados por vendedor, u "ocultando"
// el contenido de los que no son del vendedor que consulta).
// Cuántos días atrás se consideran "recientes" para el refresco normal
// (pedidos ya cerrados — finalizado/despachado/cancelado — más viejos que
// esto no se mandan en el refresco de cada 15s; solo se piden aparte
// cuando se entra a Estadísticas, Faltantes o Exportar con "completo=1").
const DIAS_RECIENTES = 4;

router.get("/", async (req, res) => {
  try {
    const { vendedorId, viewerId, ocultarAjenos, completo } = req.query;

    // Arma la consulta desde cero (sin ejecutarla) — se usa una función en
    // vez de un query ya armado porque hay que repetirla varias veces para
    // traer la info en bloques (ver más abajo), y un query de supabase-js
    // no se puede "reusar" dos veces una vez que ya se le pidió un rango.
    function construirQuery() {
      // La foto no se necesita en el listado (pesaría de más); solo se pide
      // cuando se consulta un pedido puntual. "tiene_foto" es una columna
      // calculada en la base de datos.
      let query = supabase
        .from("pedidos")
        .select(
          "id, cliente, vendedor_id, vendedor_nombre, estado, tipo, items, " +
          "tiene_foto, creado_en, visto_por_vendedor, visto_por_almacen, almacenero_id, " +
          "almacenero_nombre, tomado_en, cajas, finalizado_en, cancelado_en, " +
          "historial, anclado, ultimo_mensaje_en, ultimo_mensaje_autor_rol, " +
          "chat_visto_vendedor, chat_visto_almacen, despachado_en, despachado_por_nombre"
        )
        .order("anclado", { ascending: false })
        .order("creado_en", { ascending: false });
      if (vendedorId) query = query.eq("vendedor_id", vendedorId);

      // Sin "completo=1" (el caso normal: el refresco automático de cada
      // 15s), no se trae TODO el historial — solo lo operativamente
      // relevante: pedidos todavía pendientes/en proceso, lo cerrado hace
      // pocos días, y lo anclado (fijado). El historial completo (para
      // Estadísticas, Faltantes y Exportar) se pide aparte, solo cuando se
      // abren esas pantallas — así el poll de todo el día no carga cada vez
      // más pesado a medida que se acumulan meses de pedidos.
      if (completo !== "1") {
        const corte = Date.now() - DIAS_RECIENTES * 24 * 60 * 60 * 1000;
        query = query.or(
          `estado.in.(pendiente,tomado),anclado.eq.true,creado_en.gte.${corte}`
        );
      }
      return query;
    }

    // Supabase/PostgREST solo devuelve hasta 1000 filas por consulta (es el
    // límite por defecto del proyecto), así que con meses de pedidos
    // acumulados el historial completo lo supera fácilmente y se quedaba
    // cortando justo los pedidos más antiguos sin avisar. Acá se trae en
    // bloques de 1000 hasta agotar los resultados, para que "Todos" con el
    // filtro apagado realmente traiga TODO el historial.
    const TAM_BLOQUE = 1000;
    let data = [];
    let desde = 0;
    while (true) {
      const { data: bloque, error } = await construirQuery().range(desde, desde + TAM_BLOQUE - 1);
      if (error) throw error;
      data = data.concat(bloque || []);
      if (!bloque || bloque.length < TAM_BLOQUE) break;
      desde += TAM_BLOQUE;
    }

    let lista = data.map(aPedido);

    // Un vendedor ve TODOS los pedidos (como el almacenero), pero de los
    // que no son suyos solo se manda lo justo para mostrar el recuadro
    // bloqueado — nunca la lista de códigos ni la foto. Se recorta a
    // propósito a solo estos campos (no ".../*p*/...") para que este
    // refresco automático (cada pocos segundos, para todos los
    // vendedores) pese lo menos posible — es la consulta que más se
    // repite de toda la app.
    if (ocultarAjenos === "1" && viewerId) {
      lista = lista.map(p => {
        if (p.vendedorId === viewerId) return p;
        return {
          id: p.id, cliente: p.cliente, vendedorId: p.vendedorId, vendedorNombre: p.vendedorNombre,
          estado: p.estado, creadoEn: p.creadoEn, anclado: p.anclado,
          cantidadCodigos: (p.items || []).length, items: [], oculto: true
        };
      });
    }

    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudieron listar los pedidos." });
  }
});

// Buscar pedidos en TODO el historial por filtros y/o código — a
// diferencia del listado normal (de arriba), esto NO trae nunca el
// historial completo: la búsqueda se hace directo en la base de datos
// (función "buscar_pedidos" en Supabase) y solo viaja al navegador lo
// que calza con los filtros. Así se puede ubicar un pedido viejo sin
// gastar de más el ancho de banda (egress) de Supabase.
// IMPORTANTE: esta ruta debe ir ANTES de "/:id" — si no, Express
// entendería "buscar" como si fuera un id de pedido.
router.get("/buscar", async (req, res) => {
  try {
    const {
      codigo, cliente, idPedido, vendedor, almacenero,
      fechaDesde, fechaHasta, estados,
      viewerId, ocultarAjenos
    } = req.query;

    const sinFiltro = !codigo && !cliente && !idPedido && !vendedor && !almacenero && !fechaDesde && !fechaHasta;
    if (sinFiltro) {
      return res.status(400).json({ error: "Aplica al menos un filtro para buscar." });
    }

    const { data, error } = await supabase.rpc("buscar_pedidos", {
      patron_codigo: codigo || null,
      patron_cliente: cliente || null,
      patron_id: idPedido || null,
      patron_vendedor: vendedor || null,
      patron_almacenero: almacenero || null,
      desde_ms: fechaDesde ? new Date(`${fechaDesde}T00:00:00`).getTime() : null,
      hasta_ms: fechaHasta ? new Date(`${fechaHasta}T23:59:59.999`).getTime() : null,
      estados: estados ? estados.split(",") : null,
      limite: 300
    });
    if (error) throw error;

    let lista = (data || []).map(aPedido);

    // Mismo recorte que en el listado normal: un vendedor no ve el
    // contenido de pedidos que no son suyos.
    if (ocultarAjenos === "1" && viewerId) {
      lista = lista.map(p => {
        if (p.vendedorId === viewerId) return p;
        return {
          id: p.id, cliente: p.cliente, vendedorId: p.vendedorId, vendedorNombre: p.vendedorNombre,
          estado: p.estado, creadoEn: p.creadoEn, anclado: p.anclado,
          cantidadCodigos: (p.items || []).length, items: [], oculto: true
        };
      });
    }

    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo buscar. Si acabas de agregar esta función, revisa que corriste el nuevo bloque del SQL en Supabase." });
  }
});

// Obtener un pedido puntual
// Columnas para el refresco automático (cada pocos segundos) — a
// propósito SIN las fotos (foto original, fotos[], foto de ubicación):
// son las que más pesan, y no cambian solas mientras alguien tiene la
// pantalla abierta. Traerlas de nuevo cada vez desataba un consumo de
// transferencia de datos (egress) altísimo en Supabase.
const COLUMNAS_LIVIANAS =
  "id, cliente, vendedor_id, vendedor_nombre, estado, tipo, items, tiene_foto, " +
  "creado_en, visto_por_vendedor, visto_por_almacen, almacenero_id, almacenero_nombre, " +
  "tomado_en, cajas, finalizado_en, cancelado_en, historial, anclado, " +
  "ultimo_mensaje_en, ultimo_mensaje_autor_rol, chat_visto_vendedor, chat_visto_almacen, " +
  "area_ubicacion, notas_paquete, despachado_en, despachado_por_nombre";

router.get("/:id", async (req, res) => {
  try {
    const liviano = req.query.liviano === "1";
    const { data, error } = await supabase
      .from("pedidos")
      .select(liviano ? COLUMNAS_LIVIANAS : "*")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Pedido no encontrado." });

    const pedido = aPedido(data);

    // Si sigue pendiente, le mostramos al vendedor cuántos pedidos tiene
    // adelante en la cola (por orden de llegada).
    if (data.estado === "pendiente") {
      const { count: totalPendientes } = await supabase
        .from("pedidos").select("*", { count: "exact", head: true }).eq("estado", "pendiente");
      const { count: adelante } = await supabase
        .from("pedidos").select("*", { count: "exact", head: true })
        .eq("estado", "pendiente").lt("creado_en", data.creado_en);
      pedido.posicionEnCola = (adelante || 0) + 1;
      pedido.totalPendientes = totalPendientes || 0;
    }

    res.json(pedido);
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

    // Si este PATCH cambia el estado, necesitamos saber cuál era el
    // anterior para poder avisarle al vendedor solo cuando de verdad
    // cambió (y no en cada guardado silencioso del checklist).
    let estadoAnterior = null;
    if (cambios.estado) {
      const { data: previo } = await supabase.from("pedidos").select("estado").eq("id", req.params.id).maybeSingle();
      estadoAnterior = previo?.estado || null;
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

    if (cambios.estado && cambios.estado !== estadoAnterior && data.vendedor_id) {
      const textos = {
        tomado: "Tu pedido está en proceso.",
        finalizado: data.tipo === "confirmar" ? "Tu pedido fue confirmado." : `Tu pedido fue finalizado · ${data.cajas || 0} caja(s).`,
        cancelado: "Tu pedido fue cancelado.",
        pendiente: "Tu pedido volvió a quedar pendiente."
      };
      enviarPushAUsuario(data.vendedor_id, {
        titulo: `Pedido ${data.id}`,
        cuerpo: textos[cambios.estado] || `${data.cliente} cambió de estado.`,
        tag: `estado-${data.id}-${cambios.estado}`,
        url: "/"
      }).catch(err => console.error("Push (cambio de estado) falló:", err.message));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el pedido." });
  }
});

export default router;
