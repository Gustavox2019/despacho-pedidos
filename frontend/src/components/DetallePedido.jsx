import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCheck, ClipboardList, CheckCircle2, XCircle,
  Boxes, Download, MessageSquare, ChevronLeft, PackageCheck, Plus, Image as ImageIcon, Layers,
  History, Pin, Ban
} from "lucide-react";
import { fmtTime, fmtFechaHora, uid, calcularProgreso } from "../helpers.js";
import { api } from "../api.js";
import { descargarEtiquetas } from "../etiquetas.js";
import ChatPanel from "./ChatPanel.jsx";

const NUMERO_WHATSAPP = import.meta.env.VITE_WHATSAPP_NUMBER;

export default function DetallePedido({ pedidoId, user, onVolver }) {
  const [pedido, setPedido] = useState(null);
  const [cajasInput, setCajasInput] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [nuevaCantidad, setNuevaCantidad] = useState(1);
  const [nuevoCodigo, setNuevoCodigo] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const pedidoRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const p = await api.obtenerPedido(pedidoId);
      pedidoRef.current = p;
      setPedido(p);
      if (p.cajas) setCajasInput(String(p.cajas));
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

  function guardarEnSegundoPlano(patch) {
    api.actualizarPedido(pedidoId, patch)
      .then(actualizado => { pedidoRef.current = actualizado; })
      .catch(err => console.error("No se pudo guardar:", err));
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

  async function agregarProducto() {
    if (!nuevoCodigo.trim()) return;
    setAgregando(true);
    try {
      const nuevoItem = { id: uid("it"), cantidad: Number(nuevaCantidad) || 1, codigo: nuevoCodigo.trim(), piso: "", fotoId: null, check: null, texto: "" };
      const nuevosItems = [...pedido.items, nuevoItem];
      const patch = { items: nuevosItems };
      if (puedeEditarFinalizado) {
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
        estado: "finalizado", cajas: Number(cajasInput), finalizadoEn: Date.now(), vistoPorVendedor: false
      });
      pedidoRef.current = actualizado;
      setPedido(actualizado);
    } finally {
      setGuardando(false);
    }
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

  const yoLoTome = pedido.almaceneroId === user.id;
  // Ahora el checklist línea por línea aplica a los dos tipos de pedido:
  // en "separar" además se piden las cajas; en "confirmar" basta con
  // marcar cada código para poder confirmar el pedido.
  const puedeMarcarActivo = pedido.estado === "tomado" && yoLoTome;
  // El almacenero que separó el pedido puede seguir editando el checklist
  // incluso después de finalizarlo — pero cada cambio queda anotado en el
  // historial del pedido (ver updateItemCheck / agregarProducto).
  const puedeEditarFinalizado = pedido.estado === "finalizado" && yoLoTome;
  const puedeMarcar = puedeMarcarActivo || puedeEditarFinalizado;
  const puedeAgregarProducto = (pedido.estado !== "finalizado" && pedido.estado !== "cancelado") || puedeEditarFinalizado;
  const puedeCancelar = pedido.vendedorId === user.id && (pedido.estado === "pendiente" || pedido.estado === "tomado");
  const todosMarcados = pedido.items.every(it => it.check === "ok" || it.check === "no");
  const cajasValidas = Number(cajasInput) > 0;
  const puedeFinalizarSeparar = puedeMarcarActivo && pedido.tipo === "separar" && todosMarcados && cajasValidas;
  const puedeFinalizarConfirmar = puedeMarcarActivo && pedido.tipo === "confirmar" && todosMarcados;
  const progreso = calcularProgreso(pedido);

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
            <History size={13} /> Editado después de finalizar
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

      <div className="section-label"><ClipboardList size={13} /> Checklist</div>
      <div className="checklist-box">
        <table className="item-table">
          <tbody>
            {pedido.items.map(it => (
              <tr className="item-row" key={it.id}>
                <td style={{ width: 34, fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>{it.cantidad}</td>
                <td>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{it.codigo}</div>
                  {it.piso && <div style={{ fontSize: 11, color: "var(--muted)" }}>Piso: {it.piso}</div>}
                </td>
                <td style={{ width: puedeMarcar ? 190 : 0 }}>
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
                      <input type="text" className="txt-mini" placeholder="detalle" value={it.texto || ""}
                        onChange={e => updateItemCheck(it.id, { texto: e.target.value })} />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {it.check === "ok" && <CheckCircle2 size={16} color="var(--green)" />}
                      {it.check === "no" && <XCircle size={16} color="var(--red)" />}
                      {it.texto && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{it.texto}</span>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {puedeAgregarProducto && (
        <div className="card" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800, marginBottom: 10 }}>
            Agregar producto a este pedido
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" min="1" className="qty-input" style={{ width: 56 }} value={nuevaCantidad}
              onChange={e => setNuevaCantidad(e.target.value)} />
            <input type="text" className="code-chip" placeholder="Código de producto" value={nuevoCodigo}
              onChange={e => setNuevoCodigo(e.target.value)}
              onKeyDown={e => e.key === "Enter" && agregarProducto()} />
            <button className="icon-btn" disabled={!nuevoCodigo.trim() || agregando} onClick={agregarProducto}>
              {agregando ? <Loader2 className="spin" size={15} /> : <Plus size={15} />}
            </button>
          </div>
        </div>
      )}

      {puedeMarcarActivo && pedido.tipo === "separar" && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <label><Boxes size={12} style={{ verticalAlign: -2 }} /> Cantidad de cajas del pedido</label>
            <input type="number" min="1" value={cajasInput} onChange={e => setCajasInput(e.target.value)} />
          </div>
          {!todosMarcados && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
              Marca check o equis en todos los códigos para poder finalizar.
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizarSeparar || guardando} onClick={finalizarSeparado}>
            {guardando ? <Loader2 className="spin" size={15} /> : "Finalizar pedido"}
          </button>
        </div>
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

      <div className="section-label"><MessageSquare size={13} /> Chat del pedido</div>
      <ChatPanel pedidoId={pedido.id} user={user} />

      <div style={{ marginTop: 22 }}>
        <button className="btn btn-outline" onClick={onVolver}><ChevronLeft size={14} /> Volver</button>
      </div>

      {fotoAmpliada && (
        <div className="lightbox-overlay" onClick={() => setFotoAmpliada(null)}>
          <button className="lightbox-close" onClick={() => setFotoAmpliada(null)}>✕</button>
          <img src={fotoAmpliada} alt="Foto original en tamaño completo" />
        </div>
      )}
    </div>
  );
}
