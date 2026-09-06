import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCheck, ClipboardList, CheckCircle2, XCircle,
  Boxes, Download, MessageSquare, ChevronLeft, PackageCheck, Plus, Image as ImageIcon, Layers,
  History, Pin, Ban, Undo2, ScanLine, AlertTriangle, FileSpreadsheet, Ticket
} from "lucide-react";
import { fmtTime, fmtFechaHora, uid, calcularProgreso, normCode, resizeImageToBase64 } from "../helpers.js";
import { api } from "../api.js";
import { descargarEtiquetas } from "../etiquetas.js";
import { exportarPedidoXLSX } from "../reporte.js";
import ChatPanel from "./ChatPanel.jsx";
import CodigoInput from "./CodigoInput.jsx";
import CamaraCaptura from "./CamaraCaptura.jsx";

const NUMERO_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER;

export default function DetallePedido({ pedidoId, user, onVolver }) {
  const [pedido, setPedido] = useState(null);
  const [cajasInput, setCajasInput] = useState("");
  const [areaUbicacion, setAreaUbicacion] = useState("");
  const [notasPaquete, setNotasPaquete] = useState("");
  const [fotoUbicacionCapturada, setFotoUbicacionCapturada] = useState(null); // dataURL completo
  const [camaraUbicacionAbierta, setCamaraUbicacionAbierta] = useState(false);
  const fileRefUbicacion = useRef(null);
  const [guardando, setGuardando] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [agregandoAdicional, setAgregandoAdicional] = useState(false);
  const [camaraAdicionalAbierta, setCamaraAdicionalAbierta] = useState(false);
  const fileRefAdicional = useRef(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [escaneando, setEscaneando] = useState(false);
  const [resultadoEscaneo, setResultadoEscaneo] = useState(null); // { tipo, codigoLeido, item }
  const [chatAbierto, setChatAbierto] = useState(false);
  const [camaraAbierta, setCamaraAbierta] = useState(false);
  const fileRefEscaner = useRef(null);
  const pedidoRef = useRef(null);
  // Cuenta cuántos cambios de check/texto están "en camino" de guardarse.
  // Mientras haya alguno pendiente, el refresco automático (cada 6s) NO
  // debe pisar lo que se acaba de marcar en pantalla con datos viejos del
  // servidor — si no, a veces un check recién puesto se veía "desmarcar
  // solo" porque llegaba una respuesta del servidor de antes del guardado.
  const pendientesRef = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const p = await api.obtenerPedido(pedidoId);
      pedidoRef.current = p;
      // Si hay un guardado de check/detalle todavía en camino, no
      // reemplazamos lo que se ve en pantalla con esta respuesta — podría
      // ser de un momento anterior al clic que acaba de hacer la persona.
      if (pendientesRef.current === 0) {
        setPedido(p);
        if (p.cajas) setCajasInput(String(p.cajas));
      }
    } catch (e) { /* se reintenta en el próximo poll */ }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, 6000);
    return () => clearInterval(iv);
  }, [cargar]);

  useEffect(() => {
    (async () => {
      if (pedido && pedido.vendedorId === user.id && pedido.estado === "finalizado" && !pedido.vistoPorVendedor) {
        const actualizado = await api.actualizarPedido(pedidoId, { vistoPorVendedor: true });
        pedidoRef.current = actualizado;
        setPedido(actualizado);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.estado, pedido?.vistoPorVendedor]);

  // Al abrir el pedido: si soy almacenero y es un pedido nuevo, se marca
  // como visto (para que deje de salir el aviso de "pedido nuevo" en la
  // lista). El chat NO se marca acá — ahora es un globo flotante, se
  // marca como leído recién cuando de verdad se abre (ver más abajo).
  useEffect(() => {
    (async () => {
      if (!pedido) return;
      if (user.rol === "almacenero" && !pedido.vistoPorAlmacen) {
        const actualizado = await api.actualizarPedido(pedidoId, { vistoPorAlmacen: true });
        pedidoRef.current = actualizado;
        setPedido(actualizado);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id, pedido?.vistoPorAlmacen]);

  // Se marca el chat como leído justo cuando se abre el globo flotante.
  useEffect(() => {
    (async () => {
      if (!pedido || !chatAbierto) return;
      const cambios = {};
      if (user.rol === "vendedor" && pedido.vendedorId === user.id && !pedido.chatVistoVendedor) cambios.chatVistoVendedor = true;
      if (user.rol === "almacenero" && pedido.almaceneroId === user.id && !pedido.chatVistoAlmacen) cambios.chatVistoAlmacen = true;
      if (Object.keys(cambios).length === 0) return;
      const actualizado = await api.actualizarPedido(pedidoId, cambios);
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatAbierto, pedido?.chatVistoVendedor, pedido?.chatVistoAlmacen]);

  function guardarEnSegundoPlano(patch) {
    pendientesRef.current += 1;
    api.actualizarPedido(pedidoId, patch)
      .then(actualizado => { pedidoRef.current = actualizado; })
      .catch(err => console.error("No se pudo guardar:", err))
      .finally(() => {
        pendientesRef.current = Math.max(0, pendientesRef.current - 1);
        // Ya no queda nada pendiente — sincroniza de una vez con lo que
        // realmente quedó guardado, sin esperar el próximo refresco.
        if (pendientesRef.current === 0 && pedidoRef.current) setPedido(pedidoRef.current);
      });
  }

  // Mientras el pedido sigue "tomado" (aún no finalizado) por mí, los
  // cambios se guardan normal. Una vez finalizado, si soy quien lo tomó,
  // igual puedo seguir editando — pero cada cambio de check queda anotado
  // en el historial del pedido, visible para el vendedor.
  function updateItemCheck(itemId, patch) {
    const itemAnterior = pedido.items.find(it => it.id === itemId);
    const nuevosItems = pedido.items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    const cambios = { items: nuevosItems };

    if (puedeEditarFinalizado && "check" in patch) {
      const etiqueta = patch.check === "ok" ? "✓ correcto" : patch.check === "no" ? "✕ con problema" : "sin marcar";
      const entrada = {
        id: uid("h"), ts: Date.now(), autor: user.nombre,
        descripcion: `Cambió el código ${itemAnterior?.codigo || ""} a "${etiqueta}" después de finalizar el pedido`
      };
      cambios.historial = [...(pedido.historial || []), entrada];
    }

    setPedido({ ...pedido, ...cambios });
    guardarEnSegundoPlano(cambios);
  }

  // Toma el código leído (venga de una foto subida, o de la cámara en
  // vivo del navegador) y decide qué hacer: marcarlo directo si coincide
  // y estaba sin marcar, avisar si no pertenece al pedido, o preguntar si
  // ya estaba marcado.
  function procesarCodigoEscaneado(codigo) {
    if (!codigo) {
      setResultadoEscaneo({ tipo: "no_leido" });
      return;
    }
    const n = normCode(codigo);
    const item = pedido.items.find(it =>
      normCode(it.codigo) === n || (it.codigosAlternos || []).some(alt => normCode(alt) === n)
    );
    if (!item) {
      setResultadoEscaneo({ tipo: "no_pertenece", codigoLeido: codigo });
    } else if (!item.check) {
      // Coincide y no estaba marcado — se confirma directo, sin preguntar.
      updateItemCheck(item.id, { check: "ok" });
      setResultadoEscaneo({ tipo: "confirmado", codigoLeido: codigo, item });
    } else {
      setResultadoEscaneo({ tipo: "ya_marcado", codigoLeido: codigo, item });
    }
  }

  // Escanear el producto físico (foto de su etiqueta/caja) para
  // confirmar que sea el código correcto antes de marcarlo — evita el
  // caso de "pedían un código y bajaron otro parecido por error".
  async function procesarFotoEscaneo(file) {
    if (!file) return;
    setEscaneando(true);
    setResultadoEscaneo(null);
    try {
      const b64 = await resizeImageToBase64(file, 900, 0.85);
      const { codigo } = await api.escanearProducto(b64, "image/jpeg");
      procesarCodigoEscaneado(codigo);
    } catch (err) {
      setResultadoEscaneo({ tipo: "error", mensaje: err.message });
    } finally {
      setEscaneando(false);
    }
  }

  // Mismo flujo, pero con una foto ya capturada por la cámara en vivo del
  // navegador (viene directo en base64, no hace falta redimensionar un
  // archivo).
  async function procesarBase64Escaneo(base64) {
    setEscaneando(true);
    setResultadoEscaneo(null);
    try {
      const { codigo } = await api.escanearProducto(base64, "image/jpeg");
      procesarCodigoEscaneado(codigo);
    } catch (err) {
      setResultadoEscaneo({ tipo: "error", mensaje: err.message });
    } finally {
      setEscaneando(false);
    }
  }

  function confirmarEscaneo(check) {
    if (resultadoEscaneo?.item) updateItemCheck(resultadoEscaneo.item.id, { check });
    setResultadoEscaneo(null);
  }

  async function agregarProducto() {
    if (!nuevoCodigo.trim()) return;
    setAgregando(true);
    try {
      const nuevoItem = { id: uid("it"), cantidad: Number(nuevaCantidad) || 1, codigo: nuevoCodigo.trim(), piso: "", fotoId: null, check: null, texto: "" };
      const nuevosItems = [...pedido.items, nuevoItem];
      const patch = { items: nuevosItems };
      if (debeRegistrarHistorial) {
        const entrada = {
          id: uid("h"), ts: Date.now(), autor: user.nombre,
          descripcion: `Agregó el código ${nuevoItem.codigo} (cant. ${nuevoItem.cantidad}) después de finalizar el pedido`
        };
        patch.historial = [...(pedido.historial || []), entrada];
      }
      const actualizado = await api.actualizarPedido(pedidoId, patch);
      pedidoRef.current = actualizado;
      setPedido(actualizado);
      setNuevoCodigo("");
      setNuevaCantidad(1);
    } finally {
      setAgregando(false);
    }
  }

  // Sube una foto con MÁS códigos para este pedido — se agregan marcados
  // como "adicional" (aparecen aparte, bajo el subtítulo "Adicionales" en
  // el checklist) y el pedido vuelve a "Pendiente" para que el almacén
  // los prepare también.
  async function agregarAdicionalesDesdeFoto(base64) {
    setAgregandoAdicional(true);
    try {
      const { items: nuevos } = await api.transcribir(base64, "image/jpeg");
      if (!nuevos || nuevos.length === 0) {
        setResultadoEscaneo({ tipo: "no_leido" });
        return;
      }
      const itemsAdicionales = nuevos.map(it => ({ ...it, adicional: true }));
      const nuevosItems = [...pedido.items, ...itemsAdicionales];
      const entrada = {
        id: uid("h"), ts: Date.now(), autor: user.nombre,
        descripcion: `Agregó ${itemsAdicionales.length} código(s) adicionales por foto — el pedido volvió a pendiente`
      };
      const actualizado = await api.actualizarPedido(pedidoId, {
        items: nuevosItems,
        estado: "pendiente",
        almaceneroId: null,
        almaceneroNombre: null,
        tomadoEn: null,
        vistoPorAlmacen: false,
        historial: [...(pedido.historial || []), entrada]
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } catch (err) {
      console.error("No se pudieron agregar los adicionales:", err);
    } finally {
      setAgregandoAdicional(false);
    }
  }

  async function procesarArchivoAdicional(file) {
    if (!file) return;
    const b64 = await resizeImageToBase64(file, 1600, 0.85);
    await agregarAdicionalesDesdeFoto(b64);
  }

  function procesarCamaraAdicional(base64) {
    setCamaraAdicionalAbierta(false);
    agregarAdicionalesDesdeFoto(base64);
  }

  async function tomarPedido() {
    setTomando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "tomado", almaceneroId: user.id, almaceneroNombre: user.nombre, tomadoEn: Date.now()
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setTomando(false);
    }
  }

  async function finalizarSeparado() {
    setGuardando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "finalizado", cajas: Number(cajasInput), finalizadoEn: Date.now(), vistoPorVendedor: false,
        fotoUbicacion: fotoUbicacionCapturada, areaUbicacion: areaUbicacion.trim(), notasPaquete: notasPaquete.trim()
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  async function capturarFotoUbicacionArchivo(file) {
    if (!file) return;
    const b64 = await resizeImageToBase64(file, 1000, 0.8);
    setFotoUbicacionCapturada("data:image/jpeg;base64," + b64);
  }

  function capturarFotoUbicacionCamara(base64) {
    setCamaraUbicacionAbierta(false);
    setFotoUbicacionCapturada("data:image/jpeg;base64," + base64);
  }

  async function confirmarPedido() {
    setGuardando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "finalizado", finalizadoEn: Date.now(), vistoPorVendedor: false
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  // El vendedor puede reabrir un pedido ya "confirmado" para que el
  // almacén ahora sí lo separe y arme en cajas — se envía de nuevo con
  // el checklist en blanco, como si acabara de llegar.
  async function reenviarParaSeparar() {
    const ok = window.confirm("Esto vuelve a enviar el pedido al almacén, ahora para que lo separen y armen en cajas. ¿Continuar?");
    if (!ok) return;
    setGuardando(true);
    try {
      const itemsReiniciados = pedido.items.map(it => ({ ...it, check: null, texto: "" }));
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "pendiente",
        tipo: "separar",
        items: itemsReiniciados,
        almaceneroId: null,
        almaceneroNombre: null,
        tomadoEn: null,
        cajas: null,
        finalizadoEn: null,
        vistoPorVendedor: true
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  // El almacenero que tomó el pedido puede "liberarlo" — vuelve a la
  // bandeja de pendientes por si no lo puede terminar, sin borrar nada;
  // queda anotado en el historial quién lo liberó y cuándo.
  async function liberarPedido() {
    const ok = window.confirm("Esto libera el pedido — vuelve a quedar pendiente para que cualquiera lo tome. ¿Continuar?");
    if (!ok) return;
    setGuardando(true);
    try {
      const entrada = {
        id: uid("h"), ts: Date.now(), autor: user.nombre,
        descripcion: `Liberó el pedido (lo tenía tomado desde ${fmtFechaHora(pedido.tomadoEn)})`
      };
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "pendiente",
        almaceneroId: null,
        almaceneroNombre: null,
        tomadoEn: null,
        vistoPorAlmacen: false, // así el resto del almacén se entera de que quedó libre otra vez
        historial: [...(pedido.historial || []), entrada]
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  // El vendedor puede cancelar su pedido mientras no esté finalizado.
  async function cancelarPedido() {
    const ok = window.confirm("¿Seguro que quieres cancelar este pedido? El almacén dejará de atenderlo.");
    if (!ok) return;
    setGuardando(true);
    try {
      const actualizado = await api.actualizarPedido(pedidoId, {
        estado: "cancelado", canceladoEn: Date.now()
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleAnclado() {
    const actualizado = await api.actualizarPedido(pedidoId, { anclado: !pedido.anclado });
    pedidoRef.current = actualizado;
    setPedido(actualizado);
  }

  if (!pedido) {
    return <div className="container"><div className="empty-state"><Loader2 className="spin" size={26} /></div></div>;
  }

  const yoLoTome = user.rol === "almacenero" && pedido.almaceneroId === user.id;
  // Ahora el checklist línea por línea aplica a los dos tipos de pedido:
  // en "separar" además se piden las cajas; en "confirmar" basta con
  // marcar cada código para poder confirmar el pedido.
  const puedeMarcarActivo = pedido.estado === "tomado" && yoLoTome;
  // El almacenero que separó el pedido puede seguir editando el checklist
  // incluso después de finalizarlo — pero cada cambio queda anotado en el
  // historial del pedido (ver updateItemCheck / agregarProducto).
  const puedeEditarFinalizado = pedido.estado === "finalizado" && yoLoTome;
  const puedeMarcar = puedeMarcarActivo || puedeEditarFinalizado;
  // En un pedido "confirmar" (sin armado físico de cajas) el vendedor
  // también puede agregar códigos que se le hayan quedado afuera, incluso
  // después de que el almacén ya lo confirmó — no hay cajas que reabrir.
  const puedeAgregarProductoVendedor = pedido.tipo === "confirmar" && pedido.vendedorId === user.id && pedido.estado !== "cancelado";
  const puedeAgregarProducto =
    ((pedido.estado !== "finalizado" && pedido.estado !== "cancelado") || puedeEditarFinalizado) ||
    puedeAgregarProductoVendedor;
  // Cualquier edición (agregar código, marcar check) hecha una vez que el
  // pedido ya está finalizado queda anotada en el historial, sin importar
  // si la hizo el almacenero que lo separó o el vendedor en uno "confirmar".
  const debeRegistrarHistorial = pedido.estado === "finalizado";
  const puedeCancelar = user.rol === "vendedor" && pedido.vendedorId === user.id && (pedido.estado === "pendiente" || pedido.estado === "tomado");
  const puedeChatear = pedido.vendedorId === user.id || pedido.almaceneroId === user.id;
  const chatNoLeido = user.rol === "vendedor"
    ? (pedido.vendedorId === user.id && !pedido.chatVistoVendedor)
    : (pedido.almaceneroId === user.id && !pedido.chatVistoAlmacen);
  const todosMarcados = pedido.items.every(it => it.check === "ok" || it.check === "no");
  const cajasValidas = Number(cajasInput) > 0;
  const puedeFinalizarSeparar = puedeMarcarActivo && pedido.tipo === "separar" && todosMarcados && cajasValidas &&
    !!fotoUbicacionCapturada && areaUbicacion.trim().length > 0;
  const puedeFinalizarConfirmar = puedeMarcarActivo && pedido.tipo === "confirmar" && todosMarcados;
  const progreso = calcularProgreso(pedido);
  const itemsConDetalle = pedido.items.filter(it => it.texto && it.texto.trim());
  const itemsOriginales = pedido.items.filter(it => !it.adicional);
  const itemsAdicionales = pedido.items.filter(it => it.adicional);

  function renderFilaItem(it) {
    return (
      <tr className="item-row" key={it.id}>
        <td style={{ width: 34, fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>{it.cantidad}</td>
        <td>
          <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
            {it.codigo}
            {it.codigosAlternos && it.codigosAlternos.length > 0 && (
              <span style={{ color: "var(--muted)", fontSize: 11.5 }}> / {it.codigosAlternos.join(" / ")}</span>
            )}
          </div>
          {it.piso && <div style={{ fontSize: 11, color: "var(--muted)" }}>Piso: {it.piso}</div>}
        </td>
        <td style={{ width: puedeMarcar ? 260 : 0 }}>
          {puedeMarcar ? (
            <div className="check-controls">
              <button className={`chk-btn ${it.check === "ok" ? "active-ok" : ""}`}
                onClick={() => updateItemCheck(it.id, { check: it.check === "ok" ? null : "ok" })}>
                <CheckCircle2 size={16} />
              </button>
              <button className={`chk-btn ${it.check === "no" ? "active-no" : ""}`}
                onClick={() => updateItemCheck(it.id, { check: it.check === "no" ? null : "no" })}>
                <XCircle size={16} />
              </button>
              {it.texto && <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0 }} title="Este detalle le va a salir marcado con alerta al vendedor" />}
              <input type="text" className="txt-mini" placeholder="Detalle (ej: llegó dañado, faltan piezas...)" value={it.texto || ""}
                onChange={e => updateItemCheck(it.id, { texto: e.target.value })} />
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {it.texto ? (
                <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0 }} />
              ) : (
                <>
                  {it.check === "ok" && <CheckCircle2 size={16} color="var(--green)" />}
                  {it.check === "no" && <XCircle size={16} color="var(--red)" />}
                </>
              )}
              {it.texto && <span style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 700 }}>{it.texto}</span>}
            </div>
          )}
        </td>
      </tr>
    );
  }


  const linkWhatsapp = NUMERO_WHATSAPP
    ? `https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(`Tengo un problema con el pedido ${pedido.id}`)}`
    : null;

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div className="pedido-id" style={{ fontSize: 13 }}>{pedido.id}</div>
          <div className="page-title">{pedido.cliente}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="pin-btn"
            title="Exportar este pedido a Excel"
            onClick={() => exportarPedidoXLSX(pedido)}
          >
            <FileSpreadsheet size={17} />
          </button>
          <button
            className={`pin-btn ${pedido.anclado ? "activo" : ""}`}
            title={pedido.anclado ? "Desanclar pedido" : "Anclar pedido arriba de la lista"}
            onClick={toggleAnclado}
          >
            {pedido.anclado ? <Pin size={17} fill="currentColor" /> : <Pin size={17} />}
          </button>
          {linkWhatsapp && (
            <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap", color: "#25D366", borderColor: "#25D366" }}>
              <MessageSquare size={14} /> WhatsApp
            </a>
          )}
        </div>
      </div>
      <div className="page-sub">
        Vendedor: {pedido.vendedorNombre} · {fmtTime(pedido.creadoEn)}{" "}
        <span className={`status-pill status-${pedido.estado}`} style={{ marginLeft: 6 }}>
          {pedido.estado === "pendiente" && "Pendiente"}
          {pedido.estado === "tomado" && "En proceso"}
          {pedido.estado === "finalizado" && "Finalizado"}
          {pedido.estado === "cancelado" && "Cancelado"}
        </span>
      </div>

      {pedido.estado !== "cancelado" && (
        <div className="progreso-wrap" style={{ marginBottom: 16 }}>
          <div className="progreso-track">
            <div className={`progreso-fill ${progreso >= 100 ? "completo" : ""}`} style={{ width: `${progreso}%` }} />
          </div>
          <div className="progreso-label">{progreso}%</div>
        </div>
      )}

      {itemsConDetalle.length > 0 && (
        <div className="banner banner-warn" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <div>{itemsConDetalle.length} código{itemsConDetalle.length > 1 ? "s" : ""} con detalle en este pedido.</div>
        </div>
      )}

      {pedido.estado === "finalizado" && pedido.finalizadoEn && (
        <div className="page-sub" style={{ marginTop: -14 }}>
          <CheckCheck size={12} style={{ verticalAlign: -2 }} /> Finalizado el {fmtFechaHora(pedido.finalizadoEn)}
          {pedido.historial && pedido.historial.length > 0 && (
            <span style={{ color: "var(--amber)" }}> · editado después ({pedido.historial.length})</span>
          )}
        </div>
      )}

      {pedido.estado === "cancelado" && (
        <div className="banner banner-warn" style={{ background: "rgba(239,91,91,0.08)", borderColor: "var(--red-dim)", color: "var(--red)" }}>
          <Ban size={16} />
          <div>Pedido cancelado{pedido.canceladoEn ? ` el ${fmtFechaHora(pedido.canceladoEn)}` : ""}.</div>
        </div>
      )}

      {pedido.fotos && pedido.fotos.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <ImageIcon size={12} /> {pedido.fotos.length > 1 ? "Fotos originales de la lista" : "Foto original de la lista"}
          </div>
          <div className="fotos-gallery">
            {pedido.fotos.map(f => (
              <img key={f.id} src={f.src} className="foto-thumb" alt="Foto original de la lista" onClick={() => setFotoAmpliada(f.src)} />
            ))}
          </div>
        </div>
      )}

      {pedido.estado !== "pendiente" && pedido.almaceneroNombre && (
        <div className="banner banner-warn" style={{ background: "rgba(63,198,193,0.08)", borderColor: "var(--teal-dim)", color: "var(--teal)" }}>
          <PackageCheck size={16} />
          <div>
            {pedido.tipo === "confirmar" ? "Confirmado" : "Tomado"} por {pedido.almaceneroNombre}{pedido.tomadoEn ? ` · ${fmtTime(pedido.tomadoEn)}` : ""}
          </div>
        </div>
      )}

      {pedido.estado === "finalizado" && pedido.vendedorId === user.id && (
        <div className="banner banner-success">
          <CheckCheck size={16} />
          <div>
            {pedido.tipo === "confirmar"
              ? `Pedido confirmado por ${pedido.almaceneroNombre || "almacén"} · ${fmtFechaHora(pedido.finalizadoEn)}.`
              : `Pedido finalizado por ${pedido.almaceneroNombre || "almacén"} · ${pedido.cajas} caja(s) preparadas · ${fmtFechaHora(pedido.finalizadoEn)}.`}
          </div>
        </div>
      )}

      {pedido.estado === "finalizado" && pedido.tipo === "confirmar" && pedido.vendedorId === user.id && (
        <div className="card">
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            ¿Este pedido sí se tiene que armar físicamente? Puedes reenviarlo al almacén para que lo separen en cajas.
          </div>
          <button className="btn btn-outline btn-block" disabled={guardando} onClick={reenviarParaSeparar}>
            {guardando ? <Loader2 className="spin" size={15} /> : (<><Layers size={14} /> Separar pedido</>)}
          </button>
        </div>
      )}

      {pedido.historial && pedido.historial.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--amber-dim)" }}>
          <div className="section-label" style={{ marginTop: 0, color: "var(--amber)" }}>
            <History size={13} /> Historial de cambios
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pedido.historial.slice().reverse().map(h => (
              <div key={h.id} style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                <strong style={{ color: "var(--text)" }}>{h.autor}</strong> · {fmtFechaHora(h.ts)}
                <br />{h.descripcion}
              </div>
            ))}
          </div>
        </div>
      )}

      {puedeCancelar && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" style={{ color: "var(--red)", borderColor: "var(--red-dim)" }}
            disabled={guardando} onClick={cancelarPedido}>
            <Ban size={13} /> Cancelar pedido
          </button>
        </div>
      )}

      {yoLoTome && pedido.estado === "tomado" && (
        <div style={{ marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" disabled={guardando} onClick={liberarPedido}>
            <Undo2 size={13} /> Liberar pedido
          </button>
          <div className="helper-text" style={{ marginTop: 6, textAlign: "left" }}>
            Vuelve a quedar pendiente para que cualquiera del almacén lo tome — queda registrado en el historial.
          </div>
        </div>
      )}

      {pedido.estado === "pendiente" && pedido.vendedorId === user.id && pedido.posicionEnCola && (
        <div className="banner banner-warn" style={{ marginBottom: 16, textAlign: "center", flexDirection: "column", alignItems: "center" }}>
          <Ticket size={22} style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 15, fontWeight: 800 }}>
            Eres el número <span style={{ color: "var(--amber)" }}>{pedido.posicionEnCola}</span> en la fila
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
            de {pedido.totalPendientes} pedido{pedido.totalPendientes > 1 ? "s" : ""} pendiente{pedido.totalPendientes > 1 ? "s" : ""} por atender · un momento, gracias por tu paciencia
          </div>
        </div>
      )}

      {pedido.estado === "pendiente" && (
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            El vendedor indicó que este pedido es para{" "}
            <strong style={{ color: pedido.tipo === "confirmar" ? "var(--teal)" : "var(--text)" }}>
              {pedido.tipo === "confirmar" ? "Confirmar" : "Separar"}
            </strong>. Nadie lo ha tomado todavía.
          </div>
          <button
            className={`btn ${pedido.tipo === "confirmar" ? "btn-teal" : "btn-primary"} btn-block`}
            disabled={tomando}
            onClick={tomarPedido}
          >
            {tomando ? <Loader2 className="spin" size={15} /> : "Tomar pedido"}
          </button>
        </div>
      )}

      {pedido.estado === "tomado" && !yoLoTome && (
        <div className="banner banner-warn"><ClipboardList size={16} /> Este pedido ya lo está {pedido.tipo === "confirmar" ? "confirmando" : "preparando"} {pedido.almaceneroNombre}.</div>
      )}

      {puedeMarcarActivo && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn btn-outline btn-block" disabled={escaneando} onClick={() => setCamaraAbierta(true)}>
            {escaneando ? <Loader2 className="spin" size={15} /> : (<><ScanLine size={15} /> Escanear producto para confirmar</>)}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ width: "100%", justifyContent: "center", marginTop: 4 }}
            disabled={escaneando}
            onClick={() => fileRefEscaner.current?.click()}
          >
            ¿No abre la cámara? Sube una foto en su lugar
          </button>
          <input
            ref={fileRefEscaner} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            onChange={e => { procesarFotoEscaneo(e.target.files[0]); e.target.value = ""; }}
          />

          {resultadoEscaneo?.tipo === "no_leido" && (
            <div className="banner banner-warn" style={{ marginTop: 10 }}>
              <AlertTriangle size={16} /> No se distinguió ningún código en la foto. Intenta de nuevo, más de cerca.
            </div>
          )}

          {resultadoEscaneo?.tipo === "error" && (
            <div className="banner banner-warn" style={{ marginTop: 10 }}>
              <AlertTriangle size={16} /> {resultadoEscaneo.mensaje}
            </div>
          )}

          {resultadoEscaneo?.tipo === "no_pertenece" && (
            <div className="banner banner-warn" style={{ marginTop: 10, background: "rgba(239,91,91,0.08)", borderColor: "var(--red-dim)", color: "var(--red)" }}>
              <Ban size={16} />
              <div>
                Se leyó el código <strong>{resultadoEscaneo.codigoLeido}</strong> — no corresponde a ningún
                producto de este pedido. Verifica que sea el correcto antes de despacharlo.
              </div>
            </div>
          )}

          {resultadoEscaneo?.tipo === "confirmado" && (
            <div className="banner banner-success" style={{ marginTop: 10 }}>
              <CheckCircle2 size={16} />
              <div>Confirmado: código <strong>{resultadoEscaneo.item.codigo}</strong> (cant. {resultadoEscaneo.item.cantidad}) marcado ✓.</div>
            </div>
          )}

          {resultadoEscaneo?.tipo === "ya_marcado" && (
            <div className="banner banner-warn" style={{ marginTop: 10 }}>
              <ScanLine size={16} />
              <div style={{ flex: 1 }}>
                <div>
                  El código <strong>{resultadoEscaneo.item.codigo}</strong> ya estaba marcado como{" "}
                  {resultadoEscaneo.item.check === "ok" ? "✓ correcto" : "✕ con problema"}. ¿Qué quieres hacer?
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-teal btn-sm" onClick={() => confirmarEscaneo("ok")}>Marcar ✓</button>
                  <button className="btn btn-outline btn-sm" style={{ color: "var(--red)", borderColor: "var(--red-dim)" }} onClick={() => confirmarEscaneo("no")}>Marcar ✕</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setResultadoEscaneo(null)}>Dejar como está</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="section-label"><ClipboardList size={13} /> Checklist</div>
      <div className="checklist-box">
        <table className="item-table">
          <tbody>
            {itemsOriginales.map(it => renderFilaItem(it))}
            {itemsAdicionales.length > 0 && (
              <tr>
                <td colSpan={3} style={{ paddingTop: 14, paddingBottom: 6 }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--amber)", fontWeight: 800 }}>
                    Adicionales
                  </div>
                </td>
              </tr>
            )}
            {itemsAdicionales.map(it => renderFilaItem(it))}
          </tbody>
        </table>
      </div>

      {puedeAgregarProducto && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800, marginBottom: 10 }}>
            Agregar producto a este pedido
          </div>
          {pedido.estado === "finalizado" && (
            <div className="helper-text" style={{ marginTop: -4, marginBottom: 10, textAlign: "left" }}>
              Este pedido ya está confirmado — si agregas un código acá, queda anotado en el historial.
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min="1" className="qty-input" style={{ width: 56 }} value={nuevaCantidad}
              onChange={e => setNuevaCantidad(e.target.value)} />
            <CodigoInput className="code-chip" placeholder="Código de producto" value={nuevoCodigo}
              onChange={v => setNuevoCodigo(v)}
              onKeyDown={e => e.key === "Enter" && agregarProducto()} />
            <button className="icon-btn" disabled={!nuevoCodigo.trim() || agregando} onClick={agregarProducto}>
              {agregando ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
            </button>
          </div>

          {(pedido.estado === "tomado" || pedido.estado === "finalizado") && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <div className="helper-text" style={{ marginBottom: 8, textAlign: "left" }}>
                ¿Faltó algo? Sube una foto con más códigos — el pedido vuelve a "Pendiente", bajo el subtítulo "Adicionales".
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} disabled={agregandoAdicional} onClick={() => setCamaraAdicionalAbierta(true)}>
                  {agregandoAdicional ? <Loader2 className="spin" size={14} /> : (<><ScanLine size={13} /> Cámara</>)}
                </button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} disabled={agregandoAdicional} onClick={() => fileRefAdicional.current?.click()}>
                  <ImageIcon size={13} /> Subir foto
                </button>
                <input ref={fileRefAdicional} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={e => { procesarArchivoAdicional(e.target.files[0]); e.target.value = ""; }} />
              </div>
            </div>
          )}
        </div>
      )}

      {camaraAdicionalAbierta && (
        <CamaraCaptura onCapturar={procesarCamaraAdicional} onCerrar={() => setCamaraAdicionalAbierta(false)} />
      )}

      {puedeMarcarActivo && pedido.tipo === "separar" && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label><Boxes size={12} style={{ verticalAlign: -2 }} /> Cantidad de cajas del pedido</label>
            <input type="number" min="1" value={cajasInput} onChange={e => setCajasInput(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label><ImageIcon size={12} style={{ verticalAlign: -2 }} /> Foto de dónde se está dejando la mercadería *</label>
            {fotoUbicacionCapturada ? (
              <div>
                <img src={fotoUbicacionCapturada} alt="Ubicación de la mercadería" className="upload-preview"
                  style={{ marginBottom: 6, cursor: "zoom-in" }} onClick={() => setFotoAmpliada(fotoUbicacionCapturada)} />
                <button className="btn btn-outline btn-sm" onClick={() => setFotoUbicacionCapturada(null)}>Tomar otra foto</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setCamaraUbicacionAbierta(true)}>
                  <ScanLine size={13} /> Usar cámara
                </button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => fileRefUbicacion.current?.click()}>
                  <ImageIcon size={13} /> Subir foto
                </button>
                <input ref={fileRefUbicacion} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={e => { capturarFotoUbicacionArchivo(e.target.files[0]); e.target.value = ""; }} />
              </div>
            )}
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>¿En qué piso o área se dejó? *</label>
            <input type="text" placeholder="Ej: Piso 2, Zona de despacho A" value={areaUbicacion}
              onChange={e => setAreaUbicacion(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Notas del paquete (opcional)</label>
            <textarea rows={2} placeholder="Ej: caja frágil, va con otra caja aparte, etc." value={notasPaquete}
              onChange={e => setNotasPaquete(e.target.value)} style={{ width: "100%", resize: "vertical" }} />
          </div>

          {!todosMarcados && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
              Marca check o equis en todos los códigos para poder finalizar.
            </div>
          )}
          {todosMarcados && (!fotoUbicacionCapturada || !areaUbicacion.trim()) && (
            <div style={{ fontSize: 11.5, color: "var(--amber)", marginBottom: 10 }}>
              Falta la foto de la ubicación y/o el piso/área para poder finalizar.
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizarSeparar || guardando} onClick={finalizarSeparado}>
            {guardando ? <Loader2 className="spin" size={15} /> : "Finalizar pedido"}
          </button>
        </div>
      )}

      {camaraUbicacionAbierta && (
        <CamaraCaptura onCapturar={capturarFotoUbicacionCamara} onCerrar={() => setCamaraUbicacionAbierta(false)} />
      )}

      {puedeMarcarActivo && pedido.tipo === "confirmar" && (
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Marca cada código y confirma que hay stock disponible para este pedido (sin armar cajas).
          </div>
          {!todosMarcados && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
              Marca check o equis en todos los códigos para poder confirmar.
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizarConfirmar || guardando} onClick={confirmarPedido}>
            {guardando ? <Loader2 className="spin" size={15} /> : "Confirmar pedido"}
          </button>
        </div>
      )}

      {pedido.estado === "finalizado" && pedido.tipo !== "confirmar" && pedido.cajas > 0 && (
        <div className="card" style={{ marginTop: 18, textAlign: "center" }}>
          <div className="cajas-count-badge" style={{ marginBottom: 12 }}>
            <Boxes size={13} /> {pedido.cajas} caja(s) preparadas
          </div>
          <div className="helper-text" style={{ marginTop: -6, marginBottom: 12 }}>
            Finalizado el {fmtFechaHora(pedido.finalizadoEn)}
          </div>
          <button className="btn btn-teal btn-block" onClick={() => descargarEtiquetas(pedido)}>
            <Download size={15} /> Descargar etiquetas para las cajas
          </button>
        </div>
      )}

      {pedido.estado === "finalizado" && pedido.tipo !== "confirmar" && (pedido.fotoUbicacion || pedido.areaUbicacion || pedido.notasPaquete) && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="section-label" style={{ marginTop: 0 }}><ImageIcon size={13} /> Dónde se dejó la mercadería</div>
          {pedido.fotoUbicacion && (
            <img src={pedido.fotoUbicacion} alt="Ubicación de la mercadería" className="upload-preview"
              style={{ marginBottom: 10, cursor: "zoom-in" }} onClick={() => setFotoAmpliada(pedido.fotoUbicacion)} />
          )}
          {pedido.areaUbicacion && (
            <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Piso/Área:</strong> {pedido.areaUbicacion}</div>
          )}
          {pedido.notasPaquete && (
            <div style={{ fontSize: 13, color: "var(--muted)" }}><strong style={{ color: "var(--text)" }}>Notas:</strong> {pedido.notasPaquete}</div>
          )}
        </div>
      )}

      {(pedido.vendedorId === user.id || pedido.almaceneroId === user.id) ? null : (
        <div className="helper-text" style={{ marginTop: 20 }}>
          El chat de este pedido solo lo pueden usar el vendedor y quien lo tome del almacén.
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-outline" onClick={onVolver}><ChevronLeft size={14} /> Volver</button>
      </div>

      {fotoAmpliada && (
        <div className="lightbox-overlay" onClick={() => setFotoAmpliada(null)}>
          <button className="lightbox-close" onClick={() => setFotoAmpliada(null)}>✕</button>
          <img src={fotoAmpliada} alt="Foto original en tamaño completo" />
        </div>
      )}

      {camaraAbierta && (
        <CamaraCaptura
          onCapturar={base64 => { setCamaraAbierta(false); procesarBase64Escaneo(base64); }}
          onCerrar={() => setCamaraAbierta(false)}
        />
      )}

      {/* Chat flotante (globo, como WhatsApp) — solo para el vendedor
          dueño del pedido y quien lo tome del almacén. */}
      {puedeChatear && !chatAbierto && (
        <button className="chat-fab" onClick={() => setChatAbierto(true)} title="Abrir chat del pedido">
          <MessageSquare size={24} />
          {chatNoLeido && <span className="chat-fab-badge">●</span>}
        </button>
      )}
      {puedeChatear && chatAbierto && (
        <div className="chat-float-window">
          <div className="chat-float-header">
            <span><MessageSquare size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Chat · {pedido.id}</span>
            <button className="icon-btn" onClick={() => setChatAbierto(false)}>✕</button>
          </div>
          <div className="chat-float-body">
            <ChatPanel pedidoId={pedido.id} user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
