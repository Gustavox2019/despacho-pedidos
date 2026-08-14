import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, CheckCheck, ClipboardList, CheckCircle2, XCircle,
  Boxes, Download, MessageSquare, ChevronLeft, PackageCheck, Plus, Image as ImageIcon, Layers
} from "lucide-react";
import { fmtTime, fmtFechaHora, uid } from "../helpers.js";
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
  const [verFoto, setVerFoto] = useState(false);
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

  function updateItemCheck(itemId, patch) {
    const nuevosItems = pedido.items.map(it => it.id === itemId ? { ...it, ...patch } : it);
    setPedido({ ...pedido, items: nuevosItems });
    guardarEnSegundoPlano({ items: nuevosItems });
  }

  async function agregarProducto() {
    if (!nuevoCodigo.trim()) return;
    setAgregando(true);
    try {
      const nuevoItem = { id: uid("it"), cantidad: Number(nuevaCantidad) || 1, codigo: nuevoCodigo.trim(), piso: "", check: null, texto: "" };
      const nuevosItems = [...pedido.items, nuevoItem];
      const actualizado = await api.actualizarPedido(pedidoId, { items: nuevosItems });
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

  if (!pedido) {
    return <div className="container"><div className="empty-state"><Loader2 className="spin" size={26} /></div></div>;
  }

  const yoLoTome = pedido.almaceneroId === user.id;
  const puedeMarcar = pedido.estado === "tomado" && yoLoTome && pedido.tipo === "separar";
  const puedeConfirmar = pedido.estado === "tomado" && yoLoTome && pedido.tipo === "confirmar";
  const puedeAgregarProducto = pedido.estado !== "finalizado";
  const todosMarcados = pedido.items.every(it => it.check === "ok" || it.check === "no");
  const cajasValidas = Number(cajasInput) > 0;
  const puedeFinalizar = puedeMarcar && todosMarcados && cajasValidas;

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
        {linkWhatsapp && (
          <a href={linkWhatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ whiteSpace: "nowrap", color: "#25D366", borderColor: "#25D366" }}>
            <MessageSquare size={14} /> WhatsApp
          </a>
        )}
      </div>
      <div className="page-sub">
        Vendedor: {pedido.vendedorNombre} · {fmtTime(pedido.creadoEn)}{" "}
        <span className={`status-pill status-${pedido.estado}`} style={{ marginLeft: 6 }}>
          {pedido.estado === "pendiente" && "Pendiente"}
          {pedido.estado === "tomado" && "En proceso"}
          {pedido.estado === "finalizado" && "Finalizado"}
        </span>
      </div>

      {pedido.estado === "finalizado" && pedido.finalizadoEn && (
        <div className="page-sub" style={{ marginTop: -14 }}>
          <CheckCheck size={12} style={{ verticalAlign: -2 }} /> Finalizado el {fmtFechaHora(pedido.finalizadoEn)}
        </div>
      )}

      {pedido.foto && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <ImageIcon size={12} /> Foto original de la lista
          </div>
          <img src={pedido.foto} className="foto-thumb" alt="Foto original de la lista" onClick={() => setVerFoto(true)} />
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

      {puedeMarcar && (
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
          <button className="btn btn-primary btn-block" disabled={!puedeFinalizar || guardando} onClick={finalizarSeparado}>
            {guardando ? <Loader2 className="spin" size={15} /> : "Finalizar pedido"}
          </button>
        </div>
      )}

      {puedeConfirmar && (
        <div className="card" style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Confirma que hay stock disponible para este pedido (sin armar cajas).
          </div>
          <button className="btn btn-primary btn-block" disabled={guardando} onClick={confirmarPedido}>
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

      {verFoto && (
        <div className="lightbox-overlay" onClick={() => setVerFoto(false)}>
          <button className="lightbox-close" onClick={() => setVerFoto(false)}>✕</button>
          <img src={pedido.foto} alt="Foto original en tamaño completo" />
        </div>
      )}
    </div>
  );
}
